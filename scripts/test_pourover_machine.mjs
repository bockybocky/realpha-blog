import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

class NodeStub {
  constructor(attrs = {}) { this.attrs = { ...attrs }; this.textContent = ""; this.classList = { contains: (name) => String(this.attrs.class || "").split(/\s+/).includes(name) }; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
}
class ContainerStub {
  constructor() { this.nodes = new Map(); this.grounds = []; this.markup = ""; this.classList = { add() {} }; }
  set innerHTML(markup) {
    this.markup = markup; this.nodes.clear(); this.grounds = [];
    this.iso = new NodeStub(); this.svg = new NodeStub(); this.readout = new NodeStub();
    for (const match of markup.matchAll(/<[^>]*data-part="([^"]+)"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      if (!this.nodes.has(match[1])) this.nodes.set(match[1], new NodeStub(attrs));
    }
    for (const match of markup.matchAll(/<ellipse class="([^"]*pm-ground[^"]*)"[^>]*>/g)) {
      const attrs = { class: match[1] }; for (const pair of match[0].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      this.grounds.push(new NodeStub(attrs));
    }
  }
  querySelector(selector) {
    if (selector === ".iso") return this.iso;
    if (selector === "svg") return this.svg;
    if (selector === "[data-readout]") return this.readout;
    const match = selector.match(/^\[data-part="(.+)"\]$/);
    return match ? this.nodes.get(match[1]) ?? null : null;
  }
  querySelectorAll(selector) {
    const match = selector.match(/^\[data-part="(.+)"\]$/);
    if (!match) return [];
    return this.grounds.filter((node) => node.getAttribute("data-part") === match[1]);
  }
}

const htmlClass = new Set(["dark"]);
const documentStub = {
  documentElement: { classList: { contains: (name) => htmlClass.has(name) } },
  head: { appendChild() {} },
  getElementById() { return null; },
  createElement() { return new NodeStub(); },
};
let mutationCallback;
class MutationObserverStub { constructor(callback) { mutationCallback = callback; } observe() {} disconnect() {} }

const commonjs = { exports: {} };
runInNewContext(readFileSync(new URL("../public/pourover-machine.js", import.meta.url), "utf8"), {
  module: commonjs, globalThis: {}, document: documentStub, MutationObserver: MutationObserverStub,
});
const machine = commonjs.exports;
assert.equal(machine.VERSION, "1.0.0");
assert.equal(typeof machine.mount, "function");

const container = new ContainerStub();
const controller = machine.mount(container, { lang: "zh" });
const node = (part) => container.querySelector(`[data-part="${part}"]`);
const angle = (el) => Number(el.getAttribute("transform").match(/rotate\(([-\d.]+)/)[1]);
const width = (el) => Number(el.getAttribute("stroke-width"));
const level = (el) => Number(el.getAttribute("transform").match(/scale\(1 ([-\d.]+)\)/)[1]);
const base = { t: 150, grind: 700, temp: 93, pourRate: 5, pouring: true, poured: 200, head: 120, flow: 3.2, cup: 110, phase: "pour", elapsed: "2:30", dripper: "v60", valve: true };

const angles = [400, 800, 1200].map((grind) => { controller.update({ ...base, grind }); return angle(node("grind-mark")); });
assert.notEqual(angles[0], angles[2]);
assert.ok(Math.abs((angles[1] - angles[0]) - (angles[2] - angles[1])) < 1e-9, "dial angle is linear in grind");

const radius = (grind) => { controller.update({ ...base, grind }); return Number(container.querySelectorAll('[data-part="grounds-dot-v60"]')[0].getAttribute("rx")); };
const fine = radius(450), coarse = radius(1100);
assert.notEqual(fine, coarse, "grounds radius follows grind");
assert.ok(fine < coarse, "finer grind draws smaller grounds");

controller.update(base);
assert.equal(node("scale-weight").textContent, "200.0 g");
assert.equal(node("scale-time").textContent, "2:30");
assert.equal(container.readout.textContent, "93.0°C · 200.0 g · 2:30");
assert.equal(node("temp-screen").textContent, "93.0°C");

controller.update({ ...base, pouring: false });
assert.equal(node("stream-v60").getAttribute("display"), "none");
controller.update({ ...base, pouring: true, pourRate: 3 });
const narrow = width(node("stream-v60"));
assert.equal(node("stream-v60").getAttribute("display"), "inline");
controller.update({ ...base, pouring: true, pourRate: 9 });
assert.notEqual(narrow, width(node("stream-v60")), "stream width follows pour rate");

controller.update({ ...base, head: 0 });
assert.equal(node("water-v60").getAttribute("display"), "none");
controller.update({ ...base, head: 200 });
assert.equal(node("water-v60").getAttribute("display"), "inline");

controller.update({ ...base, flow: 0 });
assert.equal(node("drip-v60").getAttribute("display"), "none");
controller.update({ ...base, flow: 4 });
assert.equal(node("drip-v60").getAttribute("display"), "inline");

controller.update({ ...base, cup: 0 });
const empty = level(node("carafe-level"));
controller.update({ ...base, cup: 200 });
assert.notEqual(empty, level(node("carafe-level")), "carafe level follows cup weight");

controller.update({ ...base, phase: "idle" });
assert.equal(node("hopper-beans").getAttribute("display"), "inline");
controller.update({ ...base, phase: "pour" });
assert.equal(node("hopper-beans").getAttribute("display"), "none");

controller.update({ ...base, dripper: "kalita" });
assert.equal(node("dripper-v60").getAttribute("display"), "none");
assert.equal(node("dripper-kalita").getAttribute("display"), "inline");
controller.update({ ...base, dripper: "kadou" });
for (const kind of ["v60", "kalita", "melitta", "clever"]) assert.equal(node(`dripper-${kind}`).getAttribute("display"), "none", `${kind} hides when kadou is selected`);
assert.equal(node("dripper-kadou").getAttribute("display"), "inline");
assert.equal(container.markup.includes("單孔"), false);
controller.update({ ...base, dripper: "clever", valve: false, flow: 4 });
assert.equal(node("drip-clever").getAttribute("display"), "none", "closed valve hides the drip");
assert.equal(node("clever-valve").getAttribute("transform"), "translate(0 0)");
controller.update({ ...base, dripper: "clever", valve: true, flow: 4 });
assert.equal(node("drip-clever").getAttribute("display"), "inline");
assert.equal(node("clever-valve").getAttribute("transform"), "translate(0 -7)");

const before = container.markup;
container.svg.setAttribute("data-kept", "yes");
assert.doesNotThrow(() => controller.update({}));
assert.equal(container.markup, before, "update does not rebuild the svg");
assert.equal(container.svg.getAttribute("data-kept"), "yes");
assert.equal(node("temp-screen").textContent, "93.0°C");
assert.equal(node("scale-weight").textContent, "0.0 g");
assert.equal(node("scale-time").textContent, "0:00");
assert.equal(container.readout.textContent, "93.0°C · 0.0 g · 0:00");
assert.equal(node("hopper-beans").getAttribute("display"), "inline");

assert.equal(container.svg.getAttribute("aria-label"), "會動的手沖台剖面圖");
assert.equal(container.iso.getAttribute("data-theme"), null);
htmlClass.delete("dark"); mutationCallback();
assert.equal(container.iso.getAttribute("data-theme"), "light");
htmlClass.add("dark"); mutationCallback();
assert.equal(container.iso.getAttribute("data-theme"), null);

const other = new ContainerStub();
const otherCtrl = machine.mount(other, { lang: "en" });
assert.match(other.markup, /A pour-over station, opened up/);
assert.match(other.markup, /Drag the sliders below; the gear follows/);
assert.match(other.markup, /Finer grounds and hotter water extract more/);
assert.equal(other.svg.getAttribute("aria-label"), "Animated cutaway pour-over station");
assert.doesNotMatch(other.markup, /手沖台/);
otherCtrl.update({ ...base, temp: 96.5, poured: 180, elapsed: "1:05" });
assert.equal(other.querySelector(`[data-part="temp-screen"]`).textContent, "96.5°C");
assert.equal(node("temp-screen").textContent, "93.0°C", "a second mount does not rewrite the first");
assert.match(container.markup, /手沖台，打開來看/);

// ribs inside
const ribs = [...container.markup.matchAll(/data-rib-kind="(v60|kadou)" data-centre-radius="([\d.]+)" data-inner-radius="([\d.]+)"/g)];
assert.equal(ribs.filter((m) => m[1] === "kadou").length, 32, "kadou keeps 32 ribs");
assert.equal(ribs.filter((m) => m[1] === "v60").length, 4, "v60 keeps 4 ribs");
for (const [, kind, centreText, innerText] of ribs) {
  const centreRadius = Number(centreText), innerRadius = Number(innerText);
  assert.ok(centreRadius < innerRadius, `${kind} rib centre radius is inside its wall`);
  assert.ok(innerRadius - centreRadius <= 0.6, `${kind} rib stays within 0.6 of its inner wall`);
}
const kadouCone = container.markup.match(/data-inner-bottom-radius="([\d.]+)" data-inner-top-radius="([\d.]+)"/);
assert.ok(kadouCone, "kadou cone exposes its inner radii");
assert.ok(Number(kadouCone[2]) >= Number(kadouCone[1]) * 1.5, "kadou top radius is at least 1.5x bottom radius");
console.log("ribs inside: kadou 32, v60 4; every centre is inside and within 0.6 of the inner wall; kadou taper >= 1.5x");

console.log("pourover machine tests passed: version, dial linearity, grounds radius, screens, readout, stream, water, drip, carafe, hopper, drippers, valve, defaults, locale, theme, two mounts, ribs inside");
