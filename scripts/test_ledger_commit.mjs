#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ledgerCommit = path.join(scriptDir, 'ledger_commit.mjs');

function baseCard(overrides = {}) {
  return {
    card_id: 'LJ-2099-0001',
    claim: '測試卡：未來一季 XLK 的區間報酬將高於 SPY。',
    claim_en: '',
    title: '測試：科技類股相對大盤偏強',
    title_en: '',
    claim_type: 'direction',
    judge_mode: 'machine',
    subject: {
      level: 'sector_etf',
      name: 'Technology Select Sector ETF',
      symbols: ['XLK', 'SPY'],
    },
    criterion: {
      indicator: 'XLK 與 SPY 的 adjusted close 區間報酬差',
      threshold: 'XLK 報酬率 - SPY 報酬率 >= 1.0 個百分點',
      deadline: '2099-12-31',
      benchmark: 'SPY, QQQ',
      data_source: 'yfinance adjusted close',
      machine_rule: {
        metric: 'relative_return',
        subject_symbol: 'XLK',
        benchmark_symbol: 'SPY',
        operator: 'gte',
        threshold_pct: 0.01,
        observation_start: '2099-01-01',
      },
    },
    committed_at: '',
    deadline: '2099-12-31',
    status: 'aging',
    verdict: '',
    replay_ready_at: '',
    author_class: 'internal',
    is_sample: false,
    ...overrides,
  };
}

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
}

async function runLedgerCommit(tempRoot, label, card) {
  const cardPath = path.join(tempRoot, `${label}.json`);
  await fs.writeFile(cardPath, `${JSON.stringify(card, null, 2)}\n`, 'utf8');
  return run(process.execPath, [ledgerCommit, cardPath, '--ledger', 'src/data/ledger.json'], tempRoot);
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ledger-commit-'));
  try {
    await fs.mkdir(path.join(tempRoot, 'src', 'data'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'src', 'data', 'ledger.json'), '[]\n', 'utf8');

    const gitInit = run('git', ['init'], tempRoot);
    assert.equal(gitInit.status, 0, gitInit.stderr || gitInit.stdout);

    const targetPrice = await runLedgerCommit(tempRoot, 'target-price', baseCard({
      card_id: 'LJ-2099-0002',
      claim_type: 'target_price',
    }));
    assert.notEqual(targetPrice.status, 0, 'target_price card should be rejected');
    assert.match(targetPrice.stderr, /claim_type=target_price/);

    const stockCard = await runLedgerCommit(tempRoot, 'stock-card', baseCard({
      card_id: 'LJ-2099-0003',
      subject: {
        level: 'stock',
        name: 'Apple Inc.',
        symbols: ['AAPL'],
      },
    }));
    assert.notEqual(stockCard.status, 0, 'individual stock card should be rejected');
    assert.match(stockCard.stderr, /個股層級|禁止個股/);

    const externalAuthor = await runLedgerCommit(tempRoot, 'external-author', baseCard({
      card_id: 'LJ-2099-0004',
      author_class: 'external',
    }));
    assert.notEqual(externalAuthor.status, 0, 'external author card should be rejected');
    assert.match(externalAuthor.stderr, /author_class/);

    const validCard = await runLedgerCommit(tempRoot, 'valid-sector', baseCard({
      card_id: 'LJ-2099-0005',
    }));
    assert.equal(validCard.status, 0, validCard.stderr || validCard.stdout);

    const ledger = JSON.parse(await fs.readFile(path.join(tempRoot, 'src', 'data', 'ledger.json'), 'utf8'));
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].card_id, 'LJ-2099-0005');
    assert.equal(ledger[0].author_class, 'internal');

    const staged = run('git', ['diff', '--cached', '--name-only'], tempRoot);
    assert.equal(staged.status, 0, staged.stderr || staged.stdout);
    assert.match(staged.stdout, /src\/data\/ledger\.json|src\\data\\ledger\.json/);

    console.log('test_ledger_commit: all whitelist checks passed');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
