/*
MIT License

Copyright (c) 2026 Ryan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Adapted from wheresryan22/anatomy, commit e6600ff.
Only the projection and prism helpers needed by the espresso-machine figure
are retained. Theme styling is supplied by the generated figure.
*/

const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);

export function cameraOf({ scale, azimuth = 45, elevation = 30 }) {
  const a = azimuth * RADIANS;
  const e = elevation * RADIANS;
  return { sinA: Math.sin(a), cosA: Math.cos(a), sinE: Math.sin(e), cosE: Math.cos(e), k: scale * UNIT };
}

export function iso([x, y, z], projection) {
  const { origin } = projection;
  const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
  return [origin[0] + (x * sinA - y * cosA) * k, origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k];
}

export function depthOf([x, y, z], projection) {
  const { sinA, cosA, sinE, cosE } = cameraOf(projection);
  return (x * cosA + y * sinA) * cosE + z * sinE;
}

const tidy = (value) => {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return text === "-0" ? "0" : text;
};

export function pathOf(points, closed = false) {
  if (!points.length) return "";
  return points.map(([x, y], index) => `${index ? "L" : "M"}${tidy(x)} ${tidy(y)}`).join("") + (closed ? "Z" : "");
}

export function roundedPlan({ x, y, w, d, r }, steps = 6) {
  const radius = Math.max(0, Math.min(r, w / 2, d / 2));
  const corners = [
    [x + w - radius, y + radius, -90],
    [x + w - radius, y + d - radius, 0],
    [x + radius, y + d - radius, 90],
    [x + radius, y + radius, 180],
  ];
  const out = [];
  for (const [cx, cy, start] of corners) {
    const count = radius ? steps : 0;
    for (let step = 0; step <= count; step++) {
      const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
      out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
  }
  return out;
}

export function prism(plan, z, height, projection, steps = 6) {
  const ring = roundedPlan(plan, steps);
  const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
  const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
  const left = [bottom[ring.length - 1], bottom[0], top[0], top[ring.length - 1]];
  const rightIndex = Math.floor(ring.length / 2);
  const right = [bottom[rightIndex - 1], bottom[rightIndex], top[rightIndex], top[rightIndex - 1]];
  return { top: pathOf(top, true), left: pathOf(left, true), right: pathOf(right, true), outline: pathOf([...bottom, ...top.slice().reverse()], true) };
}

export function boxSvg(plan, z, height, projection, { className = "", part = "" } = {}) {
  const shape = prism(plan, z, height, projection);
  const attrs = `${className ? ` class="${className}"` : ""}${part ? ` data-part="${part}"` : ""}`;
  return `<g${attrs}><path class="em-face em-face-left" d="${shape.left}"/><path class="em-face em-face-right" d="${shape.right}"/><path class="em-top" d="${shape.top}"/><path class="em-edge" d="${shape.outline}"/></g>`;
}

export function fitProjection(points, width, height, { pad = 24, azimuth = 45, elevation = 30 } = {}) {
  const unit = { origin: [0, 0], scale: 1, azimuth, elevation };
  const flat = points.map((point) => iso(point, unit));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const left = Math.min(...xs), right = Math.max(...xs), up = Math.min(...ys), down = Math.max(...ys);
  const scale = Math.min((width - pad * 2) / (right - left), (height - pad * 2) / (down - up));
  return { origin: [width / 2 - ((left + right) / 2) * scale, height / 2 - ((up + down) / 2) * scale], scale, azimuth, elevation };
}
