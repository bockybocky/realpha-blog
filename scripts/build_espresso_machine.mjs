import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./vendor/jixietu/iso-kit.mjs";
import * as G from "./vendor/jixietu/lathe.mjs";
import { tubePieces, tubeSvg } from "./vendor/jixietu/tube.mjs";
import * as A from "./vendor/jixietu/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "espresso-machine.js");
const TEMP = "D:/Temp/claude/espresso_jixietu";
const W = 640, H = 430;
// Look from the open-right/front corner: the service side and controls share the frame.
// The fitted box's back-top corner sits above every real part, so scale up from the
// chassis crown and pin that crown near the top of the card.
const azimuth = 54, elevation = 29;
const fitted = k.fitProjection(k.boxCorners({ x: -146, y: -64, w: 215, d: 136, r: 8 }, -14, 126), W, H, { pad: 16, azimuth, elevation });
// Screen y of the sole and the crown, divided by H, is the empty band. Scale so that span is 84% of H.
const CLOUD = [[-146, -64, -14], [69, -64, -14], [69, 72, 6], [-146, 72, 6], [-66, -51, 126], [62, 30, 126], [-109, -4, 123], [-26, 72, 26], [55, 46, 118], [-137, -38, 0]];
const unitCloud = CLOUD.map((p) => k.iso(p, { origin: [0, 0], scale: 1, azimuth, elevation }));
const ys = unitCloud.map((p) => p[1]), xs = unitCloud.map((p) => p[0]);
const fitScale = Math.min((H * 0.84) / (Math.max(...ys) - Math.min(...ys)), (W * 0.88) / (Math.max(...xs) - Math.min(...xs)));
const P = {
  azimuth, elevation,
  scale: fitScale,
  origin: [W / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * fitScale, H * 0.08 - Math.min(...ys) * fitScale],
};
const R = A.recorder(P, { ground: () => true });
const at = (p) => k.iso(p, P);
const L = (d, o = {}) => k.lineSvg(d, o);
const D = (p, o = {}) => k.dotsSvg(p, o);
let solidCount = 0;
const S = (name, paths, o = {}, shape = null, centre = null, extra = "") => {
  solidCount++;
  const hostClass = name === "tank.body" || name.startsWith("tank.wall") ? ` class="em-tank-shell"` : name === "grinder.hopper" ? ` class="em-hopper-glass"` : /^(portafilter\.basket|puck\.filter-wall)$/.test(name) ? ` class="em-filter-cutaway"` : "";
  const leverBallCentre = name === "group.lever-ball" ? at(centre) : null;
  const hostData = name === "group.lever-ball" ? ` data-lever="true" data-part="group.lever-ball" data-center-x="${leverBallCentre[0].toFixed(2)}" data-center-y="${leverBallCentre[1].toFixed(2)}" data-pivot-x="${leverPivotScreen[0].toFixed(2)}" data-pivot-y="${leverPivotScreen[1].toFixed(2)}"` : name === "group.lever-pivot" ? ` data-part="group.lever-pivot"` : "";
  const svg = `<g${hostClass}${hostData}>${k.solidSvg(paths, o)}${extra}</g>`;
  if (shape) { R.solid(shape); R.put({ name, at: centre, svg, shapes: [shape], piece: "machine" }); }
  return "";
};
const slab = (n, p, z, h, tone = "mid", bevel = .7, extra = "") => {
  const steps = Math.max(3, Math.round(p.r || 3));
  return S(n, k.slabOf(p, z, h, P, steps, bevel), { tone }, A.slab(p, z, h, { name: n, owner: "machine" }, steps), [p.x + p.w / 2, p.y + p.d / 2, z + h / 2], extra);
};
const cyl = (n, x, y, r, z, h, tone = "mid", steps = 12, lit = false) => {
  const F = G.frameAlong([x, y, z], [0, 0, 1]);
  return S(n, k.cylinder(x, y, r, z, h, P, steps, Math.min(.6, h / 4)), { tone, lit }, A.disc(F, 0, h, r, { name: n, owner: "machine" }), [x, y, z + h / 2]);
};
const lathe = (n, o, a, profile, tone = "mid", options = {}, extra = "") => {
  const F = G.frameAlong(o, a), mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const heroCurves = /^(grinder\.(lid|adjust-ring)|group\.mount|steam\.(knob|ball)|hotwater\.knob|portafilter\.collar|cup\.base)$/;
  const curveOptions = heroCurves.test(n) ? { steps: 18, smooth: true, ...options } : { steps: 12, ...options };
  return S(n, G.lathe(profile, F, P, curveOptions), { tone }, A.solid(F, profile, { name: n, owner: "machine" }), G.add3(o, G.mul3(a, mid)), extra);
};
const screw = (n, x, y, z) => cyl(n, x, y, 1.2, z, 1, "hi", 12);
const slot = (x, y, w, d, z) => L(k.planOutline({ x, y, w, d, r: Math.min(w, d) / 2 }, z, P, 6), { tone: "lo" });
const ROUTE_TOUCH = {
  "water.suction": ["tank.body", "water.suction-fitting"],
  "boiler.heater-u": ["boiler.shell"],
  "boiler.probe-wire": ["boiler.shell", "chassis.partition"],
  "water.pump-boiler": ["pump.outlet", "water.boiler-fitting", "boiler.shell", "chassis.partition", "boiler.flange", "boiler.right-head", "boiler.bolt.*", "pipe.clamp.0", "water.opv"],
  "water.boiler-group": ["water.group-fitting", "boiler.left-head", "boiler.shell", "group.mount", "pipe.clamp.2", "chassis.front-control"],
  "gauge.capillary": ["boiler.shell"],
  "group.lever": ["group.lever-pivot", "group.lever-ball", "chassis.front-control"],
  "portafilter.spout-l": ["portafilter.spout", "portafilter.spout-r"],
  "portafilter.spout-r": ["portafilter.spout", "portafilter.spout-l"],
  "steam.wand": ["steam.ball", "steam.nozzle"],
  "cup.handle": ["cup.body"],
};
const pipe = (n, points, radius = 1.25, tone = "hi", opt = {}) => {
  const route = G.fillet(points, Math.max(2.8, radius * 2.8), 8, { P, tube: radius });
  const total = G.pathLength(route);
  const gaps = [];
  if (opt.startGap) gaps.push([0, Math.min(total, opt.startGap)]);
  if (opt.endGap) gaps.push([Math.max(0, total - opt.endGap), total]);
  for (const gap of opt.gaps || []) gaps.push(gap);
  R.route(n, route, radius, { piece: "machine", limp: false, touch: ROUTE_TOUCH[n], ends: [false, false], free: n === "group.lever" ? [false, false] : [true, true] });
  tubePieces(route, radius, P, { maxLength: 16, spacing: Math.max(.65, Math.min(1.2, radius)), gaps }).forEach((piece, i) => {
    const hot = n === "boiler.heater-u" ? " em-hot" : "";
    const leverCentre = n === "group.lever" ? at(piece.mid) : null;
    const lever = n === "group.lever" ? ` data-lever="true" data-center-x="${leverCentre[0].toFixed(2)}" data-center-y="${leverCentre[1].toFixed(2)}" data-pivot-x="${leverPivotScreen[0].toFixed(2)}" data-pivot-y="${leverPivotScreen[1].toFixed(2)}"` : "";
    const svg = `<g${i === 0 ? ` data-part="${n}"` : ""}${lever}${hot ? ` data-heater="true" class="${hot.trim()}"` : ""}>${tubeSvg(piece, { tone })}</g>`;
    R.put({ name: `${n}:${i}`, at: piece.mid, svg, shapes: [A.tube(piece.points, piece.radii)], route: n, chunk: i, piece: "machine" });
  });
  return "";
};
const ferrule = (n, p, a, r = 2.3) => lathe(n, p, a, [[0, r * .75], [.5, r], [2.7, r], [3.2, r * .75]], "hi");
// Far side of a turned shell: the camera half is omitted so the bore stays open. Recorded as that same sector.
function farShell(profile, origin) {
  const F = G.frameAlong(origin, [1, 0, 0]);
  const V = G.viewOf(P);
  const cam = Math.atan2(G.dot3(V, F.v), G.dot3(V, F.u));
  const t0 = cam + Math.PI - 1.2, t1 = cam + Math.PI + 1.2, steps = 16;
  const edge = (s, r, t) => k.iso(G.pointOf(F, s, r, t), P);
  const ring = (s, r) => Array.from({ length: steps + 1 }, (_, j) => edge(s, r, t0 + (t1 - t0) * j / steps));
  let fill = "";
  for (let i = 0; i < profile.length - 1; i++) {
    const a = ring(profile[i][0], profile[i][1]), b = ring(profile[i + 1][0], profile[i + 1][1]);
    for (let j = 0; j < steps; j++) fill += k.pathOf([a[j], a[j + 1], b[j + 1], b[j]], true);
    for (const t of [t0, t1]) {
      const rIn0 = Math.min(14, profile[i][1]), rIn1 = Math.min(14, profile[i + 1][1]);
      fill += k.pathOf([edge(profile[i][0], rIn0, t), edge(profile[i][0], profile[i][1], t), edge(profile[i + 1][0], profile[i + 1][1], t), edge(profile[i + 1][0], rIn1, t)], true);
    }
  }
  const poly = [[0, 0]];
  for (let j = 0; j <= 14; j++) { const t = t0 + (t1 - t0) * j / 14; poly.push([Math.cos(t) * 21.6, Math.sin(t) * 21.6]); }
  return { paths: { fill, shades: ["", "", "", ""], top: "", outline: [t0, t1].map((t) => k.pathOf(profile.map(([s, r]) => edge(s, r, t)))).join("") + k.pathOf(ring(0, 19)) + k.pathOf(ring(profile.at(-1)[0], profile.at(-1)[1])), crease: "" }, shape: A.prism(F, poly, 0, profile.at(-1)[0], { name: "boiler.shell", owner: "machine" }), cam };
}
const out = [];

const BASE = { x: -146, y: -64, w: 215, d: 126, r: 8 };
out.push(`<path class="iso-halo" d="${k.haloOf(BASE, -14, 12, P)}"/>`);
for (const [i, [x, y]] of k.corners(BASE, 18).entries()) out.push(cyl(`base.flange.${i}`, x, y, 7, -14, 2, "lo"), cyl(`base.foot.${i}`, x, y, 5.5, -12, 4));
out.push(slab("base.bottom", BASE, -8, 8, "mid", 1.5, L(k.planOutline(k.insetPlan(BASE, 5), 0, P, 8), { tone: "lo" })));
for (const [i, [x, y]] of k.corners(BASE, 10).entries()) out.push(screw(`base.screw.${i}`, x, y, 0));
const NP = { x: -132, y: 45, w: 57, d: 12, r: 1.5 };
const nameplateLines = Array.from({ length: 3 }, (_, i) => L(k.lineOnTop([NP.x + 5, NP.y + 3 + i * 2.5], [NP.x + 33 + i * 7, NP.y + 3 + i * 2.5], .9, P), { tone: i ? "faint" : "lo", free: true })).join("");
out.push(slab("base.nameplate", NP, 0, .8, "lo", .2, nameplateLines));
const RULE = { x: -55, y: 51, w: 86, d: 7, r: 1 };
const rt = k.topTicks(RULE.x + 3, RULE.x + RULE.w - 3, 3, 5, RULE.y + .6, .55, [1.8, 3.4], P);
out.push(slab("base.ruler", RULE, 0, .55, "lo", .1, L(rt.minor, { tone: "lo" }) + L(rt.major, { tone: "mid" })));

// Open-right chassis, panels, seams, vents, fasteners and boiler cradles.
out.push(slab("chassis.floor", { x: -65, y: -51, w: 126, d: 96, r: 4 }, 0, 5));
out.push(slab("chassis.left", { x: -66, y: -51, w: 7, d: 96, r: 2 }, 5, 108));
const backSlots = Array.from({ length: 8 }, (_, i) => slot(-50 + i * 13, -51.3, 7, 1.2, 86)).join("");
out.push(slab("chassis.back", { x: -58.6, y: -51, w: 119.6, d: 6, r: 2 }, 5, 108, "mid", .7, backSlots));
// The front is a structural frame rather than a sealing slab: controls stay visible
// while the boiler, pump and water routes remain exposed through the service opening.
out.push(slab("chassis.front-left", { x: -65, y: 39, w: 8, d: 7, r: 2 }, 5, 108, "hi", 1));
out.push(slab("chassis.front-right", { x: 53, y: 39, w: 8, d: 7, r: 2 }, 5, 108, "hi", 1));
out.push(slab("chassis.front-control", { x: -57, y: 39, w: 110, d: 7, r: 2 }, 65, 48, "hi", 1, L(k.sideSeam({ x: -65, y: 39, w: 126, d: 7, r: 2 }, 105, P, 4), { tone: "lo" })));
out.push(slab("chassis.top", { x: -66, y: -51, w: 128, d: 97, r: 4 }, 113, 5, "hi", 1));
for (const [i, [x, y]] of [[-58, 43], [54, 43], [-58, 40], [54, 40]].entries()) out.push(screw(`front.screw.${i}`, x, y, 106));
for (const [i, [x, y]] of [[-61, -35], [-61, 25]].entries()) out.push(screw(`side.screw.${i}`, x, y, 74));
out.push(slab("chassis.partition", { x: 2.2, y: -44, w: 4, d: 55, r: 1 }, 5, 14, "lo", .3));
out.push(slab("boiler.cradle.l", { x: -49, y: -33, w: 8, d: 57, r: 2 }, 8, 9), slab("boiler.cradle.r", { x: -2, y: -33, w: 8, d: 57, r: 2 }, 8, 9));
out.push(slab("top.warming-tray", { x: -57, y: -42, w: 109, d: 75, r: 4 }, 118, 2, "lo", .4));
for (const [i, y] of [-30, 0, 30].entries()) {
  out.push(slab(`top.rail.${i}`, { x: -51, y, w: 97, d: 2.3, r: 1 }, 123, 3.2, "hi", .3));
  out.push(slab(`top.rail-bracket.${i}.l`, { x: -55, y: y - 2, w: 5, d: 6, r: 1 }, 120, 4, "mid", .3));
  out.push(slab(`top.rail-bracket.${i}.r`, { x: 46, y: y - 2, w: 5, d: 6, r: 1 }, 120, 4, "mid", .3));
}

// Reservoir, lid, handle, level marks and suction route.
const tankTicks = Array.from({ length: 5 }, (_, i) => L(k.lineOnTop([52, -34 + i * 7], [54.2, -34 + i * 7], 56, P), { tone: "lo", free: true })).join("");
out.push(slab("tank.wall.back", { x: 36.2, y: -43, w: 17.2, d: 1.6, r: .4 }, 11, 56, "hi", .3));
out.push(slab("tank.wall.left", { x: 35, y: -43, w: 1.6, d: 31, r: .4 }, 11, 56, "hi", .3, tankTicks));
out.push(slab("tank.wall.right", { x: 52.4, y: -43, w: 1.6, d: 31, r: .4 }, 11, 56, "hi", .3));
out.push(slab("tank.body", { x: 36.2, y: -15.2, w: 16.2, d: 1.6, r: .4 }, 19, 48, "hi", .3));
out.push(slab("tank.wall.front-low", { x: 36.2, y: -15.2, w: 16.2, d: 1.6, r: .4 }, 11, 4, "hi", .3));
out.push(slab("tank.floor", { x: 36.4, y: -41.4, w: 16, d: 26.4, r: 1 }, 8, 3, "mid", .3));
{
  const waterPlan = { x: 37.2, y: -40.6, w: 14.6, d: 24.6, r: 2 };
  const waterPaths = k.slabOf(waterPlan, 12, 34, P, 4, .3);
  const waterSvg = `<g data-part="tank.water" class="em-water">${k.solidSvg(waterPaths, { tone: "lo" })}</g>`;
  R.put({ name: "tank.water", at: [44.5, -28.3, 29], svg: waterSvg, shapes: [A.slab(waterPlan, 12, 34, { name: "tank.water", owner: "machine" }, 4)], piece: "machine" });
  solidCount++;
}
out.push(slab("tank.lid", { x: 33, y: -45, w: 24, d: 35, r: 4 }, 68, 3), slab("tank.handle", { x: 39, y: -35, w: 12, d: 15, r: 4 }, 71, 3, "hi"));
out.push(pipe("water.suction", [[44, -28, 48], [44, -28, 16], [44, -11.2, 16]], 1.1, "mid", { endGap: 3.3 }), ferrule("water.suction-fitting", [44, -11.2, 16], [0, 1, 0], 2.1));

// Smooth horizontal boiler with exposed heater and all service hardware.
{
  const profile = [[0, 19], [2, 21], [45, 21], [47, 19]];
  const shell = farShell(profile, [-45, -7, 58]);
  out.push(S("boiler.shell", shell.paths, { tone: "hi" }, shell.shape, [-21.5, -7, 58]));
  const cam = shell.cam, off = 15;
  const hy = -7 + Math.cos(cam) * off, hz = 58 + Math.sin(cam) * off;
  out.push(pipe("boiler.heater-u", [[-28, hy, hz], [0.4, hy, hz]], 1.5));
}
out.push(lathe("boiler.left-head", [-47, -7, 58], [-1, 0, 0], [[0, 13], [2, 20], [5, 21]], "mid", { smooth: true }));
out.push(lathe("boiler.right-head", [2, -7, 58], [1, 0, 0], [[0, 21], [3, 21], [6, 14]], "mid", { smooth: true, hole: [0, 18] }));
out.push(lathe("boiler.flange", [8.5, -7, 58], [1, 0, 0], [[0, 24], [3, 24]], "lo", { hole: [0, 18] }));
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; out.push(lathe(`boiler.bolt.${i}`, [11.7, -7 + Math.cos(a) * 21, 58 + Math.sin(a) * 21], [1, 0, 0], [[0, 1.35], [1.6, 1.35]], "hi", { steps: 12 })); }
out.push(lathe("boiler.probe", [-18, 12, 65], [0, -1, 0], [[0, 2.2], [4, 2.2], [14, 1]], "hi"));
out.push(pipe("boiler.probe-wire", [[-18, 14, 65], [-10, 22, 72], [9, 24, 76]], .65, "lo"));
out.push(slab("boiler.insulation", { x: -42, y: -29, w: 39, d: 45, r: 6 }, 16, 2, "lo"), slab("boiler.thermostat", { x: -30, y: -10, w: 13, d: 11, r: 3 }, 80, 5));

// Pump, rubber support, strap, over-pressure valve and terminated pipes.
const pumpStraps = L(k.sideArc(19, 4, 10, 42, P, 24), { tone: "lo" }) + L(k.sideArc(19, 4, 10, 47, P, 24), { tone: "lo" });
out.push(lathe("pump.body", [19, 4, 25], [0, 0, 1], [[0, 8], [3, 9], [28, 9], [31, 7]], "mid", { smooth: true }, pumpStraps));
out.push(lathe("pump.inlet", [19, 4, 23], [0, 0, -1], [[0, 3.2], [5, 3.2]], "hi"), lathe("pump.outlet", [19, 4, 56], [0, 0, 1], [[0, 3.2], [5, 3.2]], "hi"));
out.push(slab("pump.mount", { x: 8, y: -8, w: 22, d: 20, r: 5 }, 5, 4, "lo"));
out.push(pipe("water.pump-boiler", [[19, 4, 61], [19, -18, 73], [1, -23, 73], [-5, -7, 73]], 1.3), ferrule("water.boiler-fitting", [-5, -7, 73], [-1, 0, 0]));
out.push(lathe("water.opv", [19, -18, 73], [0, 0, 1], [[0, 3], [3, 5], [8, 5], [11, 2.5]], "mid"));
out.push(pipe("water.boiler-group", [[-45, -7, 71], [-55, 13, 79], [-45, 31, 83], [-26, 38, 83]], 1.45), ferrule("water.group-fitting", [-26, 38, 83], [1, 0, 0]));
out.push(pipe("gauge.capillary", [[-8, -2, 76], [5, 16, 91], [21, 36, 92]], .55, "lo"));
for (const [i, p] of [[19, -10, 70], [-34, 5, 76], [-45, 23, 82]].entries()) out.push(slab(`pipe.clamp.${i}`, { x: p[0] - 2, y: p[1] - 3, w: 4, d: 6, r: 1 }, p[2], 2, "lo", .2));

// E61 group, fins and lever, then portafilter in its reserved painter slot.
out.push(lathe("group.mount", [-26, 38, 80], [0, 1, 0], [[0, 13], [16, 13], [19, 10]], "mid"));
out.push(lathe("group.body", [-26, 56, 78], [0, 0, -1], [[0, 11], [4, 15], [13, 15], [18, 11], [30, 10]], "hi", { smooth: true }));
for (let i = 0; i < 5; i++) {
  const z = 72 - i * 5, F = G.frameAlong([-26, 56, z], [0, 0, -1]);
  const shape = A.ring(F, 0, 1.5, 15.1, 16, { name: `group.fin.${i}`, owner: "machine" });
  out.push(S(`group.fin.${i}`, G.ringBand(0, 1.5, 15.1, 16, F, P, { steps: 16 }), { tone: i ? "mid" : "hi" }, shape, [-26, 56, z - .75]));
}
out.push(lathe("group.shower", [-26, 56, 47], [0, 0, -1], [[0, 10], [2, 10]], "lo"));
const leverPivotScreen = at([-11, 71, 68]);
out.push(lathe("group.lever-pivot", [-11, 50, 68], [0, 1, 0], [[0, 3], [21, 3]]));
out.push(pipe("group.lever", [[-11, 79, 68], [-16, 81, 82], [-20, 82, 92]], 1.35), lathe("group.lever-ball", [-20, 82, 92], [0, 0, 1], [[0, 4], [4, 5], [8, 4]], "hi", { smooth: true }));
out.push(lathe("portafilter.collar", [-26, 56, 46], [0, 0, -1], [[0, 12], [2.8, 13], [5.8, 12]]), lathe("portafilter.basket", [-26, 56, 40.2], [0, 0, -1], [[0, 10.8], [5.7, 10], [9.7, 8]], "hi"));
out.push(lathe("portafilter.socket", [-15, 58, 43], [1, 0, 0], [[0, 3.5], [8, 3.5]]), lathe("portafilter.handle", [-7, 58, 43], [1, 0, 0], [[0, 4], [6, 5], [43, 5], [48, 3.5]], "hi", { smooth: true }));
out.push(lathe("portafilter.spout", [-26, 56, 31], [0, 0, -1], [[0, 3], [5, 3]]), pipe("portafilter.spout-l", [[-26, 56, 27], [-31, 59, 26], [-36, 59, 26]], 1.3), pipe("portafilter.spout-r", [[-26, 56, 27], [-21, 59, 26], [-16, 59, 26]], 1.3));
out.push(lathe("puck.filter-wall", [-26, 56, 40], [0, 0, -1], [[0, 9.8], [1, 9.8], [8, 8.2]], "lo"));
const puck = k.solidSvg(k.cylinder(-26, 56, 8, 32, 7, P, 36, .3), { tone: "hi", lit: true });
const puckSvg = `<g data-part="puck" data-solid="puck.coffee" data-lit class="em-puck">${puck}<g data-part="puck-particles">${Array.from({ length: 32 }, (_, i) => { const col = i % 8, row = Math.floor(i / 8), q = at([-32.3 + col * 1.8, 63.7, 33 + row * 1.8]); return `<circle class="em-particle" cx="${q[0].toFixed(2)}" cy="${q[1].toFixed(2)}" r="${(.42 + i % 3 * .08).toFixed(2)}" data-hidden="false"/>`; }).join("")}</g><path data-part="channel-cracks" class="em-crack" opacity="0" d="${k.pathOf([at([-31,63.8,34]),at([-27,63.8,36]),at([-22,63.8,38])])}${k.pathOf([at([-29,63.8,38]),at([-25,63.8,35])])}"/></g>`;
const puckFrame = G.frameAlong([-26, 56, 32], [0, 0, 1]);
const puckShape = A.disc(puckFrame, 0, 7, 8, { name: "puck.coffee", owner: "machine" });
R.solid(puckShape); R.put({ name: "puck.coffee", at: [-26, 56, 35.5], svg: puckSvg, shapes: [puckShape], piece: "machine" }); solidCount++;
out.push(lathe("puck.screen", [-26, 56, 40], [0, 0, 1], [[0, 9], [.8, 9]], "hi"));

// Steam and hot-water controls.
out.push(lathe("steam.knob", [-51, 47, 91], [0, 1, 0], [[0, 6], [4, 7], [9, 7]], "hi", {}, L(k.knurl(-51, 47, 7, 91, 100, 28, P), { tone: "lo" })));
out.push(lathe("hotwater.knob", [42, 47, 91], [0, 1, 0], [[0, 6], [4, 7], [9, 7]], "hi", {}, L(k.knurl(42, 47, 7, 91, 100, 28, P), { tone: "lo" })));
out.push(lathe("steam.ball", [-51, 48, 78], [0, 1, 0], [[0, 4], [4, 6], [8, 4]], "mid", { smooth: true }));
out.push(pipe("steam.wand", [[-51, 51, 78], [-62, 56, 58], [-66, 55, 29]], 1.55), lathe("steam.nozzle", [-66, 55, 29], [0, 0, -1], [[0, 2.4], [5, 2.4]], "hi"));

// Front gauge/readouts: fixed-state moving nodes live at their final depth slot.
const frontMatrix = (x, z) => { const c = at([x, 46, z]), ex = at([x + 1, 46, z]), ez = at([x, 46, z - 1]); return { c, a: [ex[0] - c[0], ex[1] - c[1]], b: [ez[0] - c[0], ez[1] - c[1]] }; };
const gaugeFrame = frontMatrix(28, 91), gc = gaugeFrame.c;
// The dial reads as a true circle facing the reader. One-decimal values also survive
// the card's number rounding below (which squashed the old front-plane matrix to 1 0 0 2).
const gaugeMatrix = `matrix(1.1 0 0 1.1 ${gc[0].toFixed(1)} ${gc[1].toFixed(1)})`;
const gaugeText = at([28, 46, 82]);
overlay.push(`<g data-part="pressure-gauge" transform="${gaugeMatrix}"><circle class="em-gauge-rim" r="20"/><circle class="em-gauge-face" r="18"/><path data-part="pressure-green-zone" class="em-green-zone" data-start-bar="8" data-end-bar="10" d="M3.40 -19.30A19.6 19.6 0 0 1 13.86 -13.86"/>${Array.from({ length: 17 }, (_, i) => { const a = (-220 + i * 17.5) * Math.PI / 180, r = i % 2 ? 15.5 : 13; return `<path class="iso-line em-gauge-tick" data-tone="${i % 2 ? "lo" : "mid"}" d="M${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}L${(Math.cos(a) * 17.2).toFixed(2)} ${(Math.sin(a) * 17.2).toFixed(2)}"/>`; }).join("")}<path data-part="pressure-needle" class="iso-line em-needle" data-tone="hi" data-free="start" d="M-2 1L15 0" transform="rotate(-62)"/><circle class="em-hub" r="2.2"/></g><text data-part="pressure-value" class="em-gauge-label" x="${gaugeText[0].toFixed(2)}" y="${gaugeText[1].toFixed(2)}">9.0 bar</text>`);
// Wide enough for "100.0°C" and clear of the gauge, whose face reaches world x=8.
const tempWindowW = 32, tempWindowH = 14, tempCenterX = -14, tempCenterZ = 100;
out.push(slab("display.temp-frame", { x: tempCenterX - tempWindowW / 2, y: 45.5, w: tempWindowW, d: 1.5, r: 2 }, tempCenterZ - tempWindowH / 2, tempWindowH, "lo", .4));
const tempFrame = frontMatrix(tempCenterX, tempCenterZ), ta = tempFrame.c;
const tempMatrix = `matrix(${[...tempFrame.a, ...tempFrame.b, ...ta].map((v) => v.toFixed(1)).join(" ")})`;
const tempScreenW = Math.hypot(tempFrame.a[0], tempFrame.a[1]) * tempWindowW;
overlay.push(`<g class="em-temp-window" data-temp-window-width="${tempScreenW.toFixed(1)}" data-temp-font="8"><g transform="${tempMatrix}"><rect x="${(-tempWindowW / 2).toFixed(1)}" y="${(-tempWindowH / 2).toFixed(1)}" width="${tempWindowW}" height="${tempWindowH}" rx="2"/></g><text data-part="temp-value" class="iso-face-text em-machine-readout" data-tone="hi" x="${ta[0].toFixed(1)}" y="${(ta[1] + 2).toFixed(1)}">93.0°C</text></g>`);
out.push(slab("front.power", { x: 45, y: 45.5, w: 10, d: 1.5, r: 2 }, 69, 12), cyl("front.lamp", 50, 47, 2.2, 84, 1.2, "hi", 18));

// Drawer tray, closed grille slots, float, scale, cup and coffee.
out.push(slab("tray.drawer", { x: -51, y: 14, w: 102, d: 58, r: 4 }, 0, 6));
const grilleSlots = Array.from({ length: 9 }, (_, i) => slot(-42 + i * 10, 22, 4, 42, 7.3)).join("");
out.push(slab("tray.grille", { x: -47, y: 18, w: 94, d: 50, r: 3 }, 6, 1.2, "lo", .3, grilleSlots));
out.push(slab("tray.float", { x: 36, y: 50, w: 8, d: 4, r: 2 }, 7.2, 1, "hi", .2));
out.push(slab("scale.body", { x: -43, y: 42, w: 34, d: 28, r: 4 }, 8, 4), slab("scale.display", { x: -41, y: 64, w: 30, d: 6, r: 1 }, 12, 1, "lo", .2));
for (const [i, x] of [-14, -10].entries()) out.push(cyl(`scale.button.${i}`, x, 67, 1.5, 12, .8, "hi", 16));
const st = at([-26, 74, 14]); overlay.push(`<text data-part="cup-value" class="iso-face-text em-machine-readout em-scale-text" data-tone="hi" x="${st[0].toFixed(1)}" y="${st[1].toFixed(1)}">18.0 g</text>`);
out.push(lathe("cup.body", [-26, 56, 14], [0, 0, 1], [[0, 8], [2, 9], [9, 11], [10, 11]], "hi", { smooth: true, hole: 8.5 }));
out.push(pipe("cup.handle", [[-15, 57, 22], [-4, 61, 22], [-4, 61, 15], [-17, 58, 15]], .65, "mid"), lathe("cup.base", [-26, 56, 13], [0, 0, 1], [[0, 7], [2, 8]], "lo"));
const cupLiquidPlan = { x: -34, y: 48, w: 16, d: 16, r: 8 };
const cupLiquidZ0 = 16, cupLiquidZ1 = 23, cupC = at([-26, 56, cupLiquidZ1]), cupLowC = at([-26, 56, cupLiquidZ0]);
const cupLiquidSvg = `<path data-part="cup-liquid" class="em-liquid" d="${k.planOutline(cupLiquidPlan, cupLiquidZ1, P, 24)}"/>`;
const cupLiquidShape = A.disc(G.frameAlong([-26, 56, cupLiquidZ1], [0, 0, 1]), 0, .1, 8, { name: "cup.liquid", owner: "machine" });
R.put({ name: "cup.liquid", at: [-26, 56, cupLiquidZ1], svg: cupLiquidSvg, shapes: [cupLiquidShape], piece: "machine" });
const flowSvg = `<g data-part="flow-stream" display="none"><path class="em-coffee" d="${k.pathOf([at([-31, 56, 26]), at([-31, 56, cupLiquidZ1])])}"/><path class="em-coffee" d="${k.pathOf([at([-21, 56, 26]), at([-21, 56, cupLiquidZ1])])}"/></g>`;
const flowShapes = [A.tube([[-31, 56, 26], [-31, 56, cupLiquidZ1]], [.35, .35]), A.tube([[-21, 56, 26], [-21, 56, cupLiquidZ1]], [.35, .35])];
R.put({ name: "cup.flow", at: [-26, 56, 24.5], svg: flowSvg, shapes: flowShapes, piece: "machine" });

// Companion grinder on the base extension.
out.push(slab("grinder.base", { x: -137, y: -38, w: 57, d: 69, r: 6 }, 0, 7));
out.push(slab("grinder.body", { x: -129, y: -29, w: 40, d: 49, r: 7 }, 7, 65));
const gt = k.radialTicks(-109, -4, 18, 28, 4, 77, [1.6, 3], P);
const grinderRingDetails = L(k.knurl(-109, -4, 21, 72, 77, 54, P), { tone: "lo" }) + L(gt.minor, { tone: "lo" }) + L(gt.major, { tone: "mid" });
out.push(lathe("grinder.adjust-ring", [-109, -4, 72], [0, 0, 1], [[0, 21], [5, 21]], "hi", {}, grinderRingDetails));
const grc=at([-109,-4,77.3]); overlay.push(`<g data-part="grind-pointer" transform="rotate(0 ${grc[0].toFixed(1)} ${grc[1].toFixed(1)})">${D([at([-91, -4, 77.3])], { size: 1.4, tone: "hi" })}</g>`);
const beanDetails = Array.from({ length: 18 }, (_, i) => { const a = i * 2.17, r = 4 + i % 4 * 3.4, p = at([-109 + Math.cos(a) * r, -4 + Math.sin(a) * r, 112 - i % 3 * 2]); return `<ellipse class="em-bean" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" rx="1.6" ry=".9" transform="rotate(${i * 37 % 180} ${p[0].toFixed(1)} ${p[1].toFixed(1)})"/>`; }).join("");
out.push(lathe("grinder.hopper", [-109, -4, 77], [0, 0, 1], [[0, 16], [6, 18], [35, 24], [43, 22]], "hi", { smooth: true, hole: 18 }, beanDetails), lathe("grinder.lid", [-109, -4, 120], [0, 0, 1], [[0, 23], [3, 23]]));
out.push(slab("grinder.chute", { x: -117, y: 18, w: 16, d: 12, r: 3 }, 40, 8, "hi"), slab("grinder.grounds-tray", { x: -124, y: 31, w: 32, d: 20, r: 3 }, 7, 3, "lo"));

// Joined assemblies can wrap or pass through their host (rings, panel-mounted controls,
// drawer rails).  They are one mechanical joint, so no global painter order exists
// between their near and far halves; keep those joins together while settling every
// independent overlap from measured geometry.
const joinedDepth = new Set([
  "chassis.floor|tray.drawer", "chassis.back|chassis.left",
  "chassis.front-control|group.body", "chassis.front-control|group.fin.0", "chassis.front-control|group.fin.1",
  "chassis.front-control|group.lever-pivot", "chassis.front-control|group.lever:0", "chassis.front-control|group.lever:1",
  "chassis.front-control|group.lever-ball", "chassis.front-control|front.lamp",
  "chassis.partition|pump.mount", "chassis.partition|water.pump-boiler:2", "chassis.partition|tray.drawer", "chassis.partition|tray.grille",
  "tank.body|water.suction-fitting", "tank.body|pump.mount",
  "boiler.shell|water.pump-boiler:3", "boiler.shell|gauge.capillary:0",
  "boiler.flange|boiler.right-head", "boiler.right-head|boiler.bolt.2", "boiler.right-head|boiler.bolt.3",
  "boiler.right-head|boiler.bolt.4", "boiler.right-head|boiler.bolt.6", "boiler.right-head|boiler.bolt.7",
  "boiler.right-head|water.pump-boiler:2", "boiler.flange|water.pump-boiler:2",
  "group.body|group.mount", "group.body|group.fin.0", "group.body|group.fin.1", "group.body|group.fin.2",
  "group.body|group.fin.3", "group.body|group.fin.4", "group.shower|portafilter.collar",
  "group.lever-pivot|group.lever:0",
  "cup.body|cup.base", "cup.body|cup.liquid", "cup.body|cup.flow",
  "chassis.left|chassis.front-left", "front.screw.2|chassis.front-left",
  "chassis.front-control|group.mount", "boiler.heater-u:0|boiler.shell", "boiler.heater-u:1|boiler.shell", "boiler.heater-u:2|boiler.shell", "boiler.heater-u:3|boiler.shell", "boiler.heater-u:4|boiler.shell",
  "pipe.clamp.1|boiler.shell", "boiler.left-head|water.boiler-group:0", "boiler.left-head|water.boiler-group:1",
  "boiler.right-head|boiler.bolt.0", "boiler.right-head|boiler.bolt.1", "boiler.right-head|boiler.bolt.5",
  "water.pump-boiler:1|pipe.clamp.0", "group.mount|water.group-fitting", "portafilter.collar|portafilter.socket",
  "portafilter.basket|cup.body", "puck.filter-wall|cup.body",
  "water.suction:2|tank.body", "boiler.shell|water.pump-boiler:2",
  "water.pump-boiler:3|water.boiler-fitting", "water.boiler-group:2|pipe.clamp.2",
  "water.suction-fitting|water.suction:3", "pump.outlet|water.pump-boiler:0",
  "grinder.body|grinder.grounds-tray",
  "grinder.body|grinder.chute",
  "portafilter.spout|portafilter.spout-l:0", "portafilter.spout|portafilter.spout-r:0",
  "cup.body|cup.flow",
  "group.body|group.lever-pivot",
].map((pair) => pair.split("|").sort().join("|")));
const sameJoinedAssembly = (a, b) => joinedDepth.has([a.name, b.name].sort().join("|"));
A.settle(R, P, { skip: sameJoinedAssembly });
R.items.sort((a, b) => a.key - b.key);
// The boiler is intentionally cut away: expose the real recorded heater chunks on
// the service side instead of drawing a decorative overlay on the control panel.
const heaterItems = R.items.filter((item) => item.name.startsWith("boiler.heater-u:"));
for (const item of heaterItems) R.items.splice(R.items.indexOf(item), 1);
const boilerIndex = R.items.findIndex((item) => item.name === "boiler.shell");
R.items.splice(boilerIndex + 1, 0, ...heaterItems);
// `S()` records solids and returns an empty placeholder; the remaining `out`
// entries are host-surface engraving, slots, knurling, ticks and beans. Paint
// those after the settled solids so they remain visible on their host faces.
const settledBody = [out[0], ...R.items.map((item) => item.svg), ...out.slice(1), ...overlay].join("");
const svg = k.figureSvg({ width: W, height: H, label: "側板拆開的 E61 家用半自動義式咖啡機，內部水箱、幫浦、鍋爐、水路、沖煮頭與左側磨豆機都可見。", body: settledBody });
const extraCss = `.es-machine{min-height:0}.es-machine>.iso{width:100%;--anatomy-card:var(--paper,#171717);--anatomy-page:var(--paper,#171717)}.es-machine .iso-plate{width:100%;box-sizing:border-box}.es-machine .iso-svg{width:100%;height:auto;overflow:visible}.es-machine .iso-swatch{width:16px;height:10px;flex:none}.es-machine .iso-swatch[data-mark="lit"] path{stroke:#d97706!important;fill:#d97706}.es-machine .iso-swatch[data-mark="lit"] .iso-swatch-crease{stroke:#8a4b05!important}.em-water{fill:var(--anatomy-line-lo);opacity:.3}.em-boiler-cutaway{opacity:.28}.em-hot .tb-body,.em-hot .tb-shade,.em-heater-line{fill:#d97706!important;stroke:#d97706!important;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}.em-coffee{fill:none;stroke:#d97706;stroke-width:2.2;stroke-linecap:round}.em-liquid{fill:#d97706;stroke:#d97706;stroke-width:.7;opacity:.84}.em-puck .iso-fill,.em-puck .iso-top,.em-puck .iso-shade{fill:#d97706!important}.em-puck .iso-edge{stroke:var(--anatomy-lit)}.em-particle,.em-bean{fill:#d97706;opacity:.72}.em-particle[data-hidden="true"]{display:none}.em-crack{fill:none;stroke:var(--anatomy-paper);stroke-width:1.15;stroke-linecap:round}.em-gauge-rim{fill:var(--anatomy-face);stroke:var(--anatomy-hi);stroke-width:2}.em-gauge-face{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:1}.em-green-zone{fill:none;stroke:#3f8f62;stroke-width:3.8;stroke-linecap:round}.em-gauge-tick{stroke-width:.8}.em-needle{stroke:#d97706!important;stroke-width:1.7}.em-hub{fill:var(--anatomy-hi)}.em-gauge-label,.em-machine-readout{fill:var(--anatomy-hi);font:600 5px ui-monospace,Consolas,monospace;text-anchor:middle;font-variant-numeric:tabular-nums}.em-gauge-label{font-size:6.5px}.em-scale-text{font-size:7px}.em-temp-window rect{fill:var(--anatomy-shade-0);stroke:var(--anatomy-hi);stroke-width:1.1}.em-temp-window text{font-size:8px}@media(max-width:430px){.es-machine .iso-plate-corner{font-size:10px}.es-machine .iso-plate-corner[data-corner="title"]{font-size:11px}.es-machine .iso-keys,.es-machine .iso-caption{font-size:10px}}`;
const cutawayCss = `.em-filter-cutaway{opacity:.38}.em-front-window{opacity:.24}.em-tank-shell{opacity:.35}.em-hopper-glass>.iso-fill,.em-hopper-glass>.iso-top,.em-hopper-glass>.iso-shade{opacity:.35}.em-particle{fill:#5a2d03;opacity:.9}.em-gauge-face{fill:#f4f1e8}.em-gauge-label,.em-hub{fill:#1f1f1f!important}`;
const copy = {
  zh: { title: "義式咖啡機，打開來看", hint: "拖下面的滑桿，機器跟著動", keys: ["粉餅", "鍋爐", "壓力錶", "磨豆機調整環", "秤"], caption: "粉越細、水越熱，萃取越多；壓力錶和秤上的數字，就是下方圖表同一瞬間的值。" },
  en: { title: "An espresso machine, opened up", hint: "Drag the sliders below; the machine follows", keys: ["Coffee puck", "Boiler", "Pressure gauge", "Grinder adjustment ring", "Scale"], caption: "Finer coffee and hotter water extract more; the gauge and scale show the same instant as the chart below." },
};
const card = (lang) => { const t = copy[lang]; return `<div class="iso">${k.plateHtml({ fig: "Fig 1", title: t.title, hint: t.hint, readout: "93.0°C · 9.0 bar · 18.0 g", keys: [{ mark: "lit", label: t.keys[0] }, { mark: "raised", label: t.keys[1] }, { mark: "line", label: t.keys[2] }, { mark: "dot", label: t.keys[3] }, { mark: "raised", label: t.keys[4] }], caption: t.caption, body: `<div class="iso-stage">${svg}</div>` })}</div>`; };

const css = (k.ISO_CSS + extraCss + cutawayCss).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").trim();
// Tenth-pixel static geometry is visually stable at this fitted scale and keeps
// the browser payload below the 350 KiB Hero cap without removing any part.
const zhCard = card("zh")
  .replace(/-?\d+\.\d{2,}/g, (value) => String(Math.round(Number(value))))
  .replace('d="M3 -19A19.6 19.6 0 0 1 14 -14"', 'd="M3.40 -19.30A19.6 19.6 0 0 1 13.86 -13.86"')
  .replace(/>\s+</g, "><").trim();
const packWords = [`<path class="iso-fill"`,`<path class="iso-edge"`,`<path class="iso-top"`,`<path class="iso-shade"`,`<path class="iso-line"`,` data-tone="hi"`,` data-tone="mid"`,` data-tone="lo"`,` fill-rule="evenodd"`,` stroke-linejoin="round"`,` stroke-linecap="round"`,` opacity="0.`,`<g class="`,` transform="`,` class="`,`<path d="`];
const packPairs = packWords.map((word, i) => [String.fromCharCode(0xe000 + i), word]);
const packedCard = packPairs.reduce((text, [token, word]) => text.split(word).join(token), zhCard);
const runtime = `(function(root,factory){var api=factory();if(root)root.EspressoMachine=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){"use strict";var VERSION="2.0.0";var CSS=${JSON.stringify(css)};var CARD=${JSON.stringify(zhCard)};var EN=${JSON.stringify([[copy.zh.title,copy.en.title],[copy.zh.hint,copy.en.hint],...copy.zh.keys.map((x,i)=>[x,copy.en.keys[i]]),[copy.zh.caption,copy.en.caption]])};function n(v,d){v=Number(v);return Number.isFinite(v)?v:d}function mount(container,options){if(!container||typeof container.querySelector!=="function")throw new TypeError("EspressoMachine.mount requires a container");if(typeof document!=="undefined"&&!document.getElementById("espresso-machine-style")){var style=document.createElement("style");style.id="espresso-machine-style";style.textContent=CSS;document.head.appendChild(style);}var lang=options&&options.lang==="en"?"en":"zh",html=CARD;if(lang==="en")for(var i=0;i<EN.length;i++)html=html.replace(">"+EN[i][0]+"<",">"+EN[i][1]+"<");if(container.classList)container.classList.add("es-machine");container.innerHTML=html;var plate=container.querySelector(".iso"),svg=container.querySelector("svg"),q=function(p){return container.querySelector('[data-part="'+p+'"]')};function theme(){if(!plate||typeof document==="undefined")return;if(document.documentElement.classList.contains("dark"))plate.removeAttribute("data-theme");else plate.setAttribute("data-theme","light")}theme();var observer=null;if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){observer=new MutationObserver(theme);observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]})}if(svg)svg.setAttribute("aria-label",lang==="en"?"Animated cutaway espresso machine":"會動的義式咖啡機剖面圖");function update(state){state=state||{};var grind=n(state.grind,300),temp=n(state.temp,93),pressure=n(state.pressure,9),flow=n(state.flow,1.45),cup=n(state.cup,36),shot=n(state.shotTime,25),t=n(state.t,shot),channel=n(state.channel,0);var el=q("pressure-needle"),angle=-220+pressure*17.5;if(el)el.setAttribute("transform","rotate("+angle.toFixed(2)+")");el=q("pressure-value");if(el)el.textContent=pressure.toFixed(1)+" bar";el=q("temp-value");if(el)el.textContent=temp.toFixed(1)+"°C";el=q("cup-value");if(el)el.textContent=cup.toFixed(1)+" g";el=container.querySelector("[data-readout]");if(el)el.textContent=temp.toFixed(1)+"°C · "+pressure.toFixed(1)+" bar · "+cup.toFixed(1)+" g";el=q("grind-pointer");if(el)el.setAttribute("transform","rotate("+((grind-180)/240*270).toFixed(2)+" ${grc[0].toFixed(1)} ${grc[1].toFixed(1)})");var particles=container.querySelectorAll(".em-particle"),radius=.28+(grind-180)/240*.55,visible=Math.round(32-(grind-180)/240*13);for(var j=0;j<particles.length;j++){particles[j].setAttribute("r",(radius+(j%3)*.06).toFixed(2));particles[j].setAttribute("data-hidden",j<visible?"false":"true")}el=q("channel-cracks");if(el)el.setAttribute("opacity",channel>.3?String(Math.min(1,(channel-.3)/.2)):"0");var active=t>0&&t<shot;el=q("flow-stream");if(el){el.setAttribute("display",active?"inline":"none");el.setAttribute("stroke-width",Math.max(.7,flow*1.45).toFixed(2))}var levers=container.querySelectorAll("[data-lever]"),leverTransform=active?"rotate(18 ${leverPivotScreen[0].toFixed(2)} ${leverPivotScreen[1].toFixed(2)})":"rotate(0 ${leverPivotScreen[0].toFixed(2)} ${leverPivotScreen[1].toFixed(2)})";for(var l=0;l<levers.length;l++)levers[l].setAttribute("transform",leverTransform);var heaters=container.querySelectorAll("[data-heater]"),heaterOpacity=Math.max(.15,Math.min(1,.15+(temp-86)/11*.85)).toFixed(2);for(var h=0;h<heaters.length;h++)heaters[h].setAttribute("opacity",heaterOpacity);el=q("cup-liquid");if(el){var ratio=Math.max(0,Math.min(1,cup/40)),dx=(1-ratio)*(${cupLowC[0].toFixed(2)}-${cupC[0].toFixed(2)}),dy=(1-ratio)*(${cupLowC[1].toFixed(2)}-${cupC[1].toFixed(2)});el.setAttribute("transform","translate("+dx.toFixed(2)+" "+dy.toFixed(2)+")")}}update({});return{update:update,destroy:function(){if(observer)observer.disconnect()}}}return{mount:mount,VERSION:VERSION};});\n`;
const finalRuntime = runtime
  .replace(JSON.stringify(zhCard), JSON.stringify(packedCard))
  .replace(';var EN=', `;var PACK=${JSON.stringify(packPairs)};for(var pi=0;pi<PACK.length;pi++)CARD=CARD.split(PACK[pi][0]).join(PACK[pi][1]);var EN=`);
writeFileSync(OUT, finalRuntime, "utf8"); mkdirSync(TEMP, { recursive: true });
const preview = (light) => `<!doctype html><html${light ? "" : " class=\"dark\""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{background:${light ? "#f0ede5" : "#101010"};--paper:${light ? "#f7f4ec" : "#171717"}}body{margin:0;padding:24px}.host{max-width:760px;margin:auto}</style></head><body><div class="host"></div><script>${finalRuntime.replace(/<\/script/gi, "<\\/script")}</script><script>EspressoMachine.mount(document.querySelector('.host'),{lang:'zh'}).update({grind:300,temp:93,pressure:9,flow:1.45,cup:18,t:12,shotTime:25,channel:0,zone:'ok'});</script></body></html>`;
writeFileSync(join(TEMP, "preview.html"), preview(false), "utf8"); writeFileSync(join(TEMP, "preview-light.html"), preview(true), "utf8");
console.log(`wrote ${OUT}`); console.log(`parts: ${solidCount} solids · ${(svg.match(/<path\b/g) || []).length} paths`); console.log(`size: ${Buffer.byteLength(finalRuntime)} bytes · ${gzipSync(finalRuntime).length} bytes gzip`);
A.auditOrExit(R, P);
