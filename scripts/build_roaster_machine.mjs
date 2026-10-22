import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./vendor/jixietu/iso-kit.mjs";
import * as G from "./vendor/jixietu/lathe.mjs";
import { tubePieces, tubeSvg } from "./vendor/jixietu/tube.mjs";
import * as A from "./vendor/jixietu/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "roaster-machine.js");
const TEMP = "D:/Temp/claude/roaster_jixietu";
const W = 640, H = 430;
// Open right side toward the camera: drum, burner, front window, cooling tray.
const azimuth = 48, elevation = 28;
const WORLD = { x: -8, y: -6, w: 176, d: 128, r: 6 };
const fitted = k.fitProjection(k.boxCorners(WORLD, -8, 124), W, H, { pad: 28, azimuth, elevation });
const lift = 1.08;
const P = {
  azimuth, elevation,
  scale: fitted.scale * lift,
  origin: [W / 2 - (W / 2 - fitted.origin[0]) * lift, H / 2 - (H / 2 - fitted.origin[1]) * lift],
};
const R = A.recorder(P, { ground: () => true });
const at = (p) => k.iso(p, P);
const L = (d, o = {}) => k.lineSvg(d, o);
const D = (p, o = {}) => k.dotsSvg(p, o);

// Painter slots, back to front. Solids go through the recorder; overlays keep these names.
const DRAW_SLOTS = ["halo", "base", "frame", "drum", "drive", "heat", "exhaust", "hopper", "cool", "panel", "overlay"];

let solidCount = 0;
const S = (name, paths, o = {}, shape = null, centre = null, extra = "") => {
  solidCount++;
  const cut = name === "drum.shell" ? ` class="rm-cutaway"` : "";
  const litBeans = name === "beans.window" ? ` class="rm-beans" data-part="window-bean-body" data-lit` : "";
  const lever = name === "damper.lever" ? ` data-part="damper-lever"` : "";
  const arm = name === "cool.arm" ? ` data-part="cooling-arm"` : "";
  const svg = `<g${cut}${litBeans}${lever}${arm}>${k.solidSvg(paths, { ...o, lit: o.lit || name === "beans.window" })}${extra}</g>`;
  if (shape) { R.solid(shape); R.put({ name, at: centre, svg, shapes: [shape], piece: "machine" }); }
  return "";
};
const slab = (n, p, z, h, tone = "mid", bevel = 0.6) => {
  const steps = Math.max(3, Math.round(p.r || 3));
  return S(n, k.slabOf(p, z, h, P, steps, bevel), { tone }, A.slab(p, z, h, { name: n, owner: "machine" }, steps), [p.x + p.w / 2, p.y + p.d / 2, z + h / 2]);
};
const cyl = (n, x, y, r, z, h, tone = "mid", steps = 12, lit = false) => {
  const F = G.frameAlong([x, y, z], [0, 0, 1]);
  return S(n, k.cylinder(x, y, r, z, h, P, steps, Math.min(0.45, h / 5)), { tone, lit }, A.disc(F, 0, h, r, { name: n, owner: "machine" }), [x, y, z + h / 2]);
};
const lathe = (n, o, a, profile, tone = "mid", options = {}) => {
  const F = G.frameAlong(o, a), mid = (profile[0][0] + profile.at(-1)[0]) / 2;
  return S(n, G.lathe(profile, F, P, { steps: 16, ...options }), { tone }, A.solid(F, profile, { name: n, owner: "machine" }), G.add3(o, G.mul3(a, mid)));
};
const screw = (n, x, y, z) => cyl(n, x, y, 1.15, z, 1.1, "hi", 10);

const ROUTE_TOUCH = {
  "gas.line": ["gas.valve", "gas.collar"],
  "stack.pipe": ["cyclone.body", "stack.cap"],
  "belt.run": ["drive.pulley", "drive.motor-pulley"],
};
const pipe = (n, points, radius = 1.2, tone = "hi") => {
  const route = G.fillet(points, Math.max(3.2, radius * 3), 6, { P, tube: radius });
  R.route(n, route, radius, { piece: "machine", limp: false, touch: ROUTE_TOUCH[n], ends: [false, false], free: [true, true] });
  tubePieces(route, radius, P, { maxLength: 18, spacing: Math.max(0.7, Math.min(1.15, radius)) }).forEach((piece, i) => {
    const svg = `<g${i === 0 ? ` data-part="${n}"` : ""}>${tubeSvg(piece, { tone })}</g>`;
    R.put({ name: `${n}:${i}`, at: piece.mid, svg, shapes: [A.tube(piece.points, piece.radii)], route: n, chunk: i, piece: "machine" });
  });
};

const out = [];
const overlay = [];
const BASE = { x: 0, y: 0, w: 148, d: 82, r: 6 };
out.push(`<path class="iso-halo" d="${k.haloOf(BASE, -8, 14, P)}"/>`);
for (const [i, [x, y]] of k.corners(BASE, 14).entries()) {
  cyl(`base.pad.${i}`, x, y, 6.2, -7, 1.6, "lo");
  cyl(`base.foot.${i}`, x, y, 4.2, -5.2, 5.2, "lo");
}
slab("base.plate", BASE, 0, 7, "mid", 1.1);
for (const [i, [x, y]] of k.corners(BASE, 12).entries()) screw(`base.screw.${i}`, x, y, 7.15);

const NP = { x: 46, y: 82.4, w: 36, d: 1.6, r: 0.4 };
slab("base.nameplate", NP, 1.6, 4.2, "hi", 0.3);
out.push(Array.from({ length: 3 }, (_, i) => L(k.lineOnTop([NP.x + 4, NP.y + 0.5], [NP.x + 22 + i * 3, NP.y + 0.5], 2.3 + i * 1.15, P), { tone: i ? "faint" : "lo", free: true })).join(""));

// Left wall stays; the right wall is off so the drum and flame stay in view.
slab("frame.side", { x: 2, y: 8, w: 5, d: 66, r: 1 }, 7.2, 76, "lo", 0.5);
slab("frame.back", { x: 10, y: 3, w: 112, d: 5, r: 1 }, 7.2, 64, "lo", 0.5);
for (const [i, [x, y]] of [[18, 16], [120, 16], [18, 64]].entries()) cyl(`frame.post.${i}`, x, y, 2.3, 7.3, 70, "mid", 12);

// Drum along X. Front cap, spokes and sight glass face the camera.
lathe("drum.shell", [30, 44, 54], [1, 0, 0], [[0, 17], [78, 17]], "mid");
lathe("drum.cap", [22, 44, 54], [1, 0, 0], [[0, 18], [3.2, 18]], "hi");
lathe("drum.rear", [110.5, 44, 54], [1, 0, 0], [[0, 16], [2.6, 16]], "mid");
lathe("drum.bezel", [16.4, 44, 54], [1, 0, 0], [[0, 12.5], [1.5, 12.5]], "hi");
lathe("beans.window", [12.2, 44, 54], [1, 0, 0], [[0, 3.2], [1.4, 3.2]], "hi");
lathe("drum.axle", [113.4, 44, 54], [1, 0, 0], [[0, 2.2], [8, 2.2]], "hi");
for (const [i, a] of [0, 90, 180, 270].entries()) {
  const y = 44 + Math.cos(a * Math.PI / 180) * 14;
  const z = 54 + Math.sin(a * Math.PI / 180) * 14;
  cyl(`drum.screw.${i}`, 15.2, y, 0.85, z - 0.4, 0.9, "hi", 8);
}

lathe("drive.pulley", [122.2, 44, 54], [1, 0, 0], [[0, 7.2], [3.4, 7.2]], "mid");
lathe("drive.motor-pulley", [132.4, 44, 46], [1, 0, 0], [[0, 4.2], [2.8, 4.2]], "hi");
cyl("drive.motor", 140, 44, 7.2, 34, 22, "mid", 16);
for (const i of [0, 1, 2, 3, 4]) slab(`drive.fin.${i}`, { x: 148.2, y: 38 + i * 2.6, w: 1.3, d: 1.6, r: 0.2 }, 38, 16, "lo", 0.2);
cyl("drive.motor-cap", 140, 44, 3.2, 56.2, 2.2, "hi", 12);

// Burner under the open side, gas train behind it, gauge needle is static.
slab("heat.burner", { x: 36, y: 34, w: 64, d: 18, r: 1.2 }, 24, 4.2, "lo", 0.4);
for (const i of [0, 1, 2, 3, 4, 5]) cyl(`heat.port.${i}`, 44 + i * 9, 43, 1.05, 28.4, 1.5, "hi", 8);
for (const [i, x] of [40, 90].entries()) cyl(`heat.leg.${i}`, x, 36, 1.15, 7.4, 16.2, "mid", 8);
cyl("gas.valve", 24, 28, 2.4, 14, 4.2, "hi", 12);
lathe("gas.collar", [34, 28, 17], [1, 0, 0], [[0, 2.1], [2.2, 2.1]], "hi");
cyl("gas.knob", 24, 28, 1.7, 18.4, 2.4, "mid", 10);

// Cyclone and stack sit behind the drum, clear of the shell.
lathe("cyclone.body", [102, 18, 62], [0, 0, 1], [[0, 9, 1], [8, 7.2, 1], [18, 3.1, 1]], "mid", { smooth: true });
lathe("cyclone.lid", [102, 18, 80.6], [0, 0, 1], [[0, 3.4], [1.6, 3.4]], "hi");
lathe("stack.cap", [102, 18, 120], [0, 0, 1], [[0, 2.6], [1.8, 2.6]], "hi");
slab("damper.body", { x: 108.5, y: 16.2, w: 3.2, d: 7.2, r: 0.4 }, 96, 2.2, "mid", 0.3);
slab("damper.lever", { x: 112.2, y: 18.6, w: 12, d: 1.8, r: 0.3 }, 96.2, 1.6, "hi", 0.25);

// Hopper above the drum. Green beans are an overlay, only while idle.
lathe("hopper.cone", [62, 44, 82], [0, 0, 1], [[0, 5], [3, 13, 1], [14, 15, 1]], "mid", { smooth: true });
lathe("hopper.collar", [62, 44, 78.4], [0, 0, 1], [[0, 4.2], [3.2, 4.2]], "hi");
slab("hopper.gate", { x: 66, y: 41.2, w: 8, d: 1.5, r: 0.3 }, 76.2, 2.4, "hi", 0.25);
cyl("hopper.pin", 74.6, 42, 0.7, 78.8, 2.2, "hi", 8);

// Cooling tray in front, empty except while cooling.
slab("cool.shelf", { x: 42, y: 82.6, w: 52, d: 20, r: 2 }, 4, 3.6, "lo", 0.4);
cyl("cool.tray", 68, 94, 15, 7.8, 3.2, "mid", 20);
cyl("cool.mesh", 68, 94, 12.2, 11.1, 0.7, "lo", 16);
cyl("cool.hub", 68, 94, 2.6, 11.9, 2.4, "hi", 10);
slab("cool.door", { x: 80.5, y: 102.4, w: 8, d: 1.6, r: 0.3 }, 8.2, 3.4, "hi", 0.25);
slab("cool.arm", { x: 66.2, y: 80.5, w: 3.4, d: 16, r: 0.4 }, 14.6, 1.2, "hi", 0.2);

// Front door, tryer, and the right-front control panel.
slab("front.door", { x: 32, y: 63.2, w: 18, d: 2.4, r: 0.5 }, 44, 16, "mid", 0.4);
cyl("front.handle", 41, 66.2, 1.15, 50, 5, "hi", 8);
cyl("tryer.port", 56, 64.4, 1.5, 49, 2.2, "lo", 10);
lathe("tryer.spoon", [56, 66.8, 50.2], [0, 1, 0], [[0, 1.1], [7, 1.1]], "hi");
cyl("tryer.grip", 56, 74.2, 1.5, 49.2, 3.4, "mid", 8);
slab("panel.body", { x: 114, y: 66, w: 30, d: 5, r: 1 }, 22, 46, "mid", 0.6);
cyl("panel.knob", 124, 69.2, 3.1, 68.3, 3.2, "hi", 12);
cyl("panel.switch", 136, 69.2, 1.8, 68.3, 2.4, "mid", 10);
cyl("panel.lamp", 142, 69.4, 1.15, 30, 2.2, "hi", 8);

pipe("gas.line", [[36.4, 28, 17], [70, 28, 17], [86, 30, 20]], 1.15);
pipe("belt.run", [[126.2, 50.2, 56], [132.2, 49.2, 49]], 0.85, "mid");
pipe("stack.pipe", [[102, 18, 84.6], [102, 18, 100], [102, 18, 119.6]], 1.7);

const flameAt = at([62, 43, 30]);
const fx = flameAt[0].toFixed(2), fy = flameAt[1].toFixed(2);
overlay.push(`<g data-part="flame" data-flame="true" opacity="0.7" transform="translate(${fx} ${fy}) scale(1 0.700) translate(${-fx} ${-fy})">${[0, 1, 2, 3, 4].map((i) => {
  const p = at([46 + i * 8, 43, 30]);
  const tip = at([46 + i * 8, 43, 48]);
  return `<path class="rm-flame" d="M${(p[0] - 3).toFixed(2)} ${p[1].toFixed(2)} L${tip[0].toFixed(2)} ${tip[1].toFixed(2)} L${(p[0] + 3).toFixed(2)} ${p[1].toFixed(2)} Z"/>`;
}).join("")}</g>`);

const cap = at([20, 44, 54]);
const vane = (ang, len) => {
  const y = 44 + Math.cos(ang) * len, z = 54 + Math.sin(ang) * len;
  const a = at([21.2, y, z]);
  return `<line x1="${cap[0].toFixed(2)}" y1="${cap[1].toFixed(2)}" x2="${a[0].toFixed(2)}" y2="${a[1].toFixed(2)}" />`;
};
overlay.push(`<g data-part="drum-spokes" transform="rotate(0 ${cap[0].toFixed(2)} ${cap[1].toFixed(2)})">${[0, 72, 144, 216, 288].map((d) => vane(d * Math.PI / 180, 9)).join("")}<circle cx="${cap[0].toFixed(2)}" cy="${cap[1].toFixed(2)}" r="2.2"/></g>`);
overlay.push(`<g data-part="drum-vanes" transform="rotate(0 ${cap[0].toFixed(2)} ${cap[1].toFixed(2)})">${[30, 150, 270].map((d) => {
  const a = d * Math.PI / 180;
  const p = at([21.4, 44 + Math.cos(a) * 6, 54 + Math.sin(a) * 6]);
  return `<ellipse class="rm-vane" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" rx="4.2" ry="1.3" transform="rotate(${d} ${p[0].toFixed(2)} ${p[1].toFixed(2)})"/>`;
}).join("")}</g>`);
const beans = (n, spread, part, cls) => Array.from({ length: n }, (_, i) => {
  const a = i * 2.399, r = spread * (0.25 + (i % 5) / 6);
  const p = at([21.6, 44 + Math.cos(a) * r, 54 + Math.sin(a) * r * 0.72]);
  return `<ellipse class="rm-bean ${cls}" data-bean="true" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" rx="2.1" ry="1.25" transform="rotate(${(i * 47) % 180} ${p[0].toFixed(2)} ${p[1].toFixed(2)})"/>`;
}).join("");
overlay.push(`<g data-part="window-beans" data-lit-beans="true">${beans(14, 6.5, "window", "rm-window-bean")}</g>`);
overlay.push(`<g data-part="crack-sparks" opacity="0">${[0, 1, 2, 3].map((i) => {
  const p = at([24, 44 + (i - 1.5) * 3.2, 62]);
  return `<circle class="rm-spark" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="${1.1 + (i % 2) * 0.4}"/>`;
}).join("")}</g>`);

const hop = at([62, 44, 92]);
overlay.push(`<g data-part="hopper-beans">${[0, 1, 2, 3, 4, 5].map((i) => {
  const p = at([62 + (i % 3 - 1) * 4, 44 + (i % 2) * 3, 90 - (i % 3)]);
  return `<ellipse class="rm-bean rm-green" cx="${(p[0]).toFixed(2)}" cy="${p[1].toFixed(2)}" rx="2" ry="1.2" transform="rotate(${i * 30} ${p[0].toFixed(2)} ${p[1].toFixed(2)})"/>`;
}).join("")}</g>`);

const coolC = at([68, 94, 13.2]);
overlay.push(`<g data-part="cooling-beans" display="none">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
  const a = i / 8 * Math.PI * 2;
  const p = at([68 + Math.cos(a) * 7, 94 + Math.sin(a) * 7, 13.4]);
  return `<ellipse class="rm-bean rm-cool-bean" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" rx="2" ry="1.2" transform="rotate(${i * 20} ${p[0].toFixed(2)} ${p[1].toFixed(2)})"/>`;
}).join("")}</g>`);

const smokeAt = at([102, 18, 124]);
overlay.push(`<g data-part="smoke" opacity="0">${[0, 1, 2].map((i) => `<circle class="rm-smoke" cx="${(smokeAt[0] + i * 4 - 4).toFixed(2)}" cy="${(smokeAt[1] - i * 7).toFixed(2)}" r="${2.2 + i}"/>`).join("")}</g>`);

const face = (x, z) => {
  const c = at([x, 71.2, z]);
  const ex = at([x + 1, 71.2, z]);
  const ez = at([x, 71.2, z - 1]);
  return { c, a: [ex[0] - c[0], ex[1] - c[1]], b: [ez[0] - c[0], ez[1] - c[1]] };
};
// Two readouts share the panel's front face (same X/Z plane as the slab front).
// Width is the inset front; height stacks them clear of the knobs and the gauge.
// Font fits the longer runtime string "-12.5°C/分" (8 narrow glyphs + 1 full-width).
const screenW = 26.4;
const screenH = 6.4;
const screenX = 114 + (30 - screenW) / 2;
const screenFont = (() => {
  const f = face(screenX + screenW / 2, 56);
  const pixelW = Math.abs(f.a[0]) * screenW;
  const pixelH = Math.abs(f.b[1]) * screenH;
  // ui-monospace on Windows is about 0.72em per glyph, plus the face's letter-spacing.
  const ems = 9 * 0.72 + 9 * 0.04;
  return Math.min(pixelH * 0.62, (pixelW * 0.86) / ems);
})();
const screen = (part, x, z, sample) => {
  const f = face(x, z);
  const m = `matrix(${[...f.a, ...f.b, ...f.c].map((v) => v.toFixed(2)).join(" ")})`;
  return `<g class="rm-screen" data-part="${part}-window"><g transform="${m}"><rect x="${(-screenW / 2).toFixed(2)}" y="${(-screenH / 2).toFixed(2)}" width="${screenW.toFixed(2)}" height="${screenH.toFixed(2)}" rx="0.5"/></g><text data-part="${part}" class="iso-face-text rm-readout" x="${f.c[0].toFixed(2)}" y="${(f.c[1] + screenFont * 0.34).toFixed(2)}">${sample}</text></g>`;
};
overlay.push(screen("bean-screen", screenX + screenW / 2, 58.2, "203.0°C"));
overlay.push(screen("ror-screen", screenX + screenW / 2, 50.4, "9.5°C/分"));
const elapsedAt = at([142, 71.2, 40]);
overlay.push(`<text data-part="elapsed-screen" class="iso-face-text rm-elapsed" x="${elapsedAt[0].toFixed(2)}" y="${elapsedAt[1].toFixed(2)}">0:00</text>`);

const g = face(128, 36);
const gauge = `matrix(0.72 0 0 0.72 ${g.c[0].toFixed(2)} ${g.c[1].toFixed(2)})`;
overlay.push(`<g data-part="gas-gauge" transform="${gauge}"><circle class="rm-gauge-rim" r="14"/><circle class="rm-gauge-face" r="12"/>${Array.from({ length: 9 }, (_, i) => {
  const a = (-200 + i * 28) * Math.PI / 180;
  const r0 = i % 2 ? 8.2 : 7;
  return `<path class="iso-line rm-tick" data-tone="${i % 2 ? "lo" : "mid"}" d="M${(Math.cos(a) * r0).toFixed(2)} ${(Math.sin(a) * r0).toFixed(2)}L${(Math.cos(a) * 11.2).toFixed(2)} ${(Math.sin(a) * 11.2).toFixed(2)}"/>`;
}).join("")}<path data-part="gas-needle" class="iso-line rm-needle" data-tone="hi" data-free="start" d="M-1.2 0.4L9.5 0" transform="rotate(-70)"/><circle class="rm-hub" r="1.6"/></g>`);

const mesh = Array.from({ length: 4 }, (_, i) => L(k.planOutline({ x: 58 + (i % 2) * 8, y: 88 + Math.floor(i / 2) * 8, w: 5, d: 5, r: 1.2 }, 11.9, P, 6), { tone: "lo" })).join("");
out.push(mesh);

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const settledBody = [out[0], ...R.items.map((item) => item.svg), ...out.slice(1), ...overlay].join("");
const svg = k.figureSvg({
  width: W, height: H,
  label: "側板拆開的小型滾筒烘豆機，看得到滾筒、燃燒器、觀察窗、風門與前方冷卻盤。",
  body: settledBody,
});

const extraCss = `.rs-machine{min-height:0;max-width:100%}.rs-machine>.iso{width:100%;max-width:640px;--anatomy-card:var(--paper,#171717);--anatomy-page:var(--paper,#171717)}.rs-machine .iso-plate{width:100%;box-sizing:border-box;padding:28px 8px 36px}.rs-machine .iso-svg{width:100%;height:auto;overflow:visible;display:block}.rs-machine .iso-swatch{width:16px;height:10px;flex:none}.rs-machine .iso-plate-corners{inset:8px 12px}.rm-cutaway>.iso-fill,.rm-cutaway>.iso-top,.rm-cutaway>.iso-shade{opacity:.4}.rm-flame{fill:#d97706;stroke:#d97706;stroke-width:.6;stroke-linejoin:round}.rm-bean{fill:#9aa86a;stroke:#3b2416;stroke-width:.35}.rm-spark{fill:#d97706;stroke:none}.rm-smoke{fill:none;stroke:var(--anatomy-hi);stroke-width:1.2}.rm-screen rect{fill:#141210;stroke:var(--anatomy-hi);stroke-width:1}.rm-readout{fill:#f5b84a;font:600 ${screenFont.toFixed(2)}px ui-monospace,Consolas,monospace;text-anchor:middle}.rm-elapsed{fill:var(--anatomy-mid);font:600 5px ui-monospace,Consolas,monospace;text-anchor:middle}.rm-gauge-rim{fill:var(--anatomy-face);stroke:var(--anatomy-hi);stroke-width:1.6}.rm-gauge-face{fill:#f4f1e8;stroke:var(--anatomy-mid);stroke-width:.8}.rm-tick{stroke-width:.7}.rm-needle{stroke-width:1.3}.rm-hub{fill:#1f1f1f}.rs-machine [data-part="drum-spokes"]{stroke:var(--anatomy-hi);stroke-width:1.1;fill:none}.rs-machine [data-part="drum-spokes"] circle{fill:var(--anatomy-hi);stroke:none}@media(max-width:420px){.rs-machine .iso-plate{padding:22px 4px 34px}.rs-machine .iso-plate-corner{font-size:10px}.rs-machine .iso-plate-corner[data-corner="title"]{font-size:12px}.rs-machine .iso-keys,.rs-machine .iso-caption{font-size:11px}}`;
const copy = {
  zh: {
    title: "烘豆機，打開來看",
    hint: "拖下面的滑桿，機器跟著動",
    keys: ["觀察窗豆子", "滾筒", "火焰", "風門", "冷卻盤"],
    caption: "火越大、風門越小，豆子升溫越快；觀察窗裡的豆色，就是下方曲線同一時刻的烘焙程度。",
  },
  en: {
    title: "A coffee roaster, opened up",
    hint: "Drag the sliders below; the machine follows",
    keys: ["Sight-glass beans", "Drum", "Flame", "Air damper", "Cooling tray"],
    caption: "More fire and a smaller damper heat the beans faster; the colour in the sight glass is the roast level of the curve below at that same moment.",
  },
};
const card = (lang) => {
  const t = copy[lang];
  return `<div class="iso">${k.plateHtml({
    fig: "Fig 1", title: t.title, hint: t.hint, readout: "203.0°C · 9.5°C/分 · 0:00",
    keys: [
      { mark: "lit", label: t.keys[0] },
      { mark: "raised", label: t.keys[1] },
      { mark: "line", label: t.keys[2] },
      { mark: "dot", label: t.keys[3] },
      { mark: "raised", label: t.keys[4] },
    ],
    caption: t.caption,
    body: `<div class="iso-stage">${svg}</div>`,
  })}</div>`;
};
const css = (k.ISO_CSS + extraCss).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").trim();
const zhCard = card("zh").replace(/>\s+</g, "><").trim();
const pivot = `${cap[0].toFixed(2)} ${cap[1].toFixed(2)}`;
const coolPivot = `${coolC[0].toFixed(2)} ${coolC[1].toFixed(2)}`;
const damperPivot = `${at([112.2, 19.5, 97])[0].toFixed(2)} ${at([112.2, 19.5, 97])[1].toFixed(2)}`;
const runtime = `(function(root,factory){var api=factory();if(root)root.RoasterMachine=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){"use strict";var VERSION="1.0.0";var CSS=${JSON.stringify(css)};var CARD=${JSON.stringify(zhCard)};var EN=${JSON.stringify([[copy.zh.caption, copy.en.caption], [copy.zh.title, copy.en.title], [copy.zh.hint, copy.en.hint], ...copy.zh.keys.map((x, i) => [x, copy.en.keys[i]])])};function n(v,d){v=Number(v);return Number.isFinite(v)?v:d}function clamp(v,a,b){return Math.max(a,Math.min(b,v))}function beanColor(roast){var s=[[154,168,106],[214,180,58],[196,106,46],[107,58,34],[59,36,22]],u=clamp(roast,0,1)*4,i=Math.min(3,Math.floor(u)),f=u-i,c=s[i],d=s[i+1],h=function(k){return Math.round(c[k]+(d[k]-c[k])*f).toString(16).padStart(2,"0")};return "#"+h(0)+h(1)+h(2)}function mount(container,options){if(!container||typeof container.querySelector!=="function")throw new TypeError("RoasterMachine.mount requires a container");if(typeof document!=="undefined"&&!document.getElementById("roaster-machine-style")){var style=document.createElement("style");style.id="roaster-machine-style";style.textContent=CSS;document.head.appendChild(style)}var lang=options&&options.lang==="en"?"en":"zh",html=CARD;if(lang==="en")for(var i=0;i<EN.length;i++)html=html.split(EN[i][0]).join(EN[i][1]);if(container.classList)container.classList.add("rs-machine");container.innerHTML=html;var plate=container.querySelector(".iso"),svg=container.querySelector("svg"),q=function(p){return container.querySelector('[data-part="'+p+'"]')};function theme(){if(!plate||typeof document==="undefined")return;if(document.documentElement.classList.contains("dark"))plate.removeAttribute("data-theme");else plate.setAttribute("data-theme","light")}theme();var observer=null;if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){observer=new MutationObserver(theme);observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]})}if(svg)svg.setAttribute("aria-label",lang==="en"?"Animated cutaway coffee roaster":"會動的烘豆機剖面圖");function update(state){state=state||{};var t=n(state.t,0),power=clamp(n(state.power,70),0,100),air=clamp(n(state.airflow,50),0,100),bean=n(state.bean,200),ror=n(state.ror,0),roast=clamp(n(state.roast,0),0,1),phase=state.phase||"idle",crack=clamp(n(state.crack,0),0,1),elapsed=typeof state.elapsed==="string"?state.elapsed:"0:00";var spin=phase==="idle"?0:(t*360/0.9)%360;var el=q("drum-spokes");if(el)el.setAttribute("transform","rotate("+spin.toFixed(2)+" ${pivot})");el=q("drum-vanes");if(el)el.setAttribute("transform","rotate("+spin.toFixed(2)+" ${pivot})");el=q("flame");if(el){el.setAttribute("transform","translate(${fx} ${fy}) scale(1 "+(power/100).toFixed(4)+") translate(${-fx} ${-fy})");el.setAttribute("opacity",(0.15+0.85*power/100).toFixed(3))}el=q("damper-lever");if(el)el.setAttribute("transform","rotate("+((air*0.6).toFixed(2))+" ${damperPivot})");var unit=lang==="en"?"°C/min":"°C/分",beanText=bean.toFixed(1)+"°C",rorText=ror.toFixed(1)+unit;el=q("bean-screen");if(el)el.textContent=beanText;el=q("ror-screen");if(el)el.textContent=rorText;el=q("elapsed-screen");if(el)el.textContent=elapsed;el=container.querySelector("[data-readout]");if(el)el.textContent=beanText+" · "+rorText+" · "+elapsed;var color=beanColor(roast),nodes=container.querySelectorAll(".rm-bean");for(var b=0;b<nodes.length;b++){if(nodes[b].classList.contains("rm-green"))continue;nodes[b].setAttribute("fill",color)}var cooling=phase==="cooling",idle=phase==="idle";el=q("window-beans");if(el)el.setAttribute("display",cooling?"none":"inline");el=q("cooling-beans");if(el)el.setAttribute("display",cooling?"inline":"none");el=q("hopper-beans");if(el)el.setAttribute("display",idle?"inline":"none");el=q("cooling-arm");if(el)el.setAttribute("transform",cooling?"rotate("+((t*120)%360).toFixed(2)+" ${coolPivot})":"rotate(0 ${coolPivot})");var smoke=q("smoke"),sparks=q("crack-sparks");if(smoke)smoke.setAttribute("opacity",crack.toFixed(3));if(sparks)sparks.setAttribute("opacity",crack.toFixed(3))}update({});return{update:update,destroy:function(){if(observer)observer.disconnect()}}}return{mount:mount,VERSION:VERSION};});\n`;

mkdirSync(TEMP, { recursive: true });
writeFileSync(OUT, runtime, "utf8");
const previewState = "{t:540,power:70,airflow:50,bean:203,ror:9.5,roast:0.45,phase:'development',crack:0.6}";
const preview = (light) => `<!doctype html><html${light ? "" : ' class="dark"'}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{overflow-x:hidden;background:${light ? "#f0ede5" : "#101010"};--paper:${light ? "#f7f4ec" : "#171717"}}body{margin:0;padding:12px}.host{max-width:640px;width:100%;margin:auto}</style></head><body><div class="host"></div><script>${runtime.replace(/<\/script/gi, "<\\/script")}</script><script>RoasterMachine.mount(document.querySelector('.host'),{lang:'zh'}).update(${previewState});</script></body></html>`;
writeFileSync(join(TEMP, "preview.html"), preview(false), "utf8");
writeFileSync(join(TEMP, "preview-light.html"), preview(true), "utf8");
const raw = Buffer.byteLength(runtime);
const gz = gzipSync(runtime).length;
const sha = createHash("sha256").update(runtime).digest("hex");
const paths = (svg.match(/<path\b/g) || []).length;
console.log(`wrote ${OUT}`);
console.log(`sha256 ${sha}`);
console.log(`parts: ${solidCount} solids · ${paths} paths`);
console.log(`size: ${raw} bytes · ${gz} bytes gzip`);
console.log(`slots: ${DRAW_SLOTS.join(" ")}`);
if (process.argv.includes("--audit")) A.auditOrExit(R, P);
else console.log("audit skipped (pass --audit)");
