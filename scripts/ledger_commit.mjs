#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_LEDGER = 'src/data/ledger.json';
const CLAIM_TYPE_ALLOWLIST = new Set(['direction', 'macro_regime', 'relative', 'event']);
const JUDGE_MODE_ALLOWLIST = new Set(['machine', 'human']);
const STATUS_ALLOWLIST = new Set(['aging', 'hit', 'miss', 'undecidable']);
const SUBJECT_LEVEL_ALLOWLIST = new Set([
  'index',
  'market_index',
  'sector',
  'sector_etf',
  'industry_group',
  'macro',
  'macro_regime',
  'relative',
  'asset_class',
  'style_factor',
]);
const STOCK_SUBJECT_LEVELS = new Set([
  'stock',
  'single_stock',
  'individual_stock',
  'equity',
  'company',
  'adr',
  'common_stock',
  '個股',
  '股票',
  '公司',
]);
const CRITERION_FIELDS = [
  ['indicator', '指標'],
  ['threshold', '門檻'],
  ['deadline', '期限'],
  ['benchmark', '基準'],
  ['data_source', '資料源'],
];

class LedgerCommitError extends Error {}

function usage() {
  return [
    'Usage:',
    `  node scripts/ledger_commit.mjs path/to/card.json [--ledger ${DEFAULT_LEDGER}]`,
    '  node scripts/ledger_commit.mjs - [--ledger src/data/ledger.json] < card.json',
    '',
    'The script appends one internal, non-stock, non-target-price card and runs git add.',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { cardPath: '', ledgerPath: DEFAULT_LEDGER };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--ledger') {
      args.ledgerPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--ledger=')) {
      args.ledgerPath = arg.slice('--ledger='.length);
      continue;
    }
    if (arg.startsWith('--')) {
      throw new LedgerCommitError(`未知參數：${arg}`);
    }
    if (args.cardPath) {
      throw new LedgerCommitError(`只接受一張卡，收到多餘參數：${arg}`);
    }
    args.cardPath = arg;
  }
  if (!args.help && !args.cardPath) {
    throw new LedgerCommitError('缺少 card JSON 路徑。');
  }
  if (!args.ledgerPath) {
    throw new LedgerCommitError('缺少 ledger JSON 路徑。');
  }
  return args;
}

function normalizeLevel(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function copyCriterionAliases(card) {
  if (!isObject(card.criterion)) return;
  for (const [field, alias] of CRITERION_FIELDS) {
    if (card.criterion[field] === undefined && card.criterion[alias] !== undefined) {
      card.criterion[field] = card.criterion[alias];
    }
  }
}

function validateCard(rawCard, existingLedger) {
  const errors = [];
  const card = structuredClone(rawCard);
  copyCriterionAliases(card);

  if (!/^LJ-\d{4}-\d{4}$/.test(String(card.card_id ?? ''))) {
    errors.push('拒收：card_id 必須符合 LJ-YYYY-NNNN。');
  }

  if (existingLedger.some((entry) => entry.card_id === card.card_id)) {
    errors.push(`拒收：card_id=${card.card_id} 已存在於 ledger。`);
  }

  if (card.claim_type === 'target_price') {
    errors.push('拒收：claim_type=target_price 是目標價/喊單類型，帳本只允許 direction|macro_regime|relative|event。');
  } else if (!CLAIM_TYPE_ALLOWLIST.has(card.claim_type)) {
    errors.push(`拒收：claim_type=${String(card.claim_type)} 不在白名單 direction|macro_regime|relative|event。`);
  }

  if (card.author_class !== 'internal') {
    errors.push(`拒收：author_class 必須是 internal，收到 ${String(card.author_class)}。`);
  }

  if (!isObject(card.subject)) {
    errors.push('拒收：缺少 subject；P0 必須明標 index/sector_etf/macro/relative，才能硬擋個股。');
  } else {
    const level = normalizeLevel(card.subject.level ?? card.subject.subject_level ?? card.subject.type);
    if (!level) {
      errors.push('拒收：缺少 subject.level；P0 必須明標 index/sector_etf/macro/relative，才能硬擋個股。');
    } else if (STOCK_SUBJECT_LEVELS.has(level)) {
      errors.push(`拒收：subject.level=${card.subject.level} 是個股層級，P0-P1 禁止個股卡上帳本。`);
    } else if (!SUBJECT_LEVEL_ALLOWLIST.has(level)) {
      errors.push(`拒收：subject.level=${card.subject.level} 不在指數/類股 ETF/總經/相對強弱白名單。`);
    }
  }

  if (!card.claim || typeof card.claim !== 'string') {
    errors.push('拒收：claim 必須是非空字串。');
  }
  if (!card.title || typeof card.title !== 'string') {
    errors.push('拒收：title 必須是非空字串。');
  }
  if (!JUDGE_MODE_ALLOWLIST.has(card.judge_mode)) {
    errors.push(`拒收：judge_mode=${String(card.judge_mode)} 不在 machine|human。`);
  }
  if (!STATUS_ALLOWLIST.has(card.status ?? 'aging')) {
    errors.push(`拒收：status=${String(card.status)} 不在 aging|hit|miss|undecidable。`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(card.deadline ?? ''))) {
    errors.push('拒收：deadline 必須是 YYYY-MM-DD。');
  }

  if (!isObject(card.criterion)) {
    errors.push('拒收：criterion 必須包含指標/門檻/期限/基準/資料源五要素。');
  } else {
    for (const [field, alias] of CRITERION_FIELDS) {
      if (!card.criterion[field]) {
        errors.push(`拒收：criterion 缺少 ${field}（${alias}）。`);
      }
    }
    if (card.criterion.deadline && card.deadline && String(card.criterion.deadline) !== String(card.deadline)) {
      errors.push(`拒收：criterion.deadline=${card.criterion.deadline} 與 deadline=${card.deadline} 不一致。`);
    }
  }

  if (errors.length > 0) {
    throw new LedgerCommitError(errors.join('\n'));
  }

  return {
    ...card,
    claim_en: card.claim_en ?? '',
    title_en: card.title_en ?? '',
    committed_at: card.committed_at ?? '',
    status: card.status ?? 'aging',
    verdict: card.verdict ?? '',
    replay_ready_at: card.replay_ready_at ?? '',
    is_sample: Boolean(card.is_sample),
  };
}

async function readJson(filePath) {
  const input = filePath === '-' ? await readStdin() : await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new LedgerCommitError(`JSON 解析失敗：${error.message}`);
  }
}

async function readStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function readLedger(ledgerPath) {
  try {
    const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    if (!Array.isArray(ledger)) {
      throw new LedgerCommitError('ledger.json 必須是 array。');
    }
    return ledger;
  } catch (error) {
    if (error instanceof LedgerCommitError) throw error;
    throw new LedgerCommitError(`讀取 ledger 失敗：${error.message}`);
  }
}

function gitAdd(ledgerPath) {
  const relativeLedgerPath = path.relative(process.cwd(), ledgerPath).replaceAll(path.sep, '/');
  const result = spawnSync('git', ['add', '--', relativeLedgerPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new LedgerCommitError(`git add 失敗：${detail || 'unknown error'}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const ledgerPath = path.resolve(process.cwd(), args.ledgerPath);
  const cardPath = args.cardPath === '-' ? '-' : path.resolve(process.cwd(), args.cardPath);
  const [rawCard, ledger] = await Promise.all([readJson(cardPath), readLedger(ledgerPath)]);
  const card = validateCard(rawCard, ledger);
  const nextLedger = [...ledger, card];

  await fs.writeFile(ledgerPath, `${JSON.stringify(nextLedger, null, 2)}\n`, 'utf8');
  gitAdd(ledgerPath);

  console.log(`已加入並 stage：${card.card_id}`);
  console.log(`下一步可執行：git commit -m "ledger: commit ${card.card_id}"`);
  console.log('公證時間以該 git commit 的原生 timestamp 為準；本腳本不自建 hash 或時間戳。');
}

main().catch((error) => {
  console.error(error instanceof LedgerCommitError ? error.message : error);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
