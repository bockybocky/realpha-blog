#!/usr/bin/env node
import process from 'node:process';

const INDEX_TABLE = [
  { key: 'ndx', symbol: '^IXIC', displayName: '那斯達克綜合' },
  { key: 'dji', symbol: '^DJI', displayName: '道瓊工業' },
  { key: 'rut', symbol: '^RUT', displayName: '羅素 2000' },
  { key: 'spx', symbol: '^GSPC', displayName: '標普 500' },
  { key: 'twii', symbol: '^TWII', displayName: '台股加權' },
];

class ConverterError extends Error {}

function usage() {
  return [
    'Usage:',
    '  node scripts/scenario_card_from_feed.mjs --indices spx,twii < feed.json > cards.json',
    '  node scripts/scenario_card_from_feed.mjs --indices all < feed.json > cards.json',
  ].join('\n');
}

function parseArgs(argv) {
  let indices = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true, keys: [] };
    if (arg === '--indices') {
      indices = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--indices=')) {
      indices = arg.slice('--indices='.length);
      continue;
    }
    throw new ConverterError(`未知參數：${arg}`);
  }
  if (!indices) throw new ConverterError('缺少 --indices。');

  const allKeys = INDEX_TABLE.map((entry) => entry.key);
  const requested = indices === 'all'
    ? allKeys
    : indices.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (requested.length === 0) throw new ConverterError('--indices 不得為空。');
  const unknown = requested.filter((key) => !allKeys.includes(key));
  if (unknown.length > 0) throw new ConverterError(`未知指數 key：${unknown.join(', ')}。`);
  if (new Set(requested).size !== requested.length) throw new ConverterError('--indices 不得重複。');
  return { help: false, keys: requested };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) throw new ConverterError('stdin 沒有 feed JSON。');
  try {
    return JSON.parse(input);
  } catch (error) {
    throw new ConverterError(`feed JSON 解析失敗：${error.message}`);
  }
}

function requireText(value, path) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConverterError(`${path} 必須是非空字串。`);
  }
  return value.trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 4 }).format(value);
}

function formatRange(range) {
  if (!isObject(range) || !Object.hasOwn(range, 'lo') || !Object.hasOwn(range, 'hi')) {
    throw new ConverterError('scenario.close_range 必須包含 lo 與 hi。');
  }
  const { lo, hi } = range;
  for (const [name, value] of Object.entries({ lo, hi })) {
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new ConverterError(`scenario.close_range.${name} 必須是有限數字或 null。`);
    }
  }
  if (lo === null) return `${formatNumber(hi)} 以下（含）`;
  if (hi === null) return `高於 ${formatNumber(lo)}`;
  return `高於 ${formatNumber(lo)}、${formatNumber(hi)} 以下（含）`;
}

function convertScenario(scenario, rowPath) {
  if (!isObject(scenario)) throw new ConverterError(`${rowPath} 必須是 object。`);
  const id = requireText(scenario.id, `${rowPath}.id`);
  const label = requireText(scenario.label, `${rowPath}.label`);
  const narrative = requireText(scenario.narrative, `${rowPath}.narrative`);
  if (!Number.isInteger(scenario.prob_pct)) {
    throw new ConverterError(`${rowPath}.prob_pct 必須是整數。`);
  }
  formatRange(scenario.close_range);
  return {
    id,
    label,
    prob_pct: scenario.prob_pct,
    close_range: {
      lo: scenario.close_range.lo,
      hi: scenario.close_range.hi,
    },
    narrative,
  };
}

function buildClaim(row, scenarios) {
  const eventParts = row.week_events.length === 0
    ? ['目前無已知重大事件']
    : row.week_events.map((event, index) => {
      if (!isObject(event)) throw new ConverterError(`week_events[${index}] 必須是 object。`);
      const eventDate = requireText(event.date, `week_events[${index}].date`);
      const name = requireText(event.name, `week_events[${index}].name`);
      const why = requireText(event.why_it_matters, `week_events[${index}].why_it_matters`);
      return `${eventDate} ${name}（${why}）`;
    });
  const scenarioParts = scenarios.map((scenario) => (
    `${scenario.label}：收盤${formatRange(scenario.close_range)}，${scenario.narrative}`
  ));
  const probabilityParts = scenarios.map((scenario) => `${scenario.label} ${scenario.prob_pct}%`);
  return `本週事件：${eventParts.join('；')}。情境分段：${scenarioParts.join('；')}。機率總覽：${probabilityParts.join('、')}。`;
}

function convertRow(row, indexMeta, meta, rowIndex) {
  const rowPath = `rows[${rowIndex}]`;
  if (!isObject(row)) throw new ConverterError(`${rowPath} 必須是 object。`);
  if (row.index_key !== indexMeta.key) throw new ConverterError(`${rowPath}.index_key 不一致。`);
  if (row.symbol !== indexMeta.symbol) {
    throw new ConverterError(`${rowPath}.symbol 應為 ${indexMeta.symbol}。`);
  }
  if (row.display_name !== indexMeta.displayName) {
    throw new ConverterError(`${rowPath}.display_name 應為 ${indexMeta.displayName}。`);
  }
  if (typeof row.last_close !== 'number' || !Number.isFinite(row.last_close)) {
    throw new ConverterError(`${rowPath}.last_close 必須是有限數字。`);
  }
  requireText(row.last_close_date, `${rowPath}.last_close_date`);
  if (!Array.isArray(row.week_events)) throw new ConverterError(`${rowPath}.week_events 必須是 array。`);
  if (!Array.isArray(row.scenarios)) throw new ConverterError(`${rowPath}.scenarios 必須是 array。`);

  const scenarios = row.scenarios.map((scenario, index) => convertScenario(scenario, `${rowPath}.scenarios[${index}]`));
  const symbol = indexMeta.symbol;
  return {
    card_id: '',
    claim: buildClaim(row, scenarios),
    claim_en: '',
    title: `${indexMeta.displayName}週情境預報 ${meta.week_of} 當週`,
    title_en: '',
    claim_type: 'forecast',
    judge_mode: 'machine',
    subject: {
      level: 'index',
      name: indexMeta.displayName,
      symbols: [symbol],
    },
    scenarios,
    criterion: {
      indicator: `${symbol} 於 deadline 當日或前一有效交易日收盤`,
      threshold: '情境分段見 scenarios（互斥且窮盡）',
      deadline: meta.settle_date,
      benchmark: '機率校準制（Brier），無二元對照',
      data_source: `yfinance ${symbol} close`,
      machine_rule: {
        metric: 'scenario_partition',
        subject_symbol: symbol,
        observation: 'weekly_close_on_deadline',
      },
    },
    committed_at: '',
    deadline: meta.settle_date,
    status: 'aging',
    verdict: '',
    replay_ready_at: '',
    author_class: 'internal',
    is_sample: false,
  };
}

function convertFeed(feed, keys) {
  if (!isObject(feed)) throw new ConverterError('feed 必須是 object。');
  if (feed.source !== 'weekly_scenario') throw new ConverterError('feed.source 必須是 weekly_scenario。');
  if (feed.schema_ver !== 1) throw new ConverterError('feed.schema_ver 必須是 1。');
  requireText(feed.as_of, 'feed.as_of');
  if (!isObject(feed.meta)) throw new ConverterError('feed.meta 必須是 object。');
  requireText(feed.meta.week_of, 'feed.meta.week_of');
  requireText(feed.meta.settle_date, 'feed.meta.settle_date');
  if (!Array.isArray(feed.rows)) throw new ConverterError('feed.rows 必須是 array。');

  const rowsByKey = new Map();
  feed.rows.forEach((row, index) => {
    if (!isObject(row)) throw new ConverterError(`rows[${index}] 必須是 object。`);
    if (rowsByKey.has(row.index_key)) throw new ConverterError(`feed.rows 出現重複 index_key=${row.index_key}。`);
    rowsByKey.set(row.index_key, { row, index });
  });

  return INDEX_TABLE
    .filter((entry) => keys.includes(entry.key))
    .map((entry) => {
      const found = rowsByKey.get(entry.key);
      if (!found) throw new ConverterError(`feed.rows 缺少 index_key=${entry.key}。`);
      return convertRow(found.row, entry, feed.meta, found.index);
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const feed = await readStdin();
  const cards = convertFeed(feed, args.keys);
  process.stdout.write(`${JSON.stringify(cards, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof ConverterError ? error.message : error);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
