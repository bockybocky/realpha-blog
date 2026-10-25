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
const OUT = join(HERE, "..", "public", "pourover-machine.js");
const TEMP = "D:/Temp/claude/pourover_jixietu";
const W = 640, H = 460;
const azimuth = 40, elevation = 30;
const WORLD = { x: 0, y: 0, w: 168, d: 118, r: 4 };
const fitted = k.fitProjection(k.boxCorners(WORLD, -8, 92), W, H, { pad: 34, azimuth, elevation });
const lift = 1.04;
const P = {
  azimuth, elevation,
  scale: fitted.scale * lift,
  origin: [W / 2 - (W / 2 - fitted.origin[0]) * lift, H / 2 - (H / 2 - fitted.origin[1]) * lift],
};
const at = (p) => k.iso(p, P);
const DRIPPERS = ["v60", "kadou", "kalita", "melitta", "clever"];
const DRAW_SLOTS = ["halo", "bench", "grinder", "kettle", "dripper", "carafe", "scale", "overlay"];

const CUP = [84, 70];
const drawShared = (R, bag) => {
  const S = (name, paths, tone, shape, centre, extra = {}) => {
    const cls = extra.cut ? ` class="pm-cut"` : "";
    const part = extra.part ? ` data-part="${extra.part}"` : "";
    const svg = `<g${cls}${part}>${k.solidSvg(paths, { tone, lit: extra.lit === true })}</g>`;
    bag.push({ name, svg, group: extra.group || null });
    if (R && shape) {
      R.solid(shape);
      R.put({ name, at: centre, svg, shapes: [shape], piece: "machine" });
    }
  };
  const slab = (n, plan, z, h, tone = "mid", bevel = 0.5, group = null) => {
    const steps = Math.max(3, Math.round(plan.r || 3));
    S(n, k.slabOf(plan, z, h, P, steps, bevel), tone, A.slab(plan, z, h, { name: n, owner: "machine" }, steps), [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], { group });
  };
  const cyl = (n, x, y, r, z, h, tone = "mid", steps = 8, extra = {}) => {
    const F = G.frameAlong([x, y, z], [0, 0, 1]);
    S(n, k.cylinder(x, y, r, z, h, P, steps, Math.min(0.4, h / 5)), tone, A.disc(F, 0, h, r, { name: n, owner: "machine" }), [x, y, z + h / 2], extra);
  };
  const lathe = (n, o, a, profile, tone = "mid", extra = {}) => {
    const F = G.frameAlong(o, a), mid = (profile[0][0] + profile.at(-1)[0]) / 2;
    S(n, G.lathe(profile, F, P, { steps: 12 }), tone, A.solid(F, profile, { name: n, owner: "machine" }), G.add3(o, G.mul3(a, mid)), extra);
  };
  const pipe = (n, points, radius, touch) => {
    const route = points.length > 2 ? G.fillet(points, Math.max(14, radius * 10), 6, { P, tube: radius }) : points;
    if (R) R.route(n, route, radius, { piece: "machine", owner: "machine", limp: false, touch, ends: [false, false], free: [true, true] });
    tubePieces(route, radius, P, { maxLength: 22, spacing: 1.05 }).forEach((piece, i) => {
      const svg = `<g>${tubeSvg(piece, { tone: "hi" })}</g>`;
      bag.push({ name: `${n}:${i}`, svg, group: null });
      if (R) R.put({ name: `${n}:${i}`, at: piece.mid, svg, shapes: [A.tube(piece.points, piece.radii)], route: n, chunk: i, piece: "machine" });
    });
  };

  const bench = { x: 10, y: 8, w: 148, d: 100, r: 5 };
  bag.push({ name: "halo", svg: `<path class="iso-halo" d="${k.haloOf(bench, -8, 16, P)}"/>`, group: null });
  for (const [i, [x, y]] of k.corners(bench, 16).entries()) {
    cyl(`bench.pad.${i}`, x, y, 5.4, -6.2, 1.5, "lo", 8);
    cyl(`bench.foot.${i}`, x, y, 3.6, -4.6, 4.6, "lo", 8);
  }
  slab("bench.top", bench, 0, 6, "mid", 1);
  for (const [i, [x, y]] of k.corners(bench, 12).entries()) cyl(`bench.screw.${i}`, x, y, 1.05, 6.05, 1, "hi", 8);
  slab("bench.seam", { x: 78, y: 8, w: 1.4, d: 100, r: 0.2 }, 6.05, 0.35, "lo", 0.1);

  // Grinder, back right. Dial ring is the moving index's home.
  cyl("grinder.foot", 132, 36, 8.4, 6.05, 1.6, "lo", 10);
  cyl("grinder.body", 132, 36, 6.2, 7.7, 16, "mid", 12);
  cyl("grinder.dial", 132, 36, 7.6, 6.15, 1.45, "hi", 12);
  cyl("grinder.axle", 132, 36, 1.3, 23.7, 1.5, "hi", 8);
  slab("grinder.crank", { x: 133.6, y: 34.7, w: 12, d: 2.4, r: 0.4 }, 25.4, 1.4, "hi", 0.3);
  cyl("grinder.ball", 149.4, 35.9, 2.1, 24.8, 2.8, "mid", 8);
  cyl("grinder.hopper", 132, 36, 4.6, 26.9, 8, "mid", 10);
  cyl("grinder.cap", 132, 36, 5, 34.9, 1.3, "hi", 10);
  cyl("grinder.cup", 132, 56, 4.4, 6.1, 3.2, "lo", 10);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    cyl(`grinder.tick.${i}`, 132 + Math.cos(a) * 8.5, 36 + Math.sin(a) * 8.5, 0.5, 7.65, 0.85, "hi", 6);
  }
  const hub = at([132, 36, 7.6]);
  const hx = at([133, 36, 7.6]);
  const hy = at([132, 37, 7.6]);
  const dialMatrix = `matrix(${[hx[0] - hub[0], hx[1] - hub[1], hy[0] - hub[0], hy[1] - hub[1], hub[0], hub[1]].map((v) => v.toFixed(2)).join(" ")})`;
  const dialTicks = Array.from({ length: 8 }, (_, i) => `<path class="iso-line" data-tone="hi" d="M7.55 0L8.35 0" transform="rotate(${i * 45})"/>`).join("");
  bag.push({ name: "grinder.diallines", svg: `<g data-part="grind-ticks" transform="${dialMatrix}"><circle r="7.6" fill="none" stroke="var(--anatomy-hi)" stroke-width="0.6"/>${dialTicks}</g>`, group: null });

  // Kettle, back left, gooseneck ending above the cup.
  cyl("kettle.heater", 30, 30, 11, 6.05, 3.2, "lo", 12);
  cyl("kettle.body", 30, 30, 9, 9.3, 12, "mid", 12, { cut: true });
  cyl("kettle.shoulder", 30, 30, 6.4, 21.3, 3, "mid", 10);
  cyl("kettle.neck", 30, 30, 3.6, 24.3, 3.2, "hi", 10);
  cyl("kettle.lid", 30, 30, 5.2, 27.5, 1.5, "hi", 10);
  cyl("kettle.knob", 30, 30, 1.5, 29.05, 2, "mid", 8);
  slab("kettle.handle", { x: 40.6, y: 27.2, w: 3.2, d: 8, r: 0.5 }, 12, 12, "hi", 0.4);
  cyl("kettle.collar", 30, 36.6, 1.5, 24.4, 2.2, "hi", 8);
  cyl("kettle.button", 22, 42.4, 1.3, 7.3, 1.4, "hi", 8);
  cyl("kettle.lamp", 38, 42.2, 0.85, 7.5, 1.2, "hi", 8);
  slab("kettle.bezel", { x: 24.5, y: 41.3, w: 10, d: 1.4, r: 0.3 }, 8.6, 3, "hi", 0.25);
  pipe("kettle.spout", [[30, 38.4, 32], [CUP[0], CUP[1], 74]], 1.15, ["kettle.collar"]);
  pipe("kettle.cord", [[16.4, 22, 9.2], [8, 14, 9.2]], 0.65, ["kettle.heater"]);

  // Carafe in front of the cup, on the scale. Shell is translucent.
  cyl("carafe.base", CUP[0], 86, 8, 13.2, 2.6, "lo", 12);
  lathe("carafe.body", [CUP[0], 86, 15.8], [0, 0, 1], [[0, 7.2], [16, 7.2]], "mid", { cut: true });
  cyl("carafe.neck", CUP[0], 86, 4.4, 31.8, 3, "hi", 10);
  cyl("carafe.rim", CUP[0], 86, 5.6, 34.8, 1.6, "hi", 10);
  slab("carafe.handle", { x: 93.5, y: 82, w: 3, d: 10, r: 0.4 }, 18, 12, "hi", 0.35);
  cyl("carafe.grip", 98.2, 87, 1.5, 20, 6, "mid", 8);

  // Scale under the carafe, screen on the front lip.
  slab("scale.body", { x: 56, y: 62, w: 56, d: 42, r: 2 }, 6.1, 4.4, "mid", 0.6);
  cyl("scale.pan", CUP[0], 86, 11, 10.55, 2.5, "hi", 12);
  for (const [i, [x, y]] of [[62, 68], [106, 68], [62, 98], [106, 98]].entries()) cyl(`scale.foot.${i}`, x, y, 1.5, 6.05, 1.3, "lo", 8);
  slab("scale.bezel", { x: 68, y: 104, w: 30, d: 1.8, r: 0.3 }, 7.2, 5.2, "hi", 0.25);
  cyl("scale.button.0", 62, 106.4, 1.2, 7.5, 1.15, "mid", 8);
  cyl("scale.button.1", 106, 106.4, 1.2, 7.5, 1.15, "mid", 8);
};

const drawDripper = (R, bag, kind) => {
  const S = (name, paths, tone, shape, centre, extra = {}) => {
    const cls = extra.cut ? ` class="pm-cut"` : "";
    const part = extra.part ? ` data-part="${extra.part}"` : "";
    const svg = `<g${cls}${part}${extra.attrs || ""}>${k.solidSvg(paths, { tone, lit: extra.lit === true })}</g>`;
    bag.push({ name, svg, group: kind });
    if (R && shape) {
      R.solid(shape);
      R.put({ name, at: centre, svg, shapes: [shape], piece: "machine" });
    }
  };
  const slab = (n, plan, z, h, tone = "mid", bevel = 0.4, extra = {}) => {
    const steps = Math.max(3, Math.round(plan.r || 3));
    S(n, k.slabOf(plan, z, h, P, steps, bevel), tone, A.slab(plan, z, h, { name: n, owner: "machine" }, steps), [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], extra);
  };
  const cyl = (n, x, y, r, z, h, tone = "mid", steps = 8, extra = {}) => {
    const F = G.frameAlong([x, y, z], [0, 0, 1]);
    S(n, k.cylinder(x, y, r, z, h, P, steps, Math.min(0.35, h / 5)), tone, A.disc(F, 0, h, r, { name: n, owner: "machine" }), [x, y, z + h / 2], extra);
  };
  const lathe = (n, o, profile, tone = "mid", extra = {}) => {
    const F = G.frameAlong(o, [0, 0, 1]), mid = (profile[0][0] + profile.at(-1)[0]) / 2;
    S(n, G.lathe(profile, F, P, { steps: 12 }), tone, A.solid(F, profile, { name: n, owner: "machine" }), G.add3(o, [0, 0, mid]), extra);
  };
  const [cx, cy] = CUP;
  const tag = `${kind}.`;
  const rib = (n, p0, p1, radius, innerRadius, tone = "mid") => {
    const delta = G.add3(p1, G.mul3(p0, -1));
    const length = Math.hypot(...delta);
    const axis = G.mul3(delta, 1 / length);
    const F = G.frameAlong(p0, axis);
    const centre = G.add3(p0, G.mul3(delta, 0.5));
    const centreRadius = Math.hypot(centre[0] - cx, centre[1] - cy);
    S(n, G.lathe([[0, radius], [length, radius]], F, P, { steps: 6 }), tone,
      A.disc(F, 0, length, radius, { name: n, owner: "machine" }), centre, {
        part: n,
        attrs: ` data-rib-kind="${kind}" data-centre-radius="${centreRadius.toFixed(4)}" data-inner-radius="${innerRadius.toFixed(4)}"`,
      });
  };
  const ceramic = kind === "kadou";
  cyl(`${tag}seat`, cx, cy, ceramic ? 12.4 : 11.2, 36.7, ceramic ? 2.4 : 2, ceramic ? "hi" : "lo", 12);
  cyl(`${tag}nozzle`, cx, cy, kind === "melitta" ? 0.7 : 1.5, 34.2, 2.3, "hi", 8);
  slab(`${tag}handle`, { x: cx + 16.2, y: cy - 3, w: ceramic ? 8 : 7, d: 2.8, r: 0.4 }, ceramic ? 48 : 50, 2.4, ceramic ? "hi" : "hi", 0.3);
  if (kind === "v60") {
    lathe(`${tag}cone`, [cx, cy, 39], [[0, 5.6], [24, 13.5]], "mid", { cut: true });
    for (let i = 0; i < 4; i++) {
      const a = -0.4 + i * 0.85;
      const z0 = 45 + i * 3.2, z1 = z0 + 3.2;
      const wall0 = 5.6 + ((z0 - 39) / 24) * 7.9;
      const wall1 = 5.6 + ((z1 - 39) / 24) * 7.9;
      const r0 = wall0 - 0.35, r1 = wall1 - 0.35;
      const innerMid = 5.6 + ((((z0 + z1) / 2) - 39) / 24) * 7.9;
      rib(`${tag}rib.${i}`, [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, z0], [cx + Math.cos(a + 0.16) * r1, cy + Math.sin(a + 0.16) * r1, z1], 0.32, innerMid, "hi");
    }
    cyl(`${tag}paper`, cx, cy, 12, 63.1, 1.1, "lo", 12);
  } else if (kind === "kadou") {
    lathe(`${tag}cone`, [cx, cy, 42], [[0, 8.2], [16, 14.6]], "hi", {
      cut: true,
      attrs: ` data-inner-bottom-radius="8.2" data-inner-top-radius="14.6"`,
    });
    for (let i = 0; i < 32; i++) {
      const long = i % 2 === 0;
      const a = (i / 32) * Math.PI * 2;
      const z0 = long ? 45 : 50;
      const h = long ? 9 : 4.2;
      const wall0 = 8.2 + ((z0 - 42) / 16) * 6.4;
      const wall1 = 8.2 + ((z0 + h - 42) / 16) * 6.4;
      const r0 = wall0 - 0.35, r1 = wall1 - 0.35;
      const innerMid = 8.2 + ((z0 + h / 2 - 42) / 16) * 6.4;
      rib(`${tag}rib.${i}`, [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, z0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, z0 + h], 0.32, innerMid, "mid");
    }
    cyl(`${tag}paper`, cx, cy, 13.2, 58.1, 1, "lo", 12);
  } else if (kind === "kalita") {
    cyl(`${tag}bowl`, cx, cy, 10, 39, 7, "mid", 12, { cut: true });
    lathe(`${tag}wall`, [cx, cy, 46.2], [[0, 10], [12, 13]], "mid", { cut: true });
    for (const [i, dx] of [-3.4, 0, 3.4].entries()) cyl(`${tag}hole.${i}`, cx + dx, cy + 2, 0.55, 38.75, 0.2, "hi", 6);
    slab(`${tag}wave.0`, { x: cx - 7, y: cy + 14.2, w: 14, d: 1.1, r: 0.2 }, 50, 0.7, "lo", 0.15);
    slab(`${tag}wave.1`, { x: cx - 5, y: cy + 16.2, w: 10, d: 1.1, r: 0.2 }, 54, 0.7, "lo", 0.15);
    cyl(`${tag}paper`, cx, cy, 12.2, 58.3, 1, "lo", 12);
  } else if (kind === "melitta") {
    slab(`${tag}wall.s`, { x: cx - 10, y: cy - 8, w: 20, d: 1.5, r: 0.2 }, 39, 20, "mid", 0.3);
    slab(`${tag}wall.n`, { x: cx - 10, y: cy + 6.5, w: 20, d: 1.5, r: 0.2 }, 39, 20, "mid", 0.3);
    slab(`${tag}wall.w`, { x: cx - 10, y: cy - 6.5, w: 1.5, d: 13, r: 0.2 }, 39, 20, "mid", 0.3);
    slab(`${tag}wall.e`, { x: cx + 8.5, y: cy - 6.5, w: 1.5, d: 13, r: 0.2 }, 39, 20, "mid", 0.3);
    slab(`${tag}lip`, { x: cx - 11, y: cy - 9, w: 22, d: 1.2, r: 0.2 }, 59, 1.6, "hi", 0.2);
    cyl(`${tag}hole`, cx, cy, 0.7, 38.8, 0.15, "hi", 6);
    slab(`${tag}paper`, { x: cx - 6, y: cy - 4, w: 12, d: 8, r: 0.3 }, 56, 0.7, "lo", 0.15);
  } else {
    slab(`${tag}wall.s`, { x: cx - 11, y: cy - 9, w: 22, d: 1.5, r: 0.2 }, 39, 22, "mid", 0.3);
    slab(`${tag}wall.n`, { x: cx - 11, y: cy + 7.5, w: 22, d: 1.5, r: 0.2 }, 39, 22, "mid", 0.3);
    slab(`${tag}wall.w`, { x: cx - 11, y: cy - 7.5, w: 1.5, d: 15, r: 0.2 }, 39, 22, "mid", 0.3);
    slab(`${tag}wall.e`, { x: cx + 9.5, y: cy - 7.5, w: 1.5, d: 15, r: 0.2 }, 39, 22, "mid", 0.3);
    cyl(`${tag}lid`, cx, cy, 10.2, 61.2, 1.3, "hi", 12);
    cyl(`${tag}lidknob`, cx, cy, 1.2, 62.6, 1.5, "mid", 8);
    cyl(`${tag}hole`, cx, cy, 1.2, 38.85, 0.15, "hi", 8);
    slab(`${tag}valve`, { x: cx - 2.6, y: cy - 1.8, w: 5.2, d: 3.6, r: 0.3 }, 33.2, 0.8, "hi", 0.2, { part: "clever-valve" });
    slab(`${tag}paper`, { x: cx - 6, y: cy - 4, w: 12, d: 8, r: 0.3 }, 55, 0.7, "lo", 0.15);
  }
  slab(`${tag}grounds`, { x: cx - 6, y: cy + 16.5, w: 12, d: 2.2, r: 0.3 }, 52, 4.2, "hi", 0.2, { lit: true });
};

const scene = (kinds, record) => {
  const R = record ? A.recorder(P, { ground: () => true }) : null;
  const bag = [];
  drawShared(R, bag);
  for (const kind of kinds) drawDripper(R, bag, kind);
  return { R, bag };
};

const page = scene(DRIPPERS, false);
const dialHub = at([132, 36, 8.5]);
const dialAt = at([140.5, 36, 8.5]);
const groundsOf = (kind) => {
  const [cx, cy] = CUP;
  return Array.from({ length: 8 }, (_, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const p = at([cx - 4.2 + col * 2.6, cy + 17.4, 54.6 - row * 1.6]);
    return `<ellipse class="pm-ground" data-part="grounds-dot-${kind}" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" rx="1.35" ry="0.85"/>`;
  }).join("");
};
const waterOf = (kind) => {
  const [cx, cy] = CUP;
  const a = at([cx - 5, cy + 17.6, 56.4]);
  const b = at([cx + 5, cy + 17.6, 56.4]);
  const c = at([cx + 4, cy + 17.6, 61]);
  const d = at([cx - 4, cy + 17.6, 61]);
  const pts = [a, b, c, d].map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  return `<polygon data-part="water-${kind}" class="pm-water" points="${pts}"/>`;
};
const streamOf = (kind) => {
  const [cx, cy] = CUP;
  const a = at([cx, cy, 72]);
  const b = at([cx, cy, 63]);
  return `<line data-part="stream-${kind}" class="pm-water-line" x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" stroke-width="2.4"/>`;
};
const dripOf = (kind) => {
  const [cx, cy] = CUP;
  const a = at([cx, cy, 34]);
  const b = at([cx, cy, 27]);
  return `<line data-part="drip-${kind}" class="pm-coffee-line" x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}" stroke-width="1.6"/>`;
};
const liquidOf = () => {
  const [cx, cy] = [CUP[0], 86];
  const a = at([cx - 5.4, cy, 18]);
  const b = at([cx + 5.4, cy, 18]);
  const c = at([cx + 5.4, cy, 30]);
  const d = at([cx - 5.4, cy, 30]);
  const pts = [a, b, c, d].map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const o = at([cx, cy, 18]);
  return `<polygon data-part="carafe-level" class="pm-coffee" points="${pts}" transform="translate(${o[0].toFixed(2)} ${o[1].toFixed(2)}) scale(1 0.3667) translate(${(-o[0]).toFixed(2)} ${(-o[1]).toFixed(2)})"/>`;
};
const beanOf = () => Array.from({ length: 5 }, (_, i) => {
  const p = at([132 + (i - 2) * 1.6, 36 + (i % 2), 31]);
  return `<ellipse class="pm-bean" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" rx="1.5" ry="0.95" transform="rotate(${i * 25} ${p[0].toFixed(2)} ${p[1].toFixed(2)})"/>`;
}).join("");

const faceAt = (x, y, z) => {
  const c = at([x, y, z]);
  const ex = at([x + 1, y, z]);
  const ez = at([x, y, z + 1]);
  return { c, a: [ex[0] - c[0], ex[1] - c[1]], b: [ez[0] - c[0], ez[1] - c[1]] };
};
const screenBox = (part, x, y, z, w, h, lines) => {
  const f = faceAt(x, y, z);
  const m = `matrix(${[...f.a, ...f.b, ...f.c].map((v) => v.toFixed(2)).join(" ")})`;
  const text = lines.map((line, i) => `<text data-part="${line.part}" class="iso-face-text pm-readout" x="${f.c[0].toFixed(2)}" y="${(f.c[1] + (i - (lines.length - 1) / 2) * 3.1).toFixed(2)}">${line.sample}</text>`).join("");
  return `<g class="pm-screen" data-part="${part}"><g transform="${m}"><rect x="${(-w / 2).toFixed(2)}" y="${(-h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="0.4"/></g>${text}</g>`;
};

let body = "";
let open = undefined;
for (const item of page.bag) {
  if (item.group !== open) {
    if (open) body += `</g>`;
    open = item.group;
    if (open) body += `<g data-part="dripper-${open}" data-dripper="${open}" display="${open === "v60" ? "inline" : "none"}">`;
  }
  body += item.svg;
  if (item.name.endsWith(".grounds")) body += groundsOf(open) + waterOf(open) + streamOf(open) + dripOf(open);
  if (item.name.endsWith(".valve")) body += "";
}
if (open) body += `</g>`;
body += liquidOf();
body += `<g data-part="grind-mark" transform="rotate(0 ${dialHub[0].toFixed(2)} ${dialHub[1].toFixed(2)})"><circle cx="${dialAt[0].toFixed(2)}" cy="${dialAt[1].toFixed(2)}" r="1.35"/></g>`;
body += `<g data-part="hopper-beans">${beanOf()}</g>`;
body += screenBox("scale-screen", 83, 105.2, 9.8, 22, 8, [
  { part: "scale-weight", sample: "0.0 g" },
  { part: "scale-time", sample: "0:00" },
]);
body += screenBox("kettle-screen", 29, 42.2, 10, 12, 4.2, [
  { part: "temp-screen", sample: "93.0°C" },
]);
const svg = k.figureSvg({
  width: W, height: H,
  label: "手沖台剖面，看得到粉、水與咖啡液面。",
  body,
});

const extraCss = `.pm-machine{min-height:0;max-width:100%}.pm-machine>.iso{width:100%;max-width:640px;--anatomy-card:var(--paper,#171717);--anatomy-page:var(--paper,#171717)}.pm-machine .iso-plate{width:100%;box-sizing:border-box;padding:28px 8px 36px}.pm-machine .iso-svg{width:100%;height:auto;overflow:visible;display:block}.pm-machine .iso-swatch{width:16px;height:10px;flex:none}.pm-machine .iso-plate-corners{inset:8px 12px}.pm-cut>.iso-solid>.iso-fill,.pm-cut>.iso-solid>.iso-top,.pm-cut>.iso-solid>.iso-shade{opacity:.4}.pm-water{fill:#b7c6d1;stroke:#8ea0ad;stroke-width:.6}.pm-water-line{stroke:#b7c6d1;stroke-linecap:round}.pm-coffee{fill:#b45309;stroke:#b45309;stroke-width:.5}.pm-coffee-line{stroke:#b45309;stroke-linecap:round}.pm-ground{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}.pm-bean{fill:#6f4a32;stroke:#3b2416;stroke-width:.3}.pm-screen rect{fill:#141210;stroke:#8a7040;stroke-width:1}.pm-readout{fill:#f5b84a;font:600 2.6px ui-monospace,Consolas,monospace;text-anchor:middle}.pm-machine [data-part="grind-mark"]{fill:#f5b84a;stroke:none}@media(max-width:420px){.pm-machine .iso-plate{padding:22px 4px 34px}.pm-machine .iso-plate-corner{font-size:10px}.pm-machine .iso-plate-corner[data-corner="title"]{font-size:12px}.pm-machine .iso-keys,.pm-machine .iso-caption{font-size:11px}}`;
const copy = {
  zh: {
    title: "手沖台，打開來看",
    hint: "拖下面的滑桿，器材跟著動",
    keys: ["粉層", "濾杯", "細口壺", "下壺", "磨豆機調整環"],
    caption: "粉越細、水越熱，萃取越多；秤上的克數和時間，就是下方圖表同一瞬間的值。",
    label: "手沖台剖面，看得到粉、水與咖啡液面。",
  },
  en: {
    title: "A pour-over station, opened up",
    hint: "Drag the sliders below; the gear follows",
    keys: ["Grounds", "Dripper", "Gooseneck kettle", "Carafe", "Grind adjustment ring"],
    caption: "Finer grounds and hotter water extract more; the grams and the time on the scale are the chart below at that same moment.",
    label: "Cutaway pour-over station, with grounds, water and the coffee surface visible.",
  },
};
const card = () => `<div class="iso">${k.plateHtml({
  fig: "Fig 1", title: copy.zh.title, hint: copy.zh.hint, readout: "93.0°C · 0.0 g · 0:00",
  keys: [
    { mark: "lit", label: copy.zh.keys[0] },
    { mark: "raised", label: copy.zh.keys[1] },
    { mark: "line", label: copy.zh.keys[2] },
    { mark: "dot", label: copy.zh.keys[3] },
    { mark: "raised", label: copy.zh.keys[4] },
  ],
  caption: copy.zh.caption,
  body: `<div class="iso-stage">${svg}</div>`,
})}</div>`;
const css = (k.ISO_CSS + extraCss).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").trim();
const zhCard = card().replace(/>\s+</g, "><").trim();
const dialPivot = `${dialHub[0].toFixed(2)} ${dialHub[1].toFixed(2)}`;
const levelOrigin = at([CUP[0], 86, 18]);
const levelPivot = `${levelOrigin[0].toFixed(2)} ${levelOrigin[1].toFixed(2)}`;
const runtime = `(function(root,factory){var api=factory();if(root)root.PourOverMachine=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){"use strict";var VERSION="1.0.0";var CSS=${JSON.stringify(css)};var CARD=${JSON.stringify(zhCard)};var EN=${JSON.stringify([[copy.zh.caption, copy.en.caption],[copy.zh.label, copy.en.label],[copy.zh.title, copy.en.title],[copy.zh.hint, copy.en.hint],[copy.zh.keys[4], copy.en.keys[4]],[copy.zh.keys[2], copy.en.keys[2]],[copy.zh.keys[0], copy.en.keys[0]],[copy.zh.keys[3], copy.en.keys[3]],[copy.zh.keys[1], copy.en.keys[1]]])};function n(v,d){v=Number(v);return Number.isFinite(v)?v:d}function clamp(v,a,b){return Math.max(a,Math.min(b,v))}function mount(container,options){if(!container||typeof container.querySelector!=="function")throw new TypeError("PourOverMachine.mount requires a container");if(typeof document!=="undefined"&&!document.getElementById("pourover-machine-style")){var style=document.createElement("style");style.id="pourover-machine-style";style.textContent=CSS;document.head.appendChild(style)}var lang=options&&options.lang==="en"?"en":"zh",html=CARD;if(lang==="en")for(var i=0;i<EN.length;i++)html=html.split(EN[i][0]).join(EN[i][1]);if(container.classList)container.classList.add("pm-machine");container.innerHTML=html;var plate=container.querySelector(".iso"),svg=container.querySelector("svg"),q=function(p){return container.querySelector('[data-part="'+p+'"]')};function theme(){if(!plate||typeof document==="undefined")return;if(document.documentElement.classList.contains("dark"))plate.removeAttribute("data-theme");else plate.setAttribute("data-theme","light")}theme();var observer=null;if(typeof MutationObserver!=="undefined"&&typeof document!=="undefined"){observer=new MutationObserver(theme);observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]})}if(svg)svg.setAttribute("aria-label",lang==="en"?"Animated cutaway pour-over station":"會動的手沖台剖面圖");function update(state){state=state||{};var grind=clamp(n(state.grind,700),400,1200),temp=n(state.temp,93),pourRate=clamp(n(state.pourRate,5),0,20),pouring=state.pouring===true,poured=n(state.poured,0),head=n(state.head,0),flow=n(state.flow,0),cup=Math.max(0,n(state.cup,0)),dripper=["v60","kadou","kalita","melitta","clever"].indexOf(state.dripper)>=0?state.dripper:"v60",valve=state.valve!==false,phase=state.phase||"idle",elapsed=typeof state.elapsed==="string"?state.elapsed:"0:00";var kinds=["v60","kadou","kalita","melitta","clever"];for(var i=0;i<kinds.length;i++){var g=q("dripper-"+kinds[i]);if(g)g.setAttribute("display",kinds[i]===dripper?"inline":"none")}var ang=((grind-400)/800*270).toFixed(2);var mark=q("grind-mark");if(mark)mark.setAttribute("transform","rotate("+ang+" ${dialPivot})");var radius=(0.7+(grind-400)/800*1.5).toFixed(2);function list(part){var out=[],found=container.querySelectorAll?container.querySelectorAll('[data-part="'+part+'"]'):[];for(var i=0;i<found.length;i++)out.push(found[i]);if(!out.length){var one=q(part);if(one)out.push(one)}return out}var dots=list("grounds-dot-"+dripper);for(var d=0;d<dots.length;d++){dots[d].setAttribute("rx",radius);dots[d].setAttribute("ry",(Number(radius)*0.62).toFixed(2))}var tempText=temp.toFixed(1)+"°C",weightText=poured.toFixed(1)+" g";var el=q("temp-screen");if(el)el.textContent=tempText;el=q("scale-weight");if(el)el.textContent=weightText;el=q("scale-time");if(el)el.textContent=elapsed;el=container.querySelector("[data-readout]");if(el)el.textContent=tempText+" · "+weightText+" · "+elapsed;el=q("stream-"+dripper);if(el){el.setAttribute("display",pouring?"inline":"none");el.setAttribute("stroke-width",(0.8+pourRate*0.35).toFixed(2))}el=q("water-"+dripper);if(el)el.setAttribute("display",head<0.5?"none":"inline");var dripOn=flow>0.05&&(dripper!=="clever"||valve);el=q("drip-"+dripper);if(el){el.setAttribute("display",dripOn?"inline":"none");el.setAttribute("stroke-width",(0.6+Math.max(0,flow)*0.28).toFixed(2))}el=q("carafe-level");if(el){var s=Math.min(1,cup/300);el.setAttribute("transform","translate(${levelPivot}) scale(1 "+s.toFixed(4)+") translate(${levelPivot.split(" ").map((v) => -Number(v)).join(" ")})")}el=q("hopper-beans");if(el)el.setAttribute("display",phase==="idle"?"inline":"none");el=q("clever-valve");if(el)el.setAttribute("transform",valve?"translate(0 -7)":"translate(0 0)")}update({});return{update:update,destroy:function(){if(observer)observer.disconnect()}}}return{mount:mount,VERSION:VERSION};});\n`;

mkdirSync(TEMP, { recursive: true });
writeFileSync(OUT, runtime, "utf8");
const baseState = "{t:150,grind:700,temp:93,pourRate:5,pouring:true,poured:200,head:120,flow:3.2,cup:110,phase:'pour',elapsed:'2:30'}";
const preview = (light, extra) => `<!doctype html><html${light ? "" : ' class="dark"'}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{overflow-x:hidden;background:${light ? "#f0ede5" : "#101010"};--paper:${light ? "#f7f4ec" : "#171717"}}body{margin:0;padding:12px}.host{max-width:640px;width:100%;margin:auto}</style></head><body><div class="host"></div><script>${runtime.replace(/<\/script/gi, "<\\/script")}</script><script>PourOverMachine.mount(document.querySelector('.host'),{lang:'zh'}).update(${extra || baseState});</script></body></html>`;
writeFileSync(join(TEMP, "preview.html"), preview(false), "utf8");
writeFileSync(join(TEMP, "preview-light.html"), preview(true), "utf8");
writeFileSync(join(TEMP, "preview-kadou.html"), preview(false, baseState.replace("phase:'pour'", "phase:'pour',dripper:'kadou'")), "utf8");
writeFileSync(join(TEMP, "preview-kalita.html"), preview(false, baseState.replace("phase:'pour'", "phase:'pour',dripper:'kalita'")), "utf8");
writeFileSync(join(TEMP, "preview-melitta.html"), preview(false, baseState.replace("phase:'pour'", "phase:'pour',dripper:'melitta'")), "utf8");
writeFileSync(join(TEMP, "preview-clever.html"), preview(false, "{t:150,grind:700,temp:93,pourRate:5,pouring:true,poured:200,head:120,flow:0,cup:110,phase:'steep',elapsed:'2:30',dripper:'clever',valve:false}"), "utf8");
const raw = Buffer.byteLength(runtime);
const gz = gzipSync(runtime).length;
const sha = createHash("sha256").update(runtime).digest("hex");
const paths = (svg.match(/<path\b/g) || []).length;
console.log(`wrote ${OUT}`);
console.log(`sha256 ${sha}`);
console.log(`parts page paths: ${paths}`);
console.log(`size: ${raw} bytes · ${gz} bytes gzip`);
console.log(`slots: ${DRAW_SLOTS.join(" ")}`);
console.log("geometry: per-dripper grounds, water, stream and drip nodes");
if (process.argv.includes("--audit")) {
  for (const kind of DRIPPERS) {
    const audited = scene([kind], true);
    A.settle(audited.R, P);
    console.log(`audit solids ${kind}: ${audited.R.solids.length}`);
    A.auditOrExit(audited.R, P);
  }
} else console.log("audit skipped (pass --audit)");
