import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

class NodeStub {
  constructor(attrs = {}) {
    this.attrs = { ...attrs };
    this.textContent = "";
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
}

class SvgStub extends NodeStub {
  constructor(markup) {
    super({ "aria-label": "" });
    this.nodes = new Map();
    for (const match of markup.matchAll(/<[^>]*data-part="([^"]+)"[^>]*>/g)) {
      const tag = match[0];
      const attrs = {};
      for (const pair of tag.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      if (!this.nodes.has(`[data-part="${match[1]}"]`)) this.nodes.set(`[data-part="${match[1]}"]`, new NodeStub(attrs));
    }
    this.particles = Array.from(markup.matchAll(/<circle class="em-particle"[^>]*>/g), (match) => {
      const attrs = {};
      for (const pair of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[pair[1]] = pair[2];
      return new NodeStub(attrs);
    });
    this.labels = Array.from(markup.matchAll(/<text[^>]*data-en="([^"]*)" data-zh="([^"]*)"[^>]*>/g), (match) => new NodeStub({ "data-en": match[1], "data-zh": match[2] }));
  }
  querySelector(selector) { return selector === "svg" ? this : this.nodes.get(selector) ?? null; }
  querySelectorAll(selector) { return selector === ".em-particle" ? this.particles : selector === ".em-label text" ? this.labels : []; }
}

class ContainerStub {
  constructor(width = 640) { this.clientWidth = width; this.markup = ""; }
  set innerHTML(markup) { this.markup = markup; this.svg = new SvgStub(markup); }
  querySelector(selector) { return selector === "svg" ? this.svg : null; }
}

const commonjs = { exports: {} };
runInNewContext(readFileSync(new URL("../public/espresso-machine.js", import.meta.url), "utf8"), { module: commonjs, globalThis: {} });
const machine = commonjs.exports;
assert.equal(typeof machine.mount, "function");
assert.equal(typeof machine.VERSION, "string");

const container = new ContainerStub();
const controller = machine.mount(container, { lang: "zh" });
const svg = container.svg;
const node = (part) => svg.querySelector(`[data-part="${part}"]`);
const base = { grind: 300, temp: 93.5, pressure: 9, flow: 4, cup: 0, t: 0, shotTime: 0, channel: 0.1, zone: "balanced" };

controller.update(base);
const angle9 = Number(node("pressure-needle").getAttribute("transform").match(/rotate\(([-\d.]+)/)[1]);
controller.update({ ...base, pressure: 11 });
const angle11 = Number(node("pressure-needle").getAttribute("transform").match(/rotate\(([-\d.]+)/)[1]);
assert.notEqual(angle9, angle11);
assert.equal((angle11 - angle9) / (11 - 9), 20);
assert.equal(node("temp-value").textContent, "93.5°C");
assert.equal(node("pressure-value").textContent, "11.0 bar");
assert.equal(node("cup-value").textContent, "0.0 g");

const cup0 = node("cup-liquid").getAttribute("d");
controller.update({ ...base, cup: 36 });
assert.notEqual(node("cup-liquid").getAttribute("d"), cup0);
assert.equal(node("cup-value").textContent, "36.0 g");

controller.update({ ...base, grind: 200 });
const fineRadius = Number(svg.particles[0].getAttribute("r"));
const fineVisible = svg.particles.filter((particle) => particle.getAttribute("data-hidden") === "false").length;
controller.update({ ...base, grind: 400 });
const coarseRadius = Number(svg.particles[0].getAttribute("r"));
const coarseVisible = svg.particles.filter((particle) => particle.getAttribute("data-hidden") === "false").length;
assert.notEqual(fineRadius, coarseRadius);
assert.ok(fineRadius < coarseRadius);
assert.ok(fineVisible > coarseVisible);

controller.update({ ...base, channel: 0.1 });
assert.equal(node("channel-cracks").getAttribute("opacity"), "0");
controller.update({ ...base, channel: 0.5 });
assert.equal(node("channel-cracks").getAttribute("opacity"), "1");

assert.match(node("flow-stream").getAttribute("stroke-width"), /^\d/);
assert.equal(svg.getAttribute("aria-label"), "會動的義式咖啡機剖面圖");

const bounds = {
  "water-tank": [149, 90, 247, 230], boiler: [206, 126, 288, 235], pump: [277, 181, 317, 235],
  "gauge-label": [390, 59, 478, 147], "group-label": [206, 239, 255, 277],
  "puck-label": [216, 257, 248, 273], "cup-label": [198, 304, 286, 381],
};
for (const match of container.markup.matchAll(/<g class="em-label ([^"]*)" data-label="([^"]+)" data-anchor-x="([\d.]+)" data-anchor-y="([\d.]+)">/g)) {
  const [, , part, xText, yText] = match;
  const [left, top, right, bottom] = bounds[part];
  const x = Number(xText), y = Number(yText);
  assert.ok(x >= left && x <= right && y >= top && y <= bottom, `${part} leader endpoint (${x}, ${y}) outside its part`);
}

const mobileContainer = new ContainerStub(360);
machine.mount(mobileContainer, { lang: "en" });
assert.equal(mobileContainer.svg.getAttribute("data-mobile"), "true");
assert.match(mobileContainer.svg.getAttribute("style"), /--em-mobile-font:19\.56px/);
assert.equal(Array.from(mobileContainer.markup.matchAll(/<g class="em-label (?![^"]*em-mobile-hide)[^"]*"/g)).length, 4);
assert.equal(Array.from(mobileContainer.markup.matchAll(/data-part="(?:temp-value|pressure-value|cup-value)"/g)).length, 3);

console.log("espresso machine tests passed: pressure, readings, cup, grind, channel, flow, locale, leaders, and mobile");
