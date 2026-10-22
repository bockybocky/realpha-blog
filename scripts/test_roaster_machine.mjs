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
  constructor() { this.nodes = new Map(); this.beans = []; this.markup = ""; this.classList = { add() {} }; }
  set innerHTML(markup) {
    this.markup = markup; this.nodes.clear(); this.beans = [];
    this.iso = new NodeStub(); this.svg = new NodeStub(); this.readout = new NodeStub();
    for (const match of markup.matchAll(/<[^>]*data-part="([^"]+)"[^>]*>/g)) {
      const attrs = {}; for (const pair of match[0].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      if (!this.nodes.has(match[1])) this.nodes.set(match[1], new NodeStub(attrs));
    }
    for (const match of markup.matchAll(/<ellipse class="([^"]*rm-bean[^"]*)"[^>]*>/g)) {
      const attrs = { class: match[1] }; for (const pair of match[0].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      this.beans.push(new NodeStub(attrs));
    }
  }
  querySelector(selector) {
    if (selector === ".iso") return this.iso;
    if (selector === "svg") return this.svg;
    if (selector === "[data-readout]") return this.readout;
    const match = selector.match(/^\[data-part="(.+)"\]$/);
    return match ? this.nodes.get(match[1]) ?? null : null;
  }
  querySelectorAll(selector) { return selector === ".rm-bean" ? this.beans : []; }
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
runInNewContext(readFileSync(new URL("../public/roaster-machine.js", import.meta.url), "utf8"), {
  module: commonjs, globalThis: {}, document: documentStub, MutationObserver: MutationObserverStub,
});
const machine = commonjs.exports;
assert.equal(machine.VERSION, "1.0.0");
assert.equal(typeof machine.mount, "function");

const container = new ContainerStub();
const controller = machine.mount(container, { lang: "zh" });
const node = (part) => container.querySelector(`[data-part="${part}"]`);
const scaleY = (el) => Number(el.getAttribute("transform").match(/scale\(1 ([-\d.]+)\)/)[1]);
const angle = (el) => Number(el.getAttribute("transform").match(/rotate\(([-\d.]+)/)[1]);
const base = { t: 540, power: 70, airflow: 50, bean: 203, ror: 9.5, roast: 0.45, phase: "development", crack: 0.6, elapsed: "9:00" };

const heights = [20, 50, 80].map((power) => { controller.update({ ...base, power }); return scaleY(node("flame")); });
assert.notEqual(heights[0], heights[2]);
assert.ok(Math.abs((heights[1] - heights[0]) - (heights[2] - heights[1])) < 1e-9, "flame height is linear in power");

controller.update({ ...base, airflow: 0 });
const shut = angle(node("damper-lever"));
controller.update({ ...base, airflow: 100 });
const open = angle(node("damper-lever"));
assert.equal(shut, 0);
assert.ok(open - shut > 50, "damper opens about 60 degrees");

controller.update(base);
assert.equal(node("bean-screen").textContent, "203.0°C");
assert.equal(node("ror-screen").textContent, "9.5°C/分");
assert.equal(node("elapsed-screen").textContent, "9:00");
assert.equal(container.readout.textContent, "203.0°C · 9.5°C/分 · 9:00");

const paint = (roast) => { controller.update({ ...base, roast, phase: "development" }); return container.beans.find((b) => !b.classList.contains("rm-green")).getAttribute("fill"); };
const green = paint(0), dark = paint(1);
assert.notEqual(green, dark, "sight-glass beans change colour with roast");
assert.equal(green.toLowerCase(), "#9aa86a");
assert.equal(dark.toLowerCase(), "#3b2416");

controller.update({ ...base, phase: "cooling", t: 1.2 });
assert.equal(node("cooling-beans").getAttribute("display"), "inline");
assert.equal(node("window-beans").getAttribute("display"), "none");
assert.notEqual(angle(node("cooling-arm")), 0);
controller.update({ ...base, phase: "idle", t: 10 });
assert.equal(node("hopper-beans").getAttribute("display"), "inline");
assert.equal(angle(node("drum-vanes")), 0, "idle vanes do not turn");
assert.equal(angle(node("drum-spokes")), 0);
controller.update({ ...base, phase: "maillard", t: 0 });
const a0 = angle(node("drum-vanes"));
controller.update({ ...base, phase: "maillard", t: 0.45 });
assert.notEqual(a0, angle(node("drum-vanes")), "vane angle follows t");
assert.notEqual(a0, angle(node("drum-spokes")));

const before = container.markup;
container.svg.setAttribute("data-kept", "yes");
assert.doesNotThrow(() => controller.update({}));
assert.equal(container.markup, before, "update does not rebuild the svg");
assert.equal(container.svg.getAttribute("data-kept"), "yes");
assert.equal(node("bean-screen").textContent, "200.0°C");
assert.equal(node("ror-screen").textContent, "0.0°C/分");
assert.equal(node("elapsed-screen").textContent, "0:00");

assert.equal(container.svg.getAttribute("aria-label"), "會動的烘豆機剖面圖");
assert.equal(container.iso.getAttribute("data-theme"), null);
htmlClass.delete("dark"); mutationCallback();
assert.equal(container.iso.getAttribute("data-theme"), "light");
htmlClass.add("dark"); mutationCallback();
assert.equal(container.iso.getAttribute("data-theme"), null);

const other = new ContainerStub();
machine.mount(other, { lang: "en" });
assert.match(other.markup, /A coffee roaster, opened up/);
assert.equal(other.svg.getAttribute("aria-label"), "Animated cutaway coffee roaster");
other.querySelector(`[data-part="bean-screen"]`);
const otherCtrl = machine.mount(other, { lang: "en" });
otherCtrl.update({ ...base, bean: 201.2, ror: 4, elapsed: "8:42" });
assert.equal(other.querySelector(`[data-part="ror-screen"]`).textContent, "4.0°C/min");
assert.equal(node("ror-screen").textContent, "0.0°C/分", "a second mount does not rewrite the first");
assert.match(container.markup, /烘豆機，打開來看/);

console.log("roaster machine tests passed: version, flame linearity, damper, screens, readout, roast colour, cooling, idle hopper, vane angle, defaults, locale, theme, two mounts");
