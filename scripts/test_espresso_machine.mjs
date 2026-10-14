import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

class NodeStub {
  constructor(attrs = {}) { this.attrs = { ...attrs }; this.textContent = ""; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
}
class ContainerStub {
  constructor() { this.nodes = new Map(); this.particles = []; this.levers = []; this.heaters = []; this.flowTargets = []; this.doseParts = []; this.steam = []; this.markup = ""; this.classList = { add() {} }; }
  set innerHTML(markup) {
    this.markup = markup; this.nodes.clear(); this.particles = []; this.levers = []; this.heaters = []; this.flowTargets = []; this.doseParts = []; this.steam = [];
    this.iso = new NodeStub(); this.svg = new NodeStub(); this.readout = new NodeStub();
    for (const match of markup.matchAll(/<[^>]*data-part="([^"]+)"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      if (!this.nodes.has(match[1])) this.nodes.set(match[1], new NodeStub(attrs));
    }
    for (const match of markup.matchAll(/<circle class="em-particle"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      this.particles.push(new NodeStub(attrs));
    }
    for (const match of markup.matchAll(/<[^>]*data-lever="true"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      const existing = attrs["data-part"] ? this.nodes.get(attrs["data-part"]) : null;
      const lever = existing ?? new NodeStub(attrs); Object.assign(lever.attrs, attrs); this.levers.push(lever);
    }
    for (const match of markup.matchAll(/<[^>]*data-flow-target[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      this.flowTargets.push(new NodeStub(attrs));
    }
    for (const match of markup.matchAll(/<[^>]*data-heater="true"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      this.heaters.push(new NodeStub(attrs));
    }
    for (const match of markup.matchAll(/<[^>]*data-dose="true"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      this.doseParts.push(attrs["data-part"] && this.nodes.get(attrs["data-part"]) || new NodeStub(attrs));
    }
    for (const match of markup.matchAll(/<circle class="em-steam"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      this.steam.push(new NodeStub(attrs));
    }
  }
  querySelector(selector) {
    if (selector === ".iso") return this.iso;
    if (selector === "svg") return this.svg;
    if (selector === "[data-readout]") return this.readout;
    const match = selector.match(/^\[data-part="(.+)"\]$/); return match ? this.nodes.get(match[1]) ?? null : null;
  }
  querySelectorAll(selector) { if (selector === ".em-particle") return this.particles; if (selector === ".em-steam") return this.steam; if (selector === "[data-dose]") return this.doseParts; if (selector === "[data-lever]") return this.levers; if (selector === "[data-heater]") return this.heaters; if (selector === "[data-flow-target]") return this.flowTargets; return []; }
}

const htmlClass = new Set(["dark"]);
const documentStub = {
  documentElement: { classList: { contains: (name) => htmlClass.has(name) } }, head: { appendChild() {} },
  getElementById() { return null; }, createElement() { return new NodeStub(); },
};
let mutationCallback;
class MutationObserverStub { constructor(callback) { mutationCallback = callback; } observe() {} disconnect() {} }

const commonjs = { exports: {} };
runInNewContext(readFileSync(new URL("../public/espresso-machine.js", import.meta.url), "utf8"), { module: commonjs, globalThis: {}, document: documentStub, MutationObserver: MutationObserverStub });
const machine = commonjs.exports;
assert.equal(machine.VERSION, "2.0.0");
assert.equal(typeof machine.mount, "function");

const container = new ContainerStub();
const controller = machine.mount(container, { lang: "zh" });
const node = (part) => container.querySelector(`[data-part="${part}"]`);
const base = { grind: 300, temp: 93.5, pressure: 9, flow: 1.45, cup: 0, t: 0, shotTime: 25, channel: 0.1, zone: "ok" };
const angles = [7, 9, 11].map((pressure) => { controller.update({ ...base, pressure }); return Number(node("pressure-needle").getAttribute("transform").match(/rotate\(([-\d.]+)/)[1]); });
assert.notEqual(angles[0], angles[2]);
assert.ok(Math.abs((angles[1] - angles[0]) - (angles[2] - angles[1])) < 1e-9, "pressure needle is linear");
controller.update({ ...base, pressure: 11 });
assert.equal(node("temp-value").textContent, "93.5°C");
assert.equal(node("pressure-value").textContent, "11.0 bar");
assert.equal(node("cup-value").textContent, "0.0 g");
assert.equal(container.readout.textContent, "93.5°C · 11.0 bar · 0.0 g");
const cup0 = node("cup-liquid").getAttribute("transform"); controller.update({ ...base, cup: 36 }); assert.notEqual(node("cup-liquid").getAttribute("transform"), cup0);
controller.update({ ...base, grind: 200 });
const fineRadius = Number(container.particles[0].getAttribute("r"));
const fineVisible = container.particles.filter((p) => p.getAttribute("data-hidden") === "false").length;
const fineAngle = node("grind-pointer").getAttribute("transform");
controller.update({ ...base, grind: 400 });
assert.ok(fineRadius < Number(container.particles[0].getAttribute("r")));
assert.ok(fineVisible > container.particles.filter((p) => p.getAttribute("data-hidden") === "false").length);
assert.notEqual(fineAngle, node("grind-pointer").getAttribute("transform"));
controller.update({ ...base, channel: 0.1 }); assert.equal(node("channel-cracks").getAttribute("opacity"), "0");
controller.update({ ...base, channel: 0.5 }); assert.equal(node("channel-cracks").getAttribute("opacity"), "1");
const leverAngle = (part) => Number(part.getAttribute("transform").match(/rotate\(([-\d.]+) /)[1]);
assert.ok(!/ data-flow[= >]/.test(container.markup), "static markup carries no data-flow");
controller.update({ ...base, t: 0 }); assert.equal(node("flow-stream").getAttribute("display"), "none"); assert.ok(container.levers.every((part) => leverAngle(part) === 0), "idle lever is up");
assert.ok(container.flowTargets.length >= 3, "coffee stream and water pipe have flow targets");
assert.ok(container.flowTargets.every((part) => part.getAttribute("data-flow") === null), "idle: no element has data-flow");
assert.equal(node("water-flow").getAttribute("display"), "none");
for (const part of ["bean-drop", "grounds-fall", "steam-scene", "pour-scene", "latte-art"]) assert.equal(node(part).getAttribute("display"), "none", `idle hides ${part}`);
controller.update({ ...base, stage: "beans", progress: .5 }); assert.equal(node("bean-drop").getAttribute("display"), "inline");
controller.update({ ...base, stage: "grind", progress: .5 }); assert.equal(node("grounds-fall").getAttribute("display"), "inline"); assert.match(node("grind-pointer").getAttribute("transform"), /rotate\(360 /);
controller.update({ ...base, stage: "dose", progress: .25 }); assert.ok(container.doseParts.some((part) => !/translate\(0/.test(part.getAttribute("transform"))), "dose moves portafilter from grinder to group");
controller.update({ ...base, stage: "steam", progress: .5 }); assert.equal(node("steam-scene").getAttribute("display"), "inline"); assert.ok(container.steam.every((part) => part.getAttribute("data-flow") !== null), "steam puffs flow");
controller.update({ ...base, stage: "pour", progress: .7 }); assert.equal(node("pour-scene").getAttribute("display"), "inline"); assert.equal(node("latte-art").getAttribute("display"), "inline"); assert.ok(node("pour-stream").getAttribute("data-flow") !== null, "milk pour flows");
controller.update({ ...base, stage: "done", progress: .5 }); assert.equal(node("latte-art").getAttribute("display"), "inline"); assert.equal(node("steam-scene").getAttribute("display"), "none");
controller.update({ ...base, t: 12.5, flow: 2 }); assert.equal(node("flow-stream").getAttribute("display"), "inline"); assert.equal(node("flow-stream").getAttribute("stroke-width"), "2.90");
assert.ok(container.levers.length >= 2, "lever test includes tube segments and ball");
assert.ok(container.levers.every((part) => Math.abs(leverAngle(part)) >= 25), "entire lever presses down >= 25 degrees from idle during extraction");
assert.ok(container.flowTargets.filter((part) => part.getAttribute("data-flow") !== null).length >= 1, "playing: data-flow set on at least one element");
assert.equal(node("water-flow").getAttribute("display"), "inline");
const rot = leverAngle(container.levers[0]) * Math.PI / 180;
const pivotX = Number(container.levers[0].getAttribute("data-pivot-x")), pivotY = Number(container.levers[0].getAttribute("data-pivot-y"));
const rotatedCentres = container.levers.map((part) => { const x = Number(part.getAttribute("data-center-x")), y = Number(part.getAttribute("data-center-y")), a = rot; return [pivotX + (x - pivotX) * Math.cos(a) - (y - pivotY) * Math.sin(a), pivotY + (x - pivotX) * Math.sin(a) + (y - pivotY) * Math.cos(a)]; });
const leverCentre = rotatedCentres.reduce((sum, p) => [sum[0] + p[0] / rotatedCentres.length, sum[1] + p[1] / rotatedCentres.length], [0, 0]);
assert.ok(Math.hypot(leverCentre[0] - pivotX, leverCentre[1] - pivotY) < 40, "rotated lever assembly stays centred near its pivot");
controller.update({ ...base, t: 25 }); assert.equal(node("flow-stream").getAttribute("display"), "none");
assert.ok(container.levers.every((part) => leverAngle(part) === 0), "lever returns up when the shot ends");
assert.ok(container.flowTargets.every((part) => part.getAttribute("data-flow") === null), "flow stops when the shot ends");
assert.doesNotThrow(() => controller.update({}));
assert.equal(container.svg.getAttribute("aria-label"), "會動的義式咖啡機剖面圖");
assert.equal(container.iso.getAttribute("data-theme"), null); htmlClass.delete("dark"); mutationCallback(); assert.equal(container.iso.getAttribute("data-theme"), "light"); htmlClass.add("dark"); mutationCallback(); assert.equal(container.iso.getAttribute("data-theme"), null);
const english = new ContainerStub(); machine.mount(english, { lang: "en" }); assert.match(english.markup, /An espresso machine, opened up/); assert.equal(english.svg.getAttribute("aria-label"), "Animated cutaway espresso machine");
const zone = node("pressure-green-zone");
const endpoints = zone.getAttribute("d").match(/M(-?[\d.]+) (-?[\d.]+)A[\d.]+ [\d.]+ 0 0 1 (-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number);
const endpointAngles = [Math.atan2(endpoints[1], endpoints[0]), Math.atan2(endpoints[3], endpoints[2])].map((radians) => radians * 180 / Math.PI);
const pressureAngle = (bar) => -220 + bar * 17.5;
assert.ok(Math.abs(endpointAngles[0] - pressureAngle(8)) < .1 && Math.abs(endpointAngles[1] - pressureAngle(10)) < .1, "green zone endpoints match 8 and 10 bar needle angles");
const tempWindow = container.markup.match(/data-temp-window-width="([\d.]+)" data-temp-font="([\d.]+)"/);
assert.ok(tempWindow, "temperature window records its screen width and font");
const tempFont = Number(tempWindow[2]), tempWindowWidth = Number(tempWindow[1]);
assert.ok("100.0°C".length * tempFont * 0.6 < tempWindowWidth, "widest temperature text fits the window");
const tempRendered = container.markup.match(/em-temp-window"[^>]*><g transform="matrix\(([-\d.]+) ([-\d.]+) [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+\)"><rect x="[-\d.]+" y="[-\d.]+" width="([\d.]+)"/);
assert.ok(tempRendered && Math.abs(Math.hypot(Number(tempRendered[1]), Number(tempRendered[2])) * Number(tempRendered[3]) - tempWindowWidth) < 2, "recorded window width matches the drawn window");
const gaugeTransform = container.markup.match(/data-part="pressure-gauge" transform="matrix\(([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) /);
assert.ok(gaugeTransform && Number(gaugeTransform[1]) > 0 && gaugeTransform[1] === gaugeTransform[4] && Number(gaugeTransform[2]) === 0 && Number(gaugeTransform[3]) === 0, "pressure dial is drawn as a true circle");
console.log("espresso machine tests passed: version, pressure linearity, green zone, shared readings, grind, channel, cup, flow, whole-lever pivot motion, defaults, locale, and theme");
