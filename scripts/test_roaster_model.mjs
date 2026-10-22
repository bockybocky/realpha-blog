import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'public', 'roaster-lab.js'), 'utf8');
const cjs = { exports: {} };
new Function('module', 'exports', 'require', src)(cjs, cjs.exports, require);
const { model, PRESETS, PLAY_MS } = cjs.exports;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  } else {
    console.log('ok  ', msg);
  }
}

function between(x, a, b) {
  return x != null && x >= a && x <= b;
}

function avg(arr) {
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

assert(PLAY_MS === 15000, `play duration 15000 ms got ${PLAY_MS}`);
assert(typeof model === 'function', 'model exports without DOM');

const d = model({ charge: 200, power: 70, airflow: 50, drop: 215 });
assert(between(d.turning.t, 50, 100), `turning time 50–100s got ${d.turning.t}`);
assert(between(d.turning.temp, 80, 110), `turning temp 80–110 got ${d.turning.temp}`);
assert(between(d.dryEnd, 240, 330), `dry end 240–330s got ${d.dryEnd}`);
assert(between(d.firstCrack, 480, 600), `first crack 480–600s got ${d.firstCrack}`);
assert(between(d.dropTime, 585, 720), `drop 585–720s got ${d.dropTime}`);
assert(between(d.dtr, 0.17, 0.24), `dtr 17–24% got ${d.dtr}`);
assert(d.level === '中焙', `level 中焙 got ${d.level}`);
assert(d.warnings.length === 0, `default warnings empty got ${d.warnings.join(',')}`);

const p50 = model({ charge: 200, power: 50, airflow: 50, drop: 215 });
const p90 = model({ charge: 200, power: 90, airflow: 50, drop: 215 });
assert(p50.firstCrack != null && p50.firstCrack >= d.firstCrack + 90, `power 50 crack ≥ default+90 got ${p50.firstCrack} vs ${d.firstCrack}`);
assert(p90.firstCrack != null && p90.firstCrack < d.firstCrack, `power 90 crack earlier got ${p90.firstCrack} vs ${d.firstCrack}`);

const c220 = model({ charge: 220, power: 70, airflow: 50, drop: 215 });
assert(c220.turning.temp > d.turning.temp, `charge 220 turning hotter got ${c220.turning.temp} vs ${d.turning.temp}`);

const d207 = model({ charge: 200, power: 70, airflow: 50, drop: 207 });
const d230 = model({ charge: 200, power: 70, airflow: 50, drop: 230 });
assert(d207.dtr != null && d207.dtr < d.dtr, `drop 207 dtr lower got ${d207.dtr} vs ${d.dtr}`);
assert(d230.dtr != null && d230.dtr > d.dtr, `drop 230 dtr higher got ${d230.dtr} vs ${d.dtr}`);
assert(d230.level === '深焙', `drop 230 level 深焙 got ${d230.level}`);

const low = model(PRESETS.low);
assert(low.warnings.indexOf('stall') >= 0 || low.warnings.indexOf('never') >= 0, `low heat stall or never got ${low.warnings.join(',')}`);
const hot = model(PRESETS.hot);
assert(hot.warnings.indexOf('scorch') >= 0, `hot charge scorch got ${hot.warnings.join(',')}`);

const fc = d.firstCrack;
const before = [];
const after = [];
for (let i = 0; i < 60; i++) {
  before.push(d.curve[fc - 60 + i].ror);
  after.push(d.curve[fc + i].ror);
}
assert(avg(after) < avg(before), `ror after crack ${avg(after).toFixed(2)} < before ${avg(before).toFixed(2)}`);

const again = model({ charge: 200, power: 70, airflow: 50, drop: 215 });
assert(JSON.stringify(again) === JSON.stringify(d), 'same input, same result');

assert(d.curve.length > 10 && d.curve[0].t === 0, 'curve starts at t=0');
assert(d.curve.every((pt) => ['drying', 'maillard', 'development', 'cooling'].indexOf(pt.phase) >= 0), 'phase names');

function line(name, input) {
  const r = model(input);
  const warn = r.warnings.length ? r.warnings.join('+') : 'none';
  const dtr = r.dtr == null ? '—' : (r.dtr * 100).toFixed(1) + '%';
  const mm = (s) => (s == null ? '—' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
  console.log(`${name} 轉折 ${mm(r.turning.t)} ${r.turning.temp.toFixed(1)}°C 脫水 ${mm(r.dryEnd)} 一爆 ${mm(r.firstCrack)} 出豆 ${mm(r.dropTime)} 發展 ${dtr} ${r.level} ${warn}`);
}

console.log('--- presets ---');
line('預設', { charge: 200, power: 70, airflow: 50, drop: 215 });
line('標準中焙', PRESETS.standard);
line('淺焙', PRESETS.light);
line('深焙', PRESETS.dark);
line('火太小', PRESETS.low);
line('投豆溫太高', PRESETS.hot);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
