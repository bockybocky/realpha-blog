import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// package.json 為 type:module，.js 會被當 ESM；改用 CommonJS 包裝載入（module 才存在）
import fs from 'node:fs';
const src = fs.readFileSync(path.join(root, 'public', 'espresso-lab.js'), 'utf8');
const cjs = { exports: {} };
new Function('module', 'exports', 'require', src)(cjs, cjs.exports, require);
const { model, interp, states, PRESETS } = cjs.exports;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  } else {
    console.log('ok  ', msg);
  }
}

const d = model({ grind: 300, temp: 93, pressure: 9 });
assert(d.shotTime >= 25 && d.shotTime <= 32, `default shotTime 25–32 got ${d.shotTime}`);
assert(d.ey >= 19 && d.ey <= 21.5, `default ey 19–21.5 got ${d.ey}`);
assert(d.zone === 'ideal', `default zone ideal got ${d.zone}`);

const sour = model({ grind: 380, temp: 89, pressure: 9 });
assert(sour.zone === 'under', `sour zone under got ${sour.zone}`);
assert(sour.balance < 0, `sour balance<0 got ${sour.balance}`);

const bitter = model({ grind: 210, temp: 95.5, pressure: 10.5 });
assert(bitter.zone === 'over', `bitter zone over got ${bitter.zone}`);
assert(bitter.balance > 0, `bitter balance>0 got ${bitter.balance}`);
assert(bitter.channel > 0.3, `bitter channel>0.3 got ${bitter.channel}`);

let flowMono = true;
let prevF = -Infinity;
for (let g = 180; g <= 450; g += 10) {
  const f = model({ grind: g, temp: 93, pressure: 9 }).flow;
  if (f <= prevF) flowMono = false;
  prevF = f;
}
assert(flowMono, 'finer grind → smaller flow (monotonic)');

let eyMono = true;
let prevE = -Infinity;
for (let t = 86; t <= 96; t += 0.5) {
  const e = model({ grind: 300, temp: t, pressure: 9 }).ey;
  if (e < prevE - 1e-9) eyMono = false;
  prevE = e;
}
assert(eyMono, 'higher temp → higher ey (monotonic)');

const f6 = model({ grind: 300, temp: 93, pressure: 6 }).flow;
const f8 = model({ grind: 300, temp: 93, pressure: 8 }).flow;
const f9 = model({ grind: 300, temp: 93, pressure: 9 }).flow;
const f11 = model({ grind: 300, temp: 93, pressure: 11 }).flow;
assert(f11 - f9 < f8 - f6, `pressure 9→11 increment (${f11 - f9}) < 6→8 (${f8 - f6})`);

const last = d.curve[d.curve.length - 1];
assert(last.cup >= 36 && last.cup < 37.5, `curve last cup in [36, 37.5) got ${last.cup}`);

const fn = interp || model.interp;
assert(typeof fn === 'function', 'interp function exists');
const atEnd = fn(d.curve, d.shotTime);
assert(Math.abs(atEnd.cup - 36) <= 0.5, `interp at shotTime cup≈36 got ${atEnd.cup}`);

assert(states.ey(17.999) === 'under' && states.ey(18) === 'ideal' && states.ey(22) === 'ideal' && states.ey(22.001) === 'over', 'extraction badge boundaries 18/22');
assert(states.time(19.999) === 'fast' && states.time(20) === 'normal' && states.time(35) === 'normal' && states.time(35.001) === 'slow', 'shot-time badge boundaries 20/35');
assert(states.flow(0.999) === 'slow' && states.flow(1) === 'normal' && states.flow(2) === 'normal' && states.flow(2.001) === 'fast', 'flow badge boundaries 1.0/2.0');
assert(states.puck(0.1499) === 'even' && states.puck(0.15) === 'risk' && states.puck(0.4) === 'risk' && states.puck(0.4001) === 'channeling', 'puck badge boundaries 0.15/0.4');

const turbo = PRESETS.turbo;
const turboResult = model(turbo);
assert(turbo.grind >= 180 && turbo.grind <= 450 && turbo.temp >= 86 && turbo.temp <= 96 && turbo.pressure >= 6 && turbo.pressure <= 11, 'turbo preset is within slider ranges');
assert([turboResult.flow, turboResult.shotTime, turboResult.ey, turboResult.tds, turboResult.channel, turboResult.balance].every(Number.isFinite), 'turbo preset model has no NaN or infinite values');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
