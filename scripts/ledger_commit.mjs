#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_LEDGER = 'src/data/ledger.json';
const CLAIM_TYPE_ALLOWLIST = new Set(['direction', 'macro_regime', 'relative', 'event', 'forecast']);
const JUDGE_MODE_ALLOWLIST = new Set(['machine', 'human']);
const STATUS_ALLOWLIST = new Set(['aging', 'hit', 'miss', 'undecidable', 'scored']);
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

function taipeiTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isValidYmd(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function assignCardId(card, existingLedger) {
  if (String(card.card_id ?? '').trim()) return;
  const year = taipeiTodayYmd().slice(0, 4);
  const prefix = `LJ-${year}-`;
  const latest = existingLedger.reduce((max, entry) => {
    const id = String(entry.card_id ?? '');
    if (!id.startsWith(prefix)) return max;
    const sequence = Number(id.slice(prefix.length));
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  card.card_id = `${prefix}${String(latest + 1).padStart(4, '0')}`;
}

function forbiddenScenarioField(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = forbiddenScenarioField(item);
      if (found) return found;
    }
    return '';
  }
  if (!isObject(value)) return '';
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[\s_-]+/g, '');
    if (normalized.includes('playbook')
      || (normalized.includes('counter') && normalized.includes('strateg'))
      || key.includes('對策')
      || key.includes('錦囊')) {
      return key;
    }
    const found = forbiddenScenarioField(nested);
    if (found) return found;
  }
  return '';
}

function validateForecast(card, errors) {
  if (card.judge_mode !== 'machine') {
    errors.push('拒收：forecast 卡的 judge_mode 必須是 machine。');
  }

  const subjectLevel = normalizeLevel(card.subject?.level ?? card.subject?.subject_level ?? card.subject?.type);
  if (subjectLevel !== 'index') {
    errors.push('拒收：forecast 卡的 subject.level 必須是 index，禁止個股 forecast。');
  }
  const symbols = card.subject?.symbols;
  if (!Array.isArray(symbols) || symbols.length !== 1 || typeof symbols[0] !== 'string' || !symbols[0].startsWith('^')) {
    errors.push('拒收：forecast 卡的 subject.symbols 必須只含一個 ^ 開頭的指數代號。');
  }

  if (!isValidYmd(card.deadline) || String(card.deadline) <= taipeiTodayYmd()) {
    errors.push('拒收：forecast 卡的 deadline 必須是未來日期。');
  }

  const scenarios = card.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length < 2 || scenarios.length > 5) {
    errors.push('拒收：forecast 卡的 scenarios 必須有 2 至 5 個情境。');
    return;
  }

  const forbidden = forbiddenScenarioField(scenarios);
  if (forbidden) {
    errors.push(`拒收：scenarios 內不得出現 playbook 或對策欄位（發現 ${forbidden}）。`);
  }

  const ids = new Set();
  let probabilityTotal = 0;
  let rangesValid = true;
  for (const [index, scenario] of scenarios.entries()) {
    if (!isObject(scenario)) {
      errors.push(`拒收：scenarios[${index}] 必須是 object。`);
      rangesValid = false;
      continue;
    }
    const allowedFields = new Set(['id', 'label', 'prob_pct', 'close_range', 'narrative']);
    const unexpected = Object.keys(scenario).filter((key) => !allowedFields.has(key));
    if (unexpected.length > 0) {
      errors.push(`拒收：scenarios[${index}] 含未允許欄位：${unexpected.join(', ')}。`);
    }
    if (!scenario.id || typeof scenario.id !== 'string' || ids.has(scenario.id)) {
      errors.push(`拒收：scenarios[${index}].id 必須是非空且不重複的字串。`);
    } else {
      ids.add(scenario.id);
    }
    if (!scenario.label || typeof scenario.label !== 'string') {
      errors.push(`拒收：scenarios[${index}].label 必須是非空字串。`);
    }
    if (!scenario.narrative || typeof scenario.narrative !== 'string') {
      errors.push(`拒收：scenarios[${index}].narrative 必須是非空字串。`);
    }
    if (!Number.isInteger(scenario.prob_pct)) {
      errors.push(`拒收：scenarios[${index}].prob_pct 必須是整數。`);
    } else {
      probabilityTotal += scenario.prob_pct;
    }

    const range = scenario.close_range;
    if (!isObject(range)) {
      errors.push(`拒收：scenarios[${index}].close_range 必須是 {lo, hi}。`);
      rangesValid = false;
      continue;
    }
    for (const endpoint of ['lo', 'hi']) {
      const value = range[endpoint];
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
        errors.push(`拒收：scenarios[${index}].close_range.${endpoint} 必須是有限數字或 null。`);
        rangesValid = false;
      }
    }
    if (range.lo !== null && range.hi !== null && range.lo >= range.hi) {
      errors.push(`拒收：scenarios[${index}] 的 close_range 必須滿足 lo < hi。`);
      rangesValid = false;
    }
  }

  if (probabilityTotal !== 100) {
    errors.push(`拒收：forecast 情境 prob_pct 加總必須恰為 100，目前為 ${probabilityTotal}。`);
  }

  if (rangesValid) {
    const sorted = [...scenarios].sort((left, right) => {
      const leftLo = left.close_range.lo;
      const rightLo = right.close_range.lo;
      if (leftLo === null) return rightLo === null ? 0 : -1;
      if (rightLo === null) return 1;
      return leftLo - rightLo;
    });
    if (sorted[0].close_range.lo !== null || sorted.at(-1).close_range.hi !== null) {
      errors.push('拒收：forecast close_range 必須窮盡；排序後首段 lo=null、末段 hi=null。');
    }
    for (let index = 0; index < sorted.length - 1; index += 1) {
      if (sorted[index].close_range.hi !== sorted[index + 1].close_range.lo) {
        errors.push(`拒收：forecast close_range 必須互斥且無縫；排序後第 ${index + 1} 段 hi 必須等於下一段 lo。`);
      }
    }
  }

  const symbol = Array.isArray(symbols) ? symbols[0] : '';
  const rule = card.criterion?.machine_rule;
  if (!isObject(rule)
    || rule.metric !== 'scenario_partition'
    || rule.subject_symbol !== symbol
    || rule.observation !== 'weekly_close_on_deadline') {
    errors.push('拒收：forecast criterion.machine_rule 必須鎖定 scenario_partition、subject_symbol 與 weekly_close_on_deadline。');
  }

  const expectedCriterion = {
    indicator: `${symbol} 於 deadline 當日或前一有效交易日收盤`,
    threshold: '情境分段見 scenarios（互斥且窮盡）',
    benchmark: '機率校準制（Brier），無二元對照',
    data_source: `yfinance ${symbol} close`,
  };
  for (const [field, expected] of Object.entries(expectedCriterion)) {
    if (card.criterion?.[field] !== expected) {
      errors.push(`拒收：forecast criterion.${field} 必須是「${expected}」。`);
    }
  }
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
  assignCardId(card, existingLedger);
  copyCriterionAliases(card);

  if (!/^LJ-\d{4}-\d{4}$/.test(String(card.card_id ?? ''))) {
    errors.push('拒收：card_id 必須符合 LJ-YYYY-NNNN。');
  }

  if (existingLedger.some((entry) => entry.card_id === card.card_id)) {
    errors.push(`拒收：card_id=${card.card_id} 已存在於 ledger。`);
  }

  if (card.claim_type === 'target_price') {
    errors.push('拒收：claim_type=target_price 是目標價/喊單類型，帳本只允許 direction|macro_regime|relative|event|forecast。');
  } else if (!CLAIM_TYPE_ALLOWLIST.has(card.claim_type)) {
    errors.push(`拒收：claim_type=${String(card.claim_type)} 不在白名單 direction|macro_regime|relative|event|forecast。`);
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
    errors.push(`拒收：status=${String(card.status)} 不在 aging|hit|miss|undecidable|scored。`);
  }
  if (!isValidYmd(card.deadline)) {
    errors.push('拒收：deadline 必須是 YYYY-MM-DD。');
  }

  if (card.claim_type === 'forecast') {
    validateForecast(card, errors);
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
