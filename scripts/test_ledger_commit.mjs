#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ledgerCommit = path.join(scriptDir, 'ledger_commit.mjs');
const scenarioConverter = path.join(scriptDir, 'scenario_card_from_feed.mjs');

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

function forecastCard(overrides = {}) {
  const symbol = '^GSPC';
  return {
    card_id: 'LJ-2099-0006',
    claim: '本週事件：通膨數據公布。情境分段與機率已於公證時鎖定。',
    claim_en: '',
    title: '標普 500週情境預報 2099-12-14 當週',
    title_en: '',
    claim_type: 'forecast',
    judge_mode: 'machine',
    subject: {
      level: 'index',
      name: '標普 500',
      symbols: [symbol],
    },
    scenarios: [
      {
        id: 's1',
        label: '需求轉弱',
        prob_pct: 20,
        close_range: { lo: null, hi: 6000 },
        narrative: '數據低於預期，風險偏好降溫。',
      },
      {
        id: 's2',
        label: '區間整理',
        prob_pct: 50,
        close_range: { lo: 6000, hi: 6500 },
        narrative: '數據大致符合預期，指數維持區間。',
      },
      {
        id: 's3',
        label: '風險續漲',
        prob_pct: 30,
        close_range: { lo: 6500, hi: null },
        narrative: '數據溫和，資金延續風險偏好。',
      },
    ],
    criterion: {
      indicator: `${symbol} 於 deadline 當日或前一有效交易日收盤`,
      threshold: '情境分段見 scenarios（互斥且窮盡）',
      deadline: '2099-12-18',
      benchmark: '機率校準制（Brier），無二元對照',
      data_source: `yfinance ${symbol} close`,
      machine_rule: {
        metric: 'scenario_partition',
        subject_symbol: symbol,
        observation: 'weekly_close_on_deadline',
      },
    },
    committed_at: '',
    deadline: '2099-12-18',
    status: 'aging',
    verdict: '',
    replay_ready_at: '',
    author_class: 'internal',
    is_sample: false,
    ...overrides,
  };
}

function run(command, args, cwd, options = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    ...options,
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

    const validForecast = await runLedgerCommit(tempRoot, 'valid-forecast', forecastCard());
    assert.equal(validForecast.status, 0, validForecast.stderr || validForecast.stdout);

    const wrongProbabilityScenarios = structuredClone(forecastCard().scenarios);
    wrongProbabilityScenarios[2].prob_pct = 29;
    const wrongProbability = await runLedgerCommit(tempRoot, 'forecast-wrong-probability', forecastCard({
      card_id: 'LJ-2099-0007',
      scenarios: wrongProbabilityScenarios,
    }));
    assert.notEqual(wrongProbability.status, 0, 'forecast probability sum other than 100 should be rejected');
    assert.match(wrongProbability.stderr, /加總必須恰為 100/);

    const gapScenarios = structuredClone(forecastCard().scenarios);
    gapScenarios[1].close_range.lo = 6001;
    const gapPartition = await runLedgerCommit(tempRoot, 'forecast-gap', forecastCard({
      card_id: 'LJ-2099-0008',
      scenarios: gapScenarios,
    }));
    assert.notEqual(gapPartition.status, 0, 'forecast close ranges with a gap should be rejected');
    assert.match(gapPartition.stderr, /互斥且無縫/);

    const playbookScenarios = structuredClone(forecastCard().scenarios);
    playbookScenarios[0].playbook = '內部對策不得公開';
    const playbook = await runLedgerCommit(tempRoot, 'forecast-playbook', forecastCard({
      card_id: 'LJ-2099-0009',
      scenarios: playbookScenarios,
    }));
    assert.notEqual(playbook.status, 0, 'forecast scenarios containing playbook should be rejected');
    assert.match(playbook.stderr, /playbook 或對策欄位/);

    const stockForecast = await runLedgerCommit(tempRoot, 'stock-forecast', forecastCard({
      card_id: 'LJ-2099-0010',
      subject: {
        level: 'stock',
        name: 'Apple Inc.',
        symbols: ['AAPL'],
      },
    }));
    assert.notEqual(stockForecast.status, 0, 'single-stock forecast should be rejected');
    assert.match(stockForecast.stderr, /個股層級|subject\.level 必須是 index/);

    const sampleFeed = {
      source: 'weekly_scenario',
      as_of: '2099-12-13T17:05:00+08:00',
      schema_ver: 1,
      meta: {
        week_of: '2099-12-14',
        settle_date: '2099-12-18',
        status: 'draft',
        notarized_cards: {},
        last_settle: null,
      },
      rows: [
        {
          index_key: 'spx',
          symbol: '^GSPC',
          display_name: '標普 500',
          last_close: 6200,
          last_close_date: '2099-12-11',
          week_events: [{ date: '2099-12-16', name: '通膨數據', why_it_matters: '影響利率預期' }],
          scenarios: forecastCard().scenarios.map((scenario) => ({
            ...scenario,
            playbook: '只供內部使用',
          })),
        },
        {
          index_key: 'twii',
          symbol: '^TWII',
          display_name: '台股加權',
          last_close: 32000,
          last_close_date: '2099-12-11',
          week_events: [],
          scenarios: [
            { id: 's1', label: '壓回整理', prob_pct: 45, close_range: { lo: null, hi: 32000 }, narrative: '權值股量縮整理。', playbook: '只供內部使用' },
            { id: 's2', label: '資金續攻', prob_pct: 55, close_range: { lo: 32000, hi: null }, narrative: '資金延續風險偏好。', playbook: '只供內部使用' },
          ],
        },
      ],
    };
    const converted = run(process.execPath, [scenarioConverter, '--indices', 'spx,twii'], tempRoot, {
      input: JSON.stringify(sampleFeed),
    });
    assert.equal(converted.status, 0, converted.stderr || converted.stdout);
    const convertedCards = JSON.parse(converted.stdout);
    assert.equal(convertedCards.length, 2);
    assert.equal(convertedCards.every((card) => card.card_id === ''), true);
    assert.doesNotMatch(converted.stdout, /playbook|只供內部使用/);
    for (const [index, card] of convertedCards.entries()) {
      const result = await runLedgerCommit(tempRoot, `converted-${index}`, card);
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }

    const ledger = JSON.parse(await fs.readFile(path.join(tempRoot, 'src', 'data', 'ledger.json'), 'utf8'));
    assert.equal(ledger.length, 4);
    assert.equal(ledger[0].card_id, 'LJ-2099-0005');
    assert.equal(ledger[0].author_class, 'internal');
    assert.equal(ledger[1].card_id, 'LJ-2099-0006');
    assert.equal(ledger[2].claim_type, 'forecast');
    assert.equal(ledger[3].claim_type, 'forecast');
    assert.equal(ledger.slice(2).every((card) => /^LJ-\d{4}-\d{4}$/.test(card.card_id)), true);

    const staged = run('git', ['diff', '--cached', '--name-only'], tempRoot);
    assert.equal(staged.status, 0, staged.stderr || staged.stdout);
    assert.match(staged.stdout, /src\/data\/ledger\.json|src\\data\\ledger\.json/);

    console.log('test_ledger_commit: whitelist、forecast 驗證與 converter round-trip 全部通過');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
