import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./vendor/anatomy-iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "espresso-machine.js");
const WIDTH = 640;
const HEIGHT = 400;
const P = k.fitProjection([[-92, -58, 0], [92, 58, 0], [-92, -58, 142], [92, 58, 142]], 430, 330, { pad: 18, azimuth: 43, elevation: 29 });
P.origin[0] += 24;
P.origin[1] += 10;
const B = (plan, z, h, options) => k.boxSvg(plan, z, h, P, options);
const pt = (point) => k.iso(point, P).map((value) => Math.round(value * 10) / 10);
const line = (a, b, cls = "em-detail") => `<path class="${cls}" d="${k.pathOf([pt(a), pt(b)])}"/>`;

const body = [];
body.push(`<path class="em-shadow" d="M134 331L316 374L514 279L329 238Z"/>`);
body.push(B({ x: -78, y: -46, w: 156, d: 92, r: 6 }, 0, 9, P, { part: "base" }));
body.push(B({ x: -70, y: -40, w: 140, d: 80, r: 5 }, 9, 112, P, { part: "chassis" }));
body.push(B({ x: -66, y: -36, w: 38, d: 72, r: 4 }, 24, 83, P, { className: "em-cutaway", part: "water-tank" }));
body.push(B({ x: -21, y: -30, w: 55, d: 55, r: 18 }, 37, 61, P, { className: "em-boiler", part: "boiler" }));
body.push(B({ x: 39, y: -29, w: 24, d: 30, r: 10 }, 42, 30, P, { part: "pump" }));
body.push(B({ x: -2, y: 28, w: 58, d: 12, r: 3 }, 23, 18, P, { part: "front-rail" }));
body.push(B({ x: 7, y: 19, w: 38, d: 29, r: 12 }, 15, 12, P, { className: "em-group", part: "group-head" }));
body.push(B({ x: 12, y: 21, w: 29, d: 24, r: 10 }, 8, 7, P, { part: "portafilter-basket" }));
body.push(B({ x: 39, y: 26, w: 59, d: 8, r: 4 }, 11, 8, P, { className: "em-handle", part: "portafilter-handle" }));
body.push(B({ x: 93, y: 25, w: 14, d: 10, r: 4 }, 9, 12, P, { part: "handle-grip" }));
body.push(B({ x: -1, y: 17, w: 10, d: 11, r: 3 }, 20, 20, P, { part: "group-bracket" }));
body.push(B({ x: -4, y: 27, w: 66, d: 17, r: 3 }, 0, 4, P, { part: "drip-tray" }));
body.push(B({ x: 2, y: 30, w: 54, d: 9, r: 2 }, 4, 1.5, P, { part: "drip-grate" }));
body.push(line([-47, -12, 83], [-22, -12, 83], "em-pipe"));
body.push(line([34, -4, 62], [42, -4, 62], "em-pipe"));

const tank = pt([-47, 1, 70]);
body.push(`<path data-part="tank-water" class="em-water" d="M${tank[0] - 25} ${tank[1] + 13}l34 9 30-15-34-9Z"/>`);
const boiler = pt([7, -2, 104]);
body.push(`<g data-part="thermometer" transform="translate(${boiler[0] - 3} ${boiler[1] - 1})"><path class="em-thermo" d="M0 0v37"/><circle class="em-thermo" cx="0" cy="39" r="4"/><path data-part="temp-column" class="em-hot" d="M0 34V24"/><g class="em-temp-ticks">${[0, 1, 2, 3, 4].map((i) => `<path d="M4 ${4 + i * 7}h${i % 2 ? 5 : 8}"/>`).join("")}</g><text data-part="temp-value" class="em-readout" x="13" y="15">0.0°C</text></g>`);
body.push(`<g data-part="heater" class="em-heater" opacity="0.2"><path d="M${boiler[0] - 29} ${boiler[1] + 31}q9-8 18 0t18 0t18 0"/><path d="M${boiler[0] - 25} ${boiler[1] + 39}q8-7 16 0t16 0t16 0"/></g>`);

const gaugeX = 434, gaugeY = 103, gaugeR = 39;
body.push(`<g data-part="gauge"><circle class="em-gauge-case" cx="${gaugeX}" cy="${gaugeY}" r="${gaugeR + 5}"/><circle class="em-gauge-face" cx="${gaugeX}" cy="${gaugeY}" r="${gaugeR}"/><path class="em-green-zone" d="M460.8 125.5A35 35 0 0 1 440.1 137.5"/>${Array.from({ length: 13 }, (_, i) => { const a = (-120 + i * 20) * Math.PI / 180; const r1 = i % 2 ? 31 : 28; return `<path class="em-gauge-tick" d="M${(gaugeX + Math.cos(a) * r1).toFixed(1)} ${(gaugeY + Math.sin(a) * r1).toFixed(1)}L${(gaugeX + Math.cos(a) * 36).toFixed(1)} ${(gaugeY + Math.sin(a) * 36).toFixed(1)}"/>`; }).join("")}<path data-part="pressure-needle" class="em-needle" d="M${gaugeX - 5} ${gaugeY}H${gaugeX + 29}" transform="rotate(-120 ${gaugeX} ${gaugeY})"/><circle class="em-hub" cx="${gaugeX}" cy="${gaugeY}" r="3"/></g><text data-part="pressure-value" class="em-readout em-gauge-number" x="${gaugeX}" y="158">0.0 bar</text>`);

const puckX = 232, puckY = 266;
body.push(`<g data-part="puck"><path class="em-puck-shell" d="M216 265L230 273L248 265L234 257Z"/><g data-part="puck-particles">${Array.from({ length: 24 }, (_, i) => { const col = i % 8, row = Math.floor(i / 8); return `<circle class="em-particle" cx="${220 + col * 3.2 + row * 1.4}" cy="${263 + row * 3 + col * 0.72}" r="1.2"/>`; }).join("")}</g><g data-part="channel-cracks" opacity="0"><path d="M220 265l6 3 5-2 6 3"/><path d="M234 260l-2 6 5 2-3 4"/></g></g>`);

body.push(`<g data-part="brew-stream"><path data-part="flow-stream" class="em-coffee" d="M232 281C232 291 233 298 233 306"/></g>`);
body.push(`<g data-part="cup"><path class="em-cup-back" d="M198 304L269 304L259 368Q234 381 207 368Z"/><path data-part="cup-liquid" class="em-cup-liquid" d="M206 366L261 366L259 366Q234 376 208 366Z"/><path class="em-cup-front" d="M198 304L207 368Q234 381 259 368L269 304"/><path class="em-cup-handle" d="M267 320q25 1 19 24q-4 12-22 9"/><text data-part="cup-value" class="em-readout em-cup-number" x="280" y="374">0.0 g</text></g>`);
body.push(B({ x: -70, y: -40, w: 8, d: 8, r: 3 }, 121, 7, P, { part: "left-cap" }));
body.push(B({ x: 55, y: -40, w: 15, d: 8, r: 3 }, 121, 7, P, { part: "right-cap" }));

const labels = [
  ["water-tank", 48, 76, 197, 155, "Water tank", "水箱", "em-mobile-hide"],
  ["boiler", 61, 147, 247, 180, "Boiler", "鍋爐", ""],
  ["pump", 492, 190, 297, 209, "Pump", "幫浦", "em-mobile-hide"],
  ["gauge-label", 520, 117, 468, 103, "Gauge", "壓力錶", ""],
  ["group-label", 503, 215, 238, 256, "Group head", "沖煮頭", "em-mobile-hide"],
  ["puck-label", 520, 258, puckX, puckY, "Puck", "粉餅", ""],
  ["cup-label", 505, 337, 259, 337, "Cup", "杯子", ""],
];
for (const [part, x, y, ax, ay, en, zh, extra] of labels) body.push(`<g class="em-label ${extra}" data-label="${part}" data-anchor-x="${ax}" data-anchor-y="${ay}"><path d="M${ax} ${ay}L${x - 7} ${y - 4}"/><circle cx="${ax}" cy="${ay}" r="1.7"/><text x="${x}" y="${y}" data-en="${en}" data-zh="${zh}">${zh}</text></g>`);

const SVG = `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" role="img" aria-label="義式咖啡機解剖圖" class="em-svg"><style>
.em-svg{display:block;height:auto;overflow:visible;color:var(--text);font-family:ui-monospace,"SFMono-Regular",Consolas,monospace}.em-svg *{vector-effect:non-scaling-stroke}.em-face{stroke:none}.em-face-left{fill:color-mix(in srgb,var(--paper) 84%,var(--text))}.em-face-right{fill:color-mix(in srgb,var(--paper) 91%,var(--text))}.em-top{fill:var(--paper);stroke:none}.em-edge,.em-detail,.em-pipe{fill:none;stroke:var(--line);stroke-width:.8;stroke-linecap:round;stroke-linejoin:round}.em-pipe{stroke-width:2.2}.em-shadow{fill:var(--text);opacity:.08}.em-cutaway .em-face-left,.em-cutaway .em-face-right{fill:color-mix(in srgb,var(--accent) 8%,var(--paper))}.em-boiler .em-face-left,.em-boiler .em-face-right{fill:color-mix(in srgb,#d97706 10%,var(--paper))}.em-water{fill:var(--accent);opacity:.2;stroke:var(--accent);stroke-width:.7}.em-thermo,.em-temp-ticks path{fill:none;stroke:var(--line);stroke-width:1}.em-hot{fill:none;stroke:#d97706;stroke-width:2.4;stroke-linecap:round}.em-temp-ticks{fill:none;stroke:var(--muted);stroke-width:.7}.em-heater{fill:none;stroke:#d97706;stroke-width:2;stroke-linecap:round}.em-gauge-case{fill:color-mix(in srgb,var(--paper) 80%,var(--text));stroke:var(--line);stroke-width:1}.em-gauge-face{fill:var(--paper);stroke:var(--text);stroke-width:.9}.em-gauge-tick{stroke:var(--muted);stroke-width:.7}.em-green-zone{fill:none;stroke:#16a34a;stroke-width:4;stroke-linecap:round}.em-needle{stroke:#d97706;stroke-width:1.5;stroke-linecap:round}.em-hub{fill:var(--text)}.em-readout{fill:var(--text);font-size:10px;font-variant-numeric:tabular-nums}.em-gauge-number{text-anchor:middle;font-size:8px}.em-puck-shell{fill:color-mix(in srgb,#d97706 25%,var(--paper));stroke:var(--line);stroke-width:.8}.em-particle{fill:#d97706;opacity:.78}.em-particle[data-hidden="true"]{opacity:0}.em-puck [data-part="channel-cracks"]{fill:none;stroke:var(--paper);stroke-width:1.35;stroke-linecap:round}.em-coffee{fill:none;stroke:#d97706;stroke-width:2;stroke-linecap:round}.em-cup-back{fill:color-mix(in srgb,var(--paper) 90%,var(--accent));stroke:none}.em-cup-liquid{fill:#d97706;opacity:.68;stroke:#d97706;stroke-width:.5}.em-cup-front,.em-cup-handle{fill:none;stroke:var(--line);stroke-width:1.3;stroke-linejoin:round}.em-cup-number{font-size:11px}.em-label path{fill:none;stroke:var(--muted);stroke-width:.65}.em-label circle{fill:var(--muted)}.em-label text{fill:var(--muted);font:10px ui-sans-serif,system-ui,sans-serif;letter-spacing:.04em}.em-handle .em-face-left,.em-handle .em-face-right{fill:color-mix(in srgb,var(--paper) 75%,var(--text))}.em-svg[data-mobile="true"] .em-mobile-hide{display:none}.em-svg[data-mobile="true"] .em-label text,.em-svg[data-mobile="true"] .em-readout{font-size:var(--em-mobile-font,20px)}
</style>${body.join("")}</svg>`;

const runtime = `(function(root,factory){var api=factory();if(root)root.EspressoMachine=api;if(typeof module!=="undefined")module.exports=api;})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){"use strict";var SVG=${JSON.stringify(SVG)};var VERSION="1.0.0";function number(value,fallback){value=Number(value);return Number.isFinite(value)?value:fallback;}function clamp(value,low,high){return Math.min(high,Math.max(low,value));}function mount(container,options){if(!container||typeof container.querySelector!=="function")throw new TypeError("EspressoMachine.mount requires a container");var lang=options&&options.lang==="en"?"en":"zh";container.innerHTML=SVG;var svg=container.querySelector("svg");svg.setAttribute("aria-label",lang==="en"?"Animated cutaway espresso machine":"會動的義式咖啡機剖面圖");var labels=svg.querySelectorAll(".em-label text");for(var i=0;i<labels.length;i++)labels[i].textContent=labels[i].getAttribute(lang==="en"?"data-en":"data-zh");function size(width){width=number(width,640);var mobile=width<480;svg.setAttribute("data-mobile",mobile?"true":"false");if(mobile)svg.setAttribute("style","--em-mobile-font:"+(11*640/Math.max(width,1)).toFixed(2)+"px");else svg.setAttribute("style","");}var observed=false;if(typeof ResizeObserver!=="undefined"){var observer=new ResizeObserver(function(entries){var entry=entries&&entries[0],width=entry&&entry.contentRect&&entry.contentRect.width;size(width||container.clientWidth||640);});observer.observe(container);observed=true;}if(!observed&&typeof matchMedia!=="undefined"){var media=matchMedia("(max-width: 479px)");size(container.clientWidth||(media.matches?360:640));if(media&&typeof media.addEventListener==="function")media.addEventListener("change",function(){size(container.clientWidth||(media.matches?360:640));});}else if(!observed)size(container.clientWidth||640);var needle=svg.querySelector('[data-part="pressure-needle"]'),pressureText=svg.querySelector('[data-part="pressure-value"]'),tempText=svg.querySelector('[data-part="temp-value"]'),tempColumn=svg.querySelector('[data-part="temp-column"]'),heater=svg.querySelector('[data-part="heater"]'),flow=svg.querySelector('[data-part="flow-stream"]'),liquid=svg.querySelector('[data-part="cup-liquid"]'),cupText=svg.querySelector('[data-part="cup-value"]'),particles=svg.querySelectorAll(".em-particle"),cracks=svg.querySelector('[data-part="channel-cracks"]');function update(state){state=state||{};var pressure=number(state.pressure,0),temp=number(state.temp,0),cup=number(state.cup,0),grind=number(state.grind,300),rate=number(state.flow,0),channel=number(state.channel,0);var angle=-120+pressure*20;needle.setAttribute("transform","rotate("+angle+" 434 103)");pressureText.textContent=pressure.toFixed(1)+" bar";tempText.textContent=temp.toFixed(1)+"°C";var tempShare=clamp((temp-80)/20,0,1);tempColumn.setAttribute("d","M0 34V"+(34-tempShare*30).toFixed(1));heater.setAttribute("opacity",(0.12+tempShare*0.78).toFixed(2));flow.setAttribute("stroke-width",(0.6+clamp(rate,0,8)*0.55).toFixed(2));var cupShare=clamp(cup/40,0,1),top=366-cupShare*56;liquid.setAttribute("d","M206 "+top.toFixed(1)+"L261 "+top.toFixed(1)+"L259 366Q234 376 208 366Z");cupText.textContent=cup.toFixed(1)+" g";var radius=clamp(0.55+(grind-200)/200*1.2,0.45,2.2),visible=Math.round(clamp(24-(grind-200)/200*10,12,24));for(var i=0;i<particles.length;i++){particles[i].setAttribute("r",radius.toFixed(2));particles[i].setAttribute("data-hidden",i<visible?"false":"true");}cracks.setAttribute("opacity",channel>0.3?"1":"0");}return{update:update};}return{mount:mount,VERSION:VERSION};});\n`;

writeFileSync(OUT, runtime, "utf8");
console.log(`wrote ${OUT}`);
