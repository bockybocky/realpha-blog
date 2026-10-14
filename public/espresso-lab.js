/*!
 * 義式濃縮調整實驗室 — 純前端教學模型
 * 一般 <script defer> 載入即可，不用 ES module、不用外部套件、不發網路請求。
 *
 *   <div data-lab-demo="espresso" data-lang="zh-TW"></div>
 *   <script defer src="espresso-lab.js"></script>
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var DOSE = 18;
  var TARGET_CUP = 36;
  var PREINFUSE = 4;
  var RAMP_S = 6;
  var EYMAX = 28;
  var AMBER = '#d97706';

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function instFlow(t, F) {
    if (t <= 0) return 0;
    if (t <= PREINFUSE) return 0.3 * (t / PREINFUSE);
    if (t <= PREINFUSE + RAMP_S) {
      return 0.3 + (F - 0.3) * ((t - PREINFUSE) / RAMP_S);
    }
    return F * (1 + 0.012 * (t - PREINFUSE - RAMP_S));
  }

  function EY(t, rate) {
    return EYMAX * (1 - Math.exp(-rate * t));
  }

  function interp(curve, t) {
    if (!curve || !curve.length) return { t: t, ey: 0, flow: 0, cup: 0 };
    if (t <= curve[0].t) return { t: t, ey: curve[0].ey, flow: curve[0].flow, cup: curve[0].cup };
    var last = curve[curve.length - 1];
    if (t >= last.t) return { t: t, ey: last.ey, flow: last.flow, cup: last.cup };
    for (var i = 1; i < curve.length; i++) {
      if (t <= curve[i].t) {
        var a = curve[i - 1];
        var b = curve[i];
        var span = b.t - a.t;
        var u = span === 0 ? 0 : (t - a.t) / span;
        return {
          t: t,
          ey: a.ey + (b.ey - a.ey) * u,
          flow: a.flow + (b.flow - a.flow) * u,
          cup: a.cup + (b.cup - a.cup) * u
        };
      }
    }
    return { t: t, ey: last.ey, flow: last.flow, cup: last.cup };
  }

  function model(input) {
    var grind = Number(input.grind);
    var temp = Number(input.temp);
    var pressure = Number(input.pressure);
    var Peff = pressure <= 9 ? pressure : 9 + (pressure - 9) * 0.35;
    var flow = 1.45 * Math.pow(grind / 300, 2) * (Peff / 9);
    var rate = 0.0447 * (300 / grind) * Math.exp(0.045 * (temp - 93));
    var channel = clamp((240 - grind) / 60, 0, 1) * clamp((pressure - 8.5) / 2.5, 0, 1);

    var dt = 0.05;
    var t = 0;
    var cup = 0;
    var fPrev = 0;
    var hi = [{ t: 0, flow: 0, cup: 0 }];
    var shotTime = 180;
    while (t < 180) {
      t += dt;
      var fNow = instFlow(t, flow);
      cup += (fPrev + fNow) * 0.5 * dt;
      fPrev = fNow;
      hi.push({ t: t, flow: fNow, cup: cup });
      if (cup >= TARGET_CUP) {
        var prev = hi[hi.length - 2];
        var cur = hi[hi.length - 1];
        var frac = (TARGET_CUP - prev.cup) / (cur.cup - prev.cup);
        shotTime = prev.t + frac * (cur.t - prev.t);
        break;
      }
    }

    function sampleAt(ts) {
      var f = instFlow(ts, flow);
      var eyRaw = EY(ts, rate);
      var eyPt = eyRaw * (1 - 0.15 * channel);
      var c = 0;
      if (ts <= 0) c = 0;
      else if (ts >= shotTime) {
        var lastHi = hi[hi.length - 1];
        var prevHi = hi.length > 1 ? hi[hi.length - 2] : lastHi;
        if (lastHi.cup >= TARGET_CUP && prevHi.t <= shotTime) {
          c = TARGET_CUP;
        } else {
          c = lastHi.cup;
        }
      } else {
        for (var i = 1; i < hi.length; i++) {
          if (hi[i].t >= ts) {
            var a = hi[i - 1];
            var b = hi[i];
            var u = (ts - a.t) / (b.t - a.t);
            c = a.cup + (b.cup - a.cup) * u;
            f = a.flow + (b.flow - a.flow) * u;
            break;
          }
        }
      }
      return { t: ts, ey: eyPt, flow: f, cup: c };
    }

    var curve = [];
    for (var ts = 0; ts < shotTime - 1e-9; ts += 0.5) {
      curve.push(sampleAt(ts));
    }
    var endPt = sampleAt(shotTime);
    endPt.cup = TARGET_CUP;
    endPt.ey = EY(shotTime, rate) * (1 - 0.15 * channel);
    curve.push(endPt);

    var eyEff = endPt.ey;
    var tds = eyEff * DOSE / TARGET_CUP;
    var balance = clamp((eyEff - 20) / 4 + (temp - 93) * 0.06, -1, 1);
    var taste = {
      sour: clamp(0.5 - balance * 0.6 + channel * 0.3, 0, 1),
      sweet: clamp(1 - Math.abs(eyEff - 20) / 4 - channel * 0.4, 0, 1),
      bitter: clamp(0.5 + balance * 0.6 + channel * 0.3, 0, 1),
      body: clamp((tds - 7) / 5, 0, 1)
    };
    var zone = eyEff < 18 ? 'under' : eyEff > 22 ? 'over' : 'ideal';

    return {
      flow: flow,
      shotTime: shotTime,
      ey: eyEff,
      tds: tds,
      channel: channel,
      balance: balance,
      taste: taste,
      zone: zone,
      curve: curve
    };
  }

  model.interp = interp;

  function eyState(ey) { return ey < 18 ? 'under' : ey > 22 ? 'over' : 'ideal'; }
  function timeState(seconds) { return seconds < 20 ? 'fast' : seconds > 35 ? 'slow' : 'normal'; }
  function flowState(flow) { return flow < 1 ? 'slow' : flow > 2 ? 'fast' : 'normal'; }
  function puckState(channel) { return channel < 0.15 ? 'even' : channel <= 0.4 ? 'risk' : 'channeling'; }

  var STR = {
    zh: {
      grind: '研磨度', grindHint: '細 ← → 粗',
      temp: '水溫', pressure: '壓力',
      unitUm: 'µm', unitC: '°C', unitBar: 'bar',
      sour: '太酸（萃取不足）', balanced: '平衡', bitter: '太苦（過萃）', turbo: '渦輪濃縮', reset: '重設',
      play: '▶ 完整沖煮',
      stages: ['1 落豆', '2 磨粉', '3 填粉', '4 萃取', '5 打奶泡', '6 拉花', '7 完成'],
      ey: '萃取率', flow: '流速', time: '萃取時間', tds: '濃度', cup: '杯重', puck: '粉餅狀態',
      eyHint: '理想 18–22%',
      unitPct: '%', unitGps: 'g/s', unitS: '秒', unitG: 'g',
      chartEy: '萃取率隨時間', chartFlow: '流速與杯中重量',
      chartBal: '酸苦平衡',
      stop: '停止', acid: '酸', sweet: '甜', bitterL: '苦', body: '醇厚',
      sweetZone: '甜區',
      yEy: '萃取率 %', yFlow: '流速 g/s', yCup: '杯重 g',
      idealBand: '理想 18–22%', target36: '目標 36 g', typicalFlow: '常見流速',
      zoneUnder: '萃取不足', zoneIdeal: '甜蜜點', zoneOver: '過萃', speedFast: '偏快', speedNormal: '標準', speedSlow: '偏慢', flowNormal: '正常',
      puckEven: '均勻', puckRisk: '有通道風險', puckChanneling: '通道明顯',
      under: '偏酸、萃取不足：試著研磨調細一點，或水溫提高 1–2 度。',
      over: '偏苦、過度萃取：試著研磨調粗一點，或水溫降低 1–2 度。',
      ideal: '落在理想區間，酸甜苦平衡。',
      ch: '粉太細又壓太大，水可能鑽出裂縫（通道效應），同一杯會又酸又苦。',
      footnote: '這是簡化的教學模型，用來看方向，不是精準預測；實際還要看豆子、烘焙度與機器。'
    },
    en: {
      grind: 'Grind', grindHint: 'fine ← → coarse',
      temp: 'Temp', pressure: 'Pressure',
      unitUm: 'µm', unitC: '°C', unitBar: 'bar',
      sour: 'Too sour (under)', balanced: 'Balanced', bitter: 'Too bitter (over)', turbo: 'Turbo shot', reset: 'Reset',
      play: '▶ Make latte',
      stages: ['1 Beans', '2 Grind', '3 Dose', '4 Extract', '5 Steam', '6 Pour & art', '7 Done'],
      ey: 'Extraction', flow: 'Flow', time: 'Shot time', tds: 'TDS', cup: 'Cup', puck: 'Puck',
      eyHint: 'ideal 18–22%',
      unitPct: '%', unitGps: 'g/s', unitS: 's', unitG: 'g',
      chartEy: 'Extraction over time', chartFlow: 'Flow and cup weight',
      chartBal: 'Sour–bitter balance',
      stop: 'Stop', acid: 'Sour', sweet: 'Sweet', bitterL: 'Bitter', body: 'Body',
      sweetZone: 'sweet zone',
      yEy: 'EY %', yFlow: 'flow g/s', yCup: 'cup g',
      idealBand: 'Ideal 18–22%', target36: 'Target 36 g', typicalFlow: 'Typical flow',
      zoneUnder: 'Under', zoneIdeal: 'Sweet spot', zoneOver: 'Over', speedFast: 'Fast', speedNormal: 'Normal', speedSlow: 'Slow', flowNormal: 'Normal',
      puckEven: 'Even', puckRisk: 'Some channeling risk', puckChanneling: 'Channeling',
      under: 'Sour and under-extracted: grind a bit finer, or raise water temp 1–2°C.',
      over: 'Bitter and over-extracted: grind a bit coarser, or lower water temp 1–2°C.',
      ideal: 'In the ideal window; sour, sweet and bitter are in balance.',
      ch: 'Too fine and too much pressure: water may cut channels, so the same cup tastes both sour and bitter.',
      footnote: 'A simplified teaching model for direction, not a precise prediction. Beans, roast and the machine still matter.'
    }
  };

  var PRESETS = {
    sour: { grind: 380, temp: 89, pressure: 9 },
    bal: { grind: 300, temp: 93, pressure: 9 },
    bitter: { grind: 210, temp: 95.5, pressure: 10.5 },
    turbo: { grind: 420, temp: 93, pressure: 6 }
  };
  var DEFAULTS = PRESETS.bal;

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected || typeof document === 'undefined') return;
    if (document.getElementById('es-lab-style')) {
      styleInjected = true;
      return;
    }
    var css = document.createElement('style');
    css.id = 'es-lab-style';
    css.textContent = [
      '.es-root{display:flex;flex-direction:column;gap:0.9rem;color:var(--text);min-width:0;max-width:100%;}',
      '.es-machine{min-height:0;}',
      '.es-step{text-align:center;font-weight:700;letter-spacing:.04em;color:var(--accent);min-height:1.5em;margin:.25rem 0 0;}',
      '.es-sliders{display:flex;flex-direction:column;gap:0.7rem;}',
      '.es-row{display:grid;grid-template-columns:6.2rem 1fr auto;gap:0.55rem;align-items:center;}',
      '.es-row label{font-size:0.88rem;color:var(--muted);}',
      '.es-row input[type=range]{width:100%;accent-color:var(--accent);}',
      '.es-val{font-variant-numeric:tabular-nums;font-size:0.88rem;min-width:5.4rem;text-align:right;}',
      '.es-hint{grid-column:2;font-size:0.75rem;color:var(--muted);margin-top:-0.35rem;}',
      '.es-btns{display:flex;flex-wrap:wrap;gap:0.45rem;}',
      '.es-btns button{font:inherit;font-size:0.82rem;padding:0.35rem 0.7rem;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--text);cursor:pointer;}',
      '.es-btns button:hover{border-color:var(--accent);}',
      '.es-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.55rem;}',
      '.es-num{border:1px solid var(--line);border-radius:8px;padding:0.55rem 0.6rem;background:var(--paper);}',
      '.es-num b{display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;font-size:1.15rem;font-variant-numeric:tabular-nums;}',
      '.es-num span{font-size:0.75rem;color:var(--muted);}',
      '.es-num .es-metric-value{font-size:inherit;color:var(--text);}',
      '.es-badge[hidden]{display:none;}',
      '.es-badge{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:0.15rem 0.42rem;border:1px solid currentColor;border-radius:999px;font-size:0.68rem;line-height:1.25;font-weight:600;white-space:normal;}',
      '.es-badge.es-good{color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);}',
      '.es-badge.es-warn{color:#d97706;background:rgba(217,119,6,.13);}',
      '.es-badge.es-bad{color:#dc2626;background:rgba(220,38,38,.13);}',
      '.es-hint2{display:block;font-size:0.7rem;color:var(--muted);}',
      '.es-chart{width:100%;overflow:hidden;}',
      '.es-chart svg{width:100%;height:auto;display:block;max-width:100%;touch-action:pan-y;}',
      '.es-h{font-size:0.88rem;margin:0 0 0.25rem;color:var(--text);}',
      '.es-bars{display:flex;flex-direction:column;gap:0.35rem;}',
      '.es-barrow{display:grid;grid-template-columns:3.2rem 1fr;gap:0.4rem;align-items:center;font-size:0.8rem;color:var(--muted);}',
      '.es-track{height:0.55rem;background:var(--line);border-radius:99px;overflow:hidden;}',
      '.es-fill{height:100%;background:var(--accent);border-radius:99px;}',
      '.es-fill.es-amber{background:' + AMBER + ';}',
      '.es-status{margin:0;line-height:1.65;color:var(--text);}',
      '.es-note{margin:0;font-size:0.82rem;color:var(--muted);}',
      '.es-ruler{position:relative;height:2.4rem;margin:0.4rem 0 0.8rem;}',
      '.es-ruler-line{position:absolute;left:0;right:0;top:1.05rem;height:4px;background:var(--line);border-radius:99px;}',
      '.es-sweetband{position:absolute;left:33.333%;width:33.333%;top:0.85rem;height:0.7rem;background:color-mix(in srgb, var(--accent) 22%, transparent);border-radius:4px;}',
      '.es-needle{position:absolute;top:0.2rem;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:12px solid var(--accent);transform:translateX(-6px);}',
      '.es-rlab{position:absolute;top:1.45rem;font-size:0.75rem;color:var(--muted);}',
      '.es-rlab.es-l{left:0;}',
      '.es-rlab.es-r{right:0;}',
      '.es-rlab.es-m{left:50%;transform:translateX(-50%);color:var(--accent);}',
      '@media (max-width:520px){.es-nums{grid-template-columns:repeat(2,minmax(0,1fr));}.es-row{grid-template-columns:4.6rem minmax(0,1fr) auto;}.es-val{min-width:4.8rem}.es-chart{max-width:100%;}}'
    ].join('');
    document.head.appendChild(css);
    styleInjected = true;
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
    }
    return el;
  }

  function xMax(shotTime) {
    return Math.max(60, Math.ceil(shotTime / 10) * 10);
  }

  function chartFsFromWidth(px) {
    var w = px > 0 ? px : 640;
    var fs = 13 * 640 / w;
    if (fs < 12) fs = 12;
    if (fs > 26) fs = 26;
    return fs;
  }

  function pad(fs) {
    var t = (fs || 13) * 2.2;
    return { l: 58, r: 58, t: t, b: 40, w: 640, h: 220 };
  }

  function tickText(attrs, content) {
    var el = svgEl('text', attrs);
    el.textContent = content;
    return el;
  }

  function drawXTicks(svg, xmax, p, unitS, fs) {
    for (var t = 0; t <= xmax + 1e-9; t += 10) {
      var xx = mapXStatic(t, xmax, p);
      var last = t >= xmax - 1e-9;
      svg.appendChild(tickText({
        x: String(xx),
        y: String(p.h - 8),
        fill: 'var(--muted)',
        'font-size': String(fs),
        'text-anchor': t === 0 ? 'start' : (last ? 'end' : 'middle')
      }, last ? (Math.round(t) + ' ' + unitS) : String(Math.round(t))));
    }
  }

  function mapXStatic(t, xmax, p) {
    return p.l + (t / xmax) * (p.w - p.l - p.r);
  }

  // Full latte storyboard. Only extraction owns chart/model playback.
  var STAGES = [
    { id: 'beans', start: 0, end: 1800 },
    { id: 'grind', start: 1800, end: 3600 },
    { id: 'dose', start: 3600, end: 5600 },
    { id: 'extract', start: 5600, end: 10600 },
    { id: 'steam', start: 10600, end: 12600 },
    { id: 'pour', start: 12600, end: 14500 },
    { id: 'done', start: 14500, end: 16000 }
  ];
  var PLAY_MS = STAGES[STAGES.length - 1].end;

  function mountEspresso(el) {
    if (!el || el.getAttribute('data-es-mounted') === '1') return;
    el.setAttribute('data-es-mounted', '1');
    injectStyle();
    var langKey = el.dataset.lang === 'en' ? 'en' : 'zh';
    var T = STR[langKey];
    var state = { grind: DEFAULTS.grind, temp: DEFAULTS.temp, pressure: DEFAULTS.pressure };
    var result = model(state);
    var machine = null;
    var playing = false;
    var raf = 0;

    var root = document.createElement('div');
    root.className = 'es-root';

    var machineDiv = document.createElement('div');
    machineDiv.className = 'es-machine';
    root.appendChild(machineDiv);
    if (global.EspressoMachine && typeof global.EspressoMachine.mount === 'function') {
      try {
        machine = global.EspressoMachine.mount(machineDiv, { lang: el.dataset.lang || 'zh-TW' });
      } catch (err) {
        machineDiv.style.display = 'none';
        machine = null;
      }
    } else {
      machineDiv.style.display = 'none';
    }
    var stepCaption = document.createElement('p');
    stepCaption.className = 'es-step';
    stepCaption.hidden = true;
    machineDiv.appendChild(stepCaption);

    function sliderRow(key, min, max, step, label, unit, extraHint) {
      var wrap = document.createElement('div');
      var row = document.createElement('div');
      row.className = 'es-row';
      var lab = document.createElement('label');
      lab.textContent = label;
      lab.setAttribute('for', 'es-' + key);
      var inp = document.createElement('input');
      inp.type = 'range';
      inp.id = 'es-' + key;
      inp.min = String(min);
      inp.max = String(max);
      inp.step = String(step);
      inp.value = String(state[key]);
      var val = document.createElement('span');
      val.className = 'es-val';
      function fmt() {
        var n = Number(inp.value);
        val.textContent = (step < 1 ? n.toFixed(1) : String(n)) + ' ' + unit;
      }
      fmt();
      inp.addEventListener('input', function () {
        stopPlay(true);
        state[key] = Number(inp.value);
        fmt();
        redraw();
      });
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(val);
      wrap.appendChild(row);
      if (extraHint) {
        var h = document.createElement('div');
        h.className = 'es-hint';
        h.textContent = extraHint;
        wrap.appendChild(h);
      }
      wrap._input = inp;
      wrap._fmt = fmt;
      return wrap;
    }

    var sliders = document.createElement('div');
    sliders.className = 'es-sliders';
    var gRow = sliderRow('grind', 180, 450, 10, T.grind, T.unitUm, T.grindHint);
    var tRow = sliderRow('temp', 86, 96, 0.5, T.temp, T.unitC);
    var pRow = sliderRow('pressure', 6, 11, 0.5, T.pressure, T.unitBar);
    sliders.appendChild(gRow);
    sliders.appendChild(tRow);
    sliders.appendChild(pRow);
    root.appendChild(sliders);

    var btns = document.createElement('div');
    btns.className = 'es-btns';
    function addBtn(label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      btns.appendChild(b);
      return b;
    }
    function applyPreset(p) {
      stopPlay(true);
      state.grind = p.grind;
      state.temp = p.temp;
      state.pressure = p.pressure;
      gRow._input.value = String(p.grind);
      tRow._input.value = String(p.temp);
      pRow._input.value = String(p.pressure);
      gRow._fmt();
      tRow._fmt();
      pRow._fmt();
      redraw();
    }
    addBtn(T.sour, function () { applyPreset(PRESETS.sour); });
    addBtn(T.balanced, function () { applyPreset(PRESETS.bal); });
    addBtn(T.bitter, function () { applyPreset(PRESETS.bitter); });
    addBtn(T.turbo, function () { applyPreset(PRESETS.turbo); });
    addBtn(T.reset, function () { applyPreset(DEFAULTS); });
    addBtn(T.play, function () { startPlay(); });
    root.appendChild(btns);

    var nums = document.createElement('div');
    nums.className = 'es-nums';
    var numEls = {};
    function numCell(key, label, extra) {
      var d = document.createElement('div');
      d.className = 'es-num';
      var b = document.createElement('b');
      var s = document.createElement('span');
      s.textContent = label;
      d.appendChild(s);
      d.appendChild(b);
      var value = document.createElement('span');
      value.className = 'es-metric-value';
      b.appendChild(value);
      var badge = document.createElement('em');
      badge.className = 'es-badge';
      badge.hidden = true;
      b.appendChild(badge);
      if (extra) {
        var e = document.createElement('span');
        e.className = 'es-hint2';
        e.textContent = extra;
        d.appendChild(e);
      }
      nums.appendChild(d);
      numEls[key] = { value: value, badge: badge };
    }
    numCell('ey', T.ey, T.eyHint);
    numCell('flow', T.flow);
    numCell('time', T.time);
    numCell('tds', T.tds);
    numCell('puck', T.puck);
    var cupCell = document.createElement('div');
    cupCell.className = 'es-num';
    cupCell.style.display = 'none';
    var cupLab = document.createElement('span');
    cupLab.textContent = T.cup;
    var cupB = document.createElement('b');
    cupCell.appendChild(cupLab);
    cupCell.appendChild(cupB);
    nums.appendChild(cupCell);
    numEls.cup = cupB;
    numEls.cupWrap = cupCell;
    root.appendChild(nums);

    var h1 = document.createElement('p');
    h1.className = 'es-h';
    h1.textContent = T.chartEy;
    var c1 = document.createElement('div');
    c1.className = 'es-chart';
    var svg1 = svgEl('svg', { viewBox: '0 0 640 220', role: 'img', 'aria-label': T.chartEy });
    c1.appendChild(svg1);
    root.appendChild(h1);
    root.appendChild(c1);

    var h2 = document.createElement('p');
    h2.className = 'es-h';
    h2.textContent = T.chartFlow;
    var c2 = document.createElement('div');
    c2.className = 'es-chart';
    var svg2 = svgEl('svg', { viewBox: '0 0 640 220', role: 'img', 'aria-label': T.chartFlow });
    c2.appendChild(svg2);
    root.appendChild(h2);
    root.appendChild(c2);

    var h3 = document.createElement('p');
    h3.className = 'es-h';
    h3.textContent = T.chartBal;
    root.appendChild(h3);
    var ruler = document.createElement('div');
    ruler.className = 'es-ruler';
    ruler.innerHTML = '<div class="es-ruler-line"></div><div class="es-sweetband"></div>';
    var needle = document.createElement('div');
    needle.className = 'es-needle';
    ruler.appendChild(needle);
    var lL = document.createElement('span');
    lL.className = 'es-rlab es-l';
    lL.textContent = T.acid;
    var lM = document.createElement('span');
    lM.className = 'es-rlab es-m';
    lM.textContent = T.sweetZone;
    var lR = document.createElement('span');
    lR.className = 'es-rlab es-r';
    lR.textContent = T.bitterL;
    ruler.appendChild(lL);
    ruler.appendChild(lM);
    ruler.appendChild(lR);
    root.appendChild(ruler);

    var bars = document.createElement('div');
    bars.className = 'es-bars';
    var barFills = {};
    ['sour', 'sweet', 'bitter', 'body'].forEach(function (k, i) {
      var names = [T.acid, T.sweet, T.bitterL, T.body];
      var row = document.createElement('div');
      row.className = 'es-barrow';
      var lab = document.createElement('span');
      lab.textContent = names[i];
      var track = document.createElement('div');
      track.className = 'es-track';
      var fill = document.createElement('div');
      fill.className = 'es-fill' + (k === 'bitter' || k === 'body' ? ' es-amber' : '');
      track.appendChild(fill);
      row.appendChild(lab);
      row.appendChild(track);
      bars.appendChild(row);
      barFills[k] = fill;
    });
    root.appendChild(bars);

    var status = document.createElement('p');
    status.className = 'es-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    root.appendChild(status);

    var note = document.createElement('p');
    note.className = 'es-note';
    note.textContent = T.footnote;
    root.appendChild(note);

    el.appendChild(root);

    var playDot1 = null;
    var playDot2a = null;
    var playDot2b = null;
    var lastPlayT = null;
    var lastChartFs = null;
    var hover1 = null;
    var hover2 = null;

    function measureFs(container) {
      var w = container && container.clientWidth ? container.clientWidth : 640;
      return chartFsFromWidth(w);
    }

    function mapX(t, xmax, p) {
      return mapXStatic(t, xmax, p);
    }

    function drawChartEy(res, playT) {
      lastPlayT = playT == null ? null : playT;
      while (svg1.firstChild) svg1.removeChild(svg1.firstChild);
      var fs = measureFs(c1);
      lastChartFs = fs;
      var p = pad(fs);
      var titleY = fs * 0.95;
      var xmax = xMax(res.shotTime);
      function x(t) { return mapX(t, xmax, p); }
      function y(ey) { return p.t + (1 - ey / 28) * (p.h - p.t - p.b); }
      var band = svgEl('rect', {
        x: String(p.l), y: String(y(22)),
        width: String(p.w - p.l - p.r), height: String(y(18) - y(22)),
        fill: 'var(--accent)', opacity: '0.12'
      });
      svg1.appendChild(band);
      svg1.appendChild(tickText({
        x: String(p.w - p.r - 4),
        y: String((y(18) + y(22)) / 2 + 8),
        fill: 'var(--accent)',
        'font-size': String(fs),
        'text-anchor': 'end'
      }, T.idealBand));
      var axes = svgEl('path', {
        d: 'M' + p.l + ' ' + p.t + ' V' + (p.h - p.b) + ' H' + (p.w - p.r),
        fill: 'none', stroke: 'var(--line)', 'stroke-width': '1'
      });
      svg1.appendChild(axes);
      var yTicks = [0, 10, 20, 28];
      yTicks.forEach(function (v) {
        svg1.appendChild(tickText({
          x: String(p.l - 6),
          y: String(y(v) + 7),
          fill: 'var(--muted)',
          'font-size': String(fs),
          'text-anchor': 'end'
        }, String(v)));
      });
      drawXTicks(svg1, xmax, p, T.unitS, fs);
      var d = '';
      res.curve.forEach(function (pt, i) {
        var cmd = i === 0 ? 'M' : 'L';
        d += cmd + x(pt.t).toFixed(2) + ' ' + y(pt.ey).toFixed(2) + ' ';
      });
      svg1.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2' }));
      var end = res.curve[res.curve.length - 1];
      svg1.appendChild(svgEl('line', {
        x1: String(x(res.shotTime)), x2: String(x(res.shotTime)),
        y1: String(p.t), y2: String(p.h - p.b),
        stroke: 'var(--muted)', 'stroke-dasharray': '4 3', 'stroke-width': '1'
      }));
      svg1.appendChild(tickText({
        x: String(x(res.shotTime) + 4), y: String(p.t + 18),
        fill: 'var(--muted)', 'font-size': String(fs)
      }, T.stop));
      svg1.appendChild(svgEl('circle', {
        cx: String(x(end.t)), cy: String(y(end.ey)), r: '4.5', fill: 'var(--accent)'
      }));
      svg1.appendChild(tickText({
        x: String(x(end.t) - 8), y: String(y(end.ey) - 8),
        fill: 'var(--text)', 'font-size': String(fs), 'text-anchor': 'end'
      }, end.ey.toFixed(1) + '%'));
      svg1.appendChild(tickText({
        x: '4', y: String(titleY), fill: 'var(--muted)', 'font-size': String(fs), 'text-anchor': 'start'
      }, T.yEy));
      playDot1 = svgEl('circle', { r: '5', fill: AMBER, cx: '-20', cy: '-20' });
      svg1.appendChild(playDot1);
      if (playT != null) {
        var pt = interp(res.curve, playT);
        playDot1.setAttribute('cx', String(x(pt.t)));
        playDot1.setAttribute('cy', String(y(pt.ey)));
      }
      hover1 = appendHover(svg1, p, xmax, function (pt) { return pt.ey.toFixed(1) + '%'; });
    }

    function drawChartFlow(res, playT) {
      lastPlayT = playT == null ? null : playT;
      while (svg2.firstChild) svg2.removeChild(svg2.firstChild);
      var fs = measureFs(c2);
      lastChartFs = fs;
      var p = pad(fs);
      var titleY = fs * 0.95;
      var xmax = xMax(res.shotTime);
      function x(t) { return mapX(t, xmax, p); }
      function yF(f) { return p.t + (1 - f / 4) * (p.h - p.t - p.b); }
      function yC(c) { return p.t + (1 - c / 40) * (p.h - p.t - p.b); }
      svg2.appendChild(svgEl('rect', {
        x: String(p.l), y: String(yF(1.5)), width: String(p.w - p.l - p.r),
        height: String(yF(1.2) - yF(1.5)), fill: 'rgba(48,164,108,.15)'
      }));
      svg2.appendChild(tickText({
        x: String(p.w - p.r - 4), y: String(yF(1.35) + fs * 0.35), fill: 'var(--accent)',
        'font-size': String(fs), 'text-anchor': 'end'
      }, T.typicalFlow));
      svg2.appendChild(svgEl('path', {
        d: 'M' + p.l + ' ' + p.t + ' V' + (p.h - p.b) + ' H' + (p.w - p.r),
        fill: 'none', stroke: 'var(--line)', 'stroke-width': '1'
      }));
      svg2.appendChild(svgEl('line', {
        x1: String(p.l), x2: String(p.w - p.r),
        y1: String(yC(36)), y2: String(yC(36)),
        stroke: 'var(--muted)', 'stroke-dasharray': '5 4', 'stroke-width': '1'
      }));
      svg2.appendChild(tickText({
        x: String(p.l + 4),
        y: String(yC(36) - 6),
        fill: AMBER,
        'font-size': String(fs),
        'text-anchor': 'start'
      }, T.target36));
      var leftY = [0, 1, 2, 3, 4];
      leftY.forEach(function (v) {
        svg2.appendChild(tickText({
          x: String(p.l - 6),
          y: String(yF(v) + 7),
          fill: 'var(--muted)',
          'font-size': String(fs),
          'text-anchor': 'end'
        }, String(v)));
      });
      var rightY = [0, 10, 20, 30, 40];
      rightY.forEach(function (v) {
        svg2.appendChild(tickText({
          x: String(p.w - p.r + 6),
          y: String(yC(v) + 7),
          fill: AMBER,
          'font-size': String(fs),
          'text-anchor': 'start'
        }, String(v)));
      });
      drawXTicks(svg2, xmax, p, T.unitS, fs);
      var dF = '';
      var dC = '';
      res.curve.forEach(function (pt, i) {
        var cmd = i === 0 ? 'M' : 'L';
        dF += cmd + x(pt.t).toFixed(2) + ' ' + yF(pt.flow).toFixed(2) + ' ';
        dC += cmd + x(pt.t).toFixed(2) + ' ' + yC(pt.cup).toFixed(2) + ' ';
      });
      svg2.appendChild(svgEl('path', { d: dF, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2' }));
      svg2.appendChild(svgEl('path', { d: dC, fill: 'none', stroke: AMBER, 'stroke-width': '1.6', 'stroke-dasharray': '5 3' }));
      svg2.appendChild(tickText({
        x: '4', y: String(titleY), fill: 'var(--muted)', 'font-size': String(fs), 'text-anchor': 'start'
      }, T.yFlow));
      svg2.appendChild(tickText({
        x: String(p.w - 4), y: String(titleY), fill: AMBER, 'font-size': String(fs), 'text-anchor': 'end'
      }, T.yCup));
      playDot2a = svgEl('circle', { r: '5', fill: 'var(--accent)', cx: '-20', cy: '-20' });
      playDot2b = svgEl('circle', { r: '4', fill: AMBER, cx: '-20', cy: '-20' });
      svg2.appendChild(playDot2a);
      svg2.appendChild(playDot2b);
      if (playT != null) {
        var pt = interp(res.curve, playT);
        playDot2a.setAttribute('cx', String(x(pt.t)));
        playDot2a.setAttribute('cy', String(yF(pt.flow)));
        playDot2b.setAttribute('cx', String(x(pt.t)));
        playDot2b.setAttribute('cy', String(yC(pt.cup)));
      }
      hover2 = appendHover(svg2, p, xmax, function (pt) { return pt.flow.toFixed(2) + ' ' + T.unitGps; });
    }

    function appendHover(svg, p, xmax, formatter) {
      var g = svgEl('g', { visibility: 'hidden', 'pointer-events': 'none' });
      var line = svgEl('line', { y1: String(p.t), y2: String(p.h - p.b), stroke: 'var(--muted)', 'stroke-width': '1' });
      var box = svgEl('rect', { width: '150', height: '28', rx: '5', fill: 'var(--paper)', stroke: 'var(--line)' });
      var label = tickText({ fill: 'var(--text)', 'font-size': String(Math.max(12, lastChartFs || 12)), 'dominant-baseline': 'middle' }, '');
      g.appendChild(line); g.appendChild(box); g.appendChild(label); svg.appendChild(g);
      return { g: g, line: line, box: box, label: label, p: p, xmax: xmax, formatter: formatter };
    }

    function moveHover(svg, hover, clientX) {
      if (!hover || !result) return;
      var rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      var vx = (clientX - rect.left) / rect.width * 640;
      if (vx < hover.p.l || vx > hover.p.w - hover.p.r) { hover.g.setAttribute('visibility', 'hidden'); return; }
      var t = clamp((vx - hover.p.l) / (hover.p.w - hover.p.l - hover.p.r) * hover.xmax, 0, result.shotTime);
      var pt = interp(result.curve, t);
      var xx = mapXStatic(pt.t, hover.xmax, hover.p);
      var boxX = xx + 7;
      if (boxX + 150 > hover.p.w - hover.p.r) boxX = xx - 157;
      hover.line.setAttribute('x1', String(xx)); hover.line.setAttribute('x2', String(xx));
      hover.box.setAttribute('x', String(boxX)); hover.box.setAttribute('y', String(hover.p.t + 5));
      hover.label.setAttribute('x', String(boxX + 8)); hover.label.setAttribute('y', String(hover.p.t + 19));
      hover.label.textContent = pt.t.toFixed(1) + ' ' + T.unitS + ' ・ ' + hover.formatter(pt);
      hover.g.setAttribute('visibility', 'visible');
    }

    function bindHover(svg, getHover) {
      svg.addEventListener('pointermove', function (ev) { moveHover(svg, getHover(), ev.clientX); });
      svg.addEventListener('pointerdown', function (ev) { moveHover(svg, getHover(), ev.clientX); });
      svg.addEventListener('pointerleave', function () { var h = getHover(); if (h) h.g.setAttribute('visibility', 'hidden'); });
      svg.addEventListener('pointercancel', function () { var h = getHover(); if (h) h.g.setAttribute('visibility', 'hidden'); });
    }
    bindHover(svg1, function () { return hover1; });
    bindHover(svg2, function () { return hover2; });

    function setMetric(key, text, badgeText, level) {
      var cell = numEls[key];
      cell.value.textContent = text;
      cell.badge.textContent = badgeText;
      cell.badge.className = 'es-badge es-' + level;
      cell.badge.hidden = false;
    }

    function setNums(res, live) {
      var ey = live ? live.ey : res.ey;
      var fl = live ? live.flow : res.flow;
      var tm = live ? live.t : res.shotTime;
      var cup = live ? live.cup : TARGET_CUP;
      var tds = live ? (live.ey * DOSE / TARGET_CUP) : res.tds;
      var ez = eyState(ey);
      var ts = timeState(tm);
      var fs = flowState(fl);
      setMetric('ey', ey.toFixed(1) + T.unitPct, ez === 'under' ? T.zoneUnder : ez === 'ideal' ? T.zoneIdeal : T.zoneOver, ez === 'ideal' ? 'good' : ez === 'under' ? 'warn' : 'bad');
      setMetric('flow', fl.toFixed(2) + ' ' + T.unitGps, fs === 'normal' ? T.flowNormal : fs === 'fast' ? T.speedFast : T.speedSlow, fs === 'normal' ? 'good' : fs === 'fast' ? 'warn' : 'bad');
      setMetric('time', tm.toFixed(1) + ' ' + T.unitS, ts === 'normal' ? T.speedNormal : ts === 'fast' ? T.speedFast : T.speedSlow, ts === 'normal' ? 'good' : ts === 'fast' ? 'warn' : 'bad');
      numEls.tds.value.textContent = tds.toFixed(2) + T.unitPct;
      numEls.tds.badge.hidden = true;
      var ps = puckState(res.channel);
      setMetric('puck', res.channel.toFixed(2),
        ps === 'even' ? T.puckEven : ps === 'risk' ? T.puckRisk : T.puckChanneling,
        ps === 'even' ? 'good' : ps === 'risk' ? 'warn' : 'bad');
      if (live) {
        numEls.cupWrap.style.display = '';
        numEls.cup.textContent = cup.toFixed(1) + ' ' + T.unitG;
      } else {
        numEls.cupWrap.style.display = 'none';
      }
    }

    function pushMachine(res, live) {
      if (!machine || typeof machine.update !== 'function') return;
      var payload = {
        grind: state.grind,
        temp: state.temp,
        pressure: state.pressure,
        flow: live ? live.flow : res.flow,
        cup: live ? live.cup : 36,
        t: live ? live.t : res.shotTime,
        shotTime: res.shotTime,
        channel: res.channel,
        zone: res.zone
      };
      machine.update(payload);
    }

    function showStage(index, u) {
      stepCaption.hidden = false;
      stepCaption.textContent = T.stages[index];
      setNums(result, null);
      drawChartEy(result, null);
      drawChartFlow(result, null);
      if (machine && typeof machine.update === 'function') machine.update({
        grind: state.grind, temp: state.temp, pressure: state.pressure,
        flow: result.flow, cup: index < 3 ? 0 : 36, t: result.shotTime,
        shotTime: result.shotTime, channel: result.channel,
        stage: STAGES[index].id, progress: u
      });
    }

    function redraw() {
      result = model(state);
      setNums(result, null);
      drawChartEy(result, null);
      drawChartFlow(result, null);
      needle.style.left = ((result.balance + 1) / 2 * 100) + '%';
      barFills.sour.style.width = (result.taste.sour * 100) + '%';
      barFills.sweet.style.width = (result.taste.sweet * 100) + '%';
      barFills.bitter.style.width = (result.taste.bitter * 100) + '%';
      barFills.body.style.width = (result.taste.body * 100) + '%';
      var msg = T[result.zone];
      if (result.channel > 0.3) msg += T.ch;
      status.textContent = msg;
      pushMachine(result, null);
    }

    function stopPlay(restoreEnd) {
      playing = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (restoreEnd && result) {
        setNums(result, null);
        drawChartEy(result, null);
        drawChartFlow(result, null);
        pushMachine(result, null);
      }
      stepCaption.hidden = true;
    }

    // Playback timeline: each stage owns [start, end) in ms and a run(u) hook (u = 0..1 inside it).
    // Extraction is one stage that drives the charts, numbers and machine; more stages can be
    // inserted before/after it (see STAGES / PLAY_MS on EspressoLab).
    var stageRun = {
      beans: function (u) { showStage(0, u); },
      grind: function (u) { showStage(1, u); },
      dose: function (u) { showStage(2, u); },
      extract: function (u) {
        stepCaption.hidden = false;
        stepCaption.textContent = T.stages[3];
        var t = u * result.shotTime;
        var pt = interp(result.curve, t);
        setNums(result, pt);
        drawChartEy(result, t);
        drawChartFlow(result, t);
        pushMachine(result, pt);
      },
      steam: function (u) { showStage(4, u); },
      pour: function (u) { showStage(5, u); },
      done: function (u) { showStage(6, u); }
    };

    function startPlay() {
      stopPlay(false);
      result = model(state);
      playing = true;
      var t0 = 0;
      function tick(now) {
        if (!playing) return;
        if (!t0) t0 = now;
        var ms = Math.min(PLAY_MS, now - t0);
        for (var si = 0; si < STAGES.length; si++) {
          var st = STAGES[si];
          if (ms >= st.start && (ms < st.end || (si === STAGES.length - 1 && ms >= PLAY_MS))) {
            stageRun[st.id](Math.min(1, (ms - st.start) / (st.end - st.start)));
            break;
          }
        }
        if (ms < PLAY_MS) raf = requestAnimationFrame(tick);
        else {
          playing = false;
          setNums(result, null);
          drawChartEy(result, null);
          drawChartFlow(result, null);
          pushMachine(result, null);
          stepCaption.hidden = true;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    redraw();

    // Auto-play once when the machine first scrolls into view (not under reduced motion).
    var reduceMotion = typeof global.matchMedia === 'function' && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (machine && !reduceMotion && typeof IntersectionObserver !== 'undefined') {
      var autoIo = new IntersectionObserver(function (entries) {
        for (var ei = 0; ei < entries.length; ei++) {
          if (entries[ei].isIntersecting) {
            autoIo.disconnect();
            if (!playing) startPlay();
            return;
          }
        }
      }, { threshold: 0.4 });
      autoIo.observe(machineDiv);
    }

    // Click (or Enter/Space) on the machine figure replays the full brew, same as the play button.
    if (machine) {
      machineDiv.style.cursor = 'pointer';
      machineDiv.setAttribute('role', 'button');
      machineDiv.setAttribute('tabindex', '0');
      machineDiv.setAttribute('aria-label', T.play.replace('▶ ', ''));
      machineDiv.addEventListener('click', function () { startPlay(); });
      machineDiv.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startPlay(); }
      });
    }

    if (typeof ResizeObserver !== 'undefined') {
      var chartRo = new ResizeObserver(function () {
        var fs = measureFs(c1);
        if (fs === lastChartFs) return;
        if (!result) return;
        lastChartFs = fs;
        drawChartEy(result, lastPlayT);
        drawChartFlow(result, lastPlayT);
      });
      chartRo.observe(c1);
      chartRo.observe(c2);
    }
  }

  global.EspressoLab = { PLAY_MS: PLAY_MS, STAGES: STAGES, model: model, VERSION: VERSION, interp: interp, states: { ey: eyState, time: timeState, flow: flowState, puck: puckState } };
  global.mountEspresso = mountEspresso;

  function autoMount() {
    if (typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('[data-lab-demo="espresso"]');
    for (var i = 0; i < nodes.length; i++) mountEspresso(nodes[i]);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PLAY_MS: PLAY_MS, STAGES: STAGES, model: model, interp: interp, VERSION: VERSION, states: { ey: eyState, time: timeState, flow: flowState, puck: puckState }, PRESETS: PRESETS };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
