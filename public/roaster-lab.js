/*!
 * 烘豆機實驗室 — 純前端教學模型
 * 一般 <script defer> 載入即可，不用 ES module、不用外部套件、不發網路請求。
 *
 *   <div data-lab-demo="roaster" data-lang="zh-TW"></div>
 *   <script defer src="roaster-lab.js"></script>
 *
 * 沒有 window.RoasterMachine 時，曲線與數字照常運作。
 */
(function (global) {
  'use strict';

  var PLAY_MS = 15000;
  var AMBER = '#d97706';

  // 教學模型常數。看方向，不預測某一鍋的真實溫度。已對到規格 §5。
  var PARAMS = {
    dt: 1,            // 秒
    bean0: 25,        // 生豆起始溫度 °C
    moist0: 0.11,     // 起始含水率
    tauP: 38.5154912382265,   // 探針時間常數，約 25–40 秒
    tauD: 116,        // 滾筒蓄熱衰退秒數
    k0: 0.002380496887492602, // 基準傳熱 1/秒
    a0: 125.3950413588316,    // 熱風溫度基準 °C
    a1: 2.158301036382259,    // 火力每 1% 提高的熱風溫度
    a2: 0.27,         // 風門偏離 50% 時拉低熱風
    c1: 0.93,         // 投豆溫度高於 200°C 的滾筒蓄熱
    evap: 0.06653301355747675, // 蒸發吸熱，正比於 (豆溫−100) 與剩餘水分
    moist: 0.0048,    // 水分下降速率
    ex: 0.029,        // 一爆前段短暫放熱峰值 °C/秒
    en: 0.08958413050486733,  // 一爆後段吸熱峰值 °C/秒
    exAt: 8,
    exW: 8,
    enAt: 38,
    enW: 14,
    dryTemp: 160,
    crackTemp: 196,
    roastPow: 4.36,   // 從 150°C 累積的冪次，對到 205→0.15、235→1
    limit: 1200
  };

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function fmtTime(sec) {
    if (sec == null || !isFinite(sec)) return '—';
    var s = Math.max(0, Math.round(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function levelOf(bean) {
    if (bean < 210) return '淺焙';
    if (bean < 220) return '中焙';
    if (bean < 228) return '中深焙';
    return '深焙';
  }

  function roastOf(bean) {
    var span = Math.max(0, bean - 150) / 85;
    return clamp(Math.pow(span, PARAMS.roastPow), 0, 1);
  }

  function interp(curve, t) {
    if (!curve || !curve.length) return { t: t, bean: 0, ror: 0, phase: 'drying', roast: 0 };
    if (t <= curve[0].t) return Object.assign({}, curve[0], { t: t });
    var last = curve[curve.length - 1];
    if (t >= last.t) return Object.assign({}, last, { t: t });
    for (var i = 1; i < curve.length; i++) {
      if (t <= curve[i].t) {
        var a = curve[i - 1];
        var b = curve[i];
        var span = b.t - a.t;
        var u = span === 0 ? 0 : (t - a.t) / span;
        return {
          t: t,
          bean: a.bean + (b.bean - a.bean) * u,
          ror: a.ror + (b.ror - a.ror) * u,
          phase: u < 1 ? a.phase : b.phase,
          roast: a.roast + (b.roast - a.roast) * u
        };
      }
    }
    return Object.assign({}, last, { t: t });
  }

  function model(input) {
    input = input || {};
    var charge = clamp(Number(input.charge), 170, 230);
    var power = clamp(Number(input.power), 20, 100);
    var airflow = clamp(Number(input.airflow), 0, 100);
    var drop = clamp(Number(input.drop), 205, 235);
    if (!isFinite(charge)) charge = 200;
    if (!isFinite(power)) power = 70;
    if (!isFinite(airflow)) airflow = 50;
    if (!isFinite(drop)) drop = 215;

    var B = PARAMS.bean0;
    var moist = PARAMS.moist0;
    var tDry = null;
    var tFc = null;
    var tDrop = null;
    var beans = [];
    var probes = [];
    var acc = 0;
    var accs = [];

    for (var t = 0; t <= PARAMS.limit; t++) {
      var e = Math.exp(-t / PARAMS.tauP);
      var probe = B + (charge - B) * e;
      beans.push(B);
      probes.push(probe);
      acc += Math.pow(Math.max(0, B - 150) / 85, PARAMS.roastPow);
      accs.push(acc);
      if (tDry == null && B >= PARAMS.dryTemp) tDry = t;
      if (tFc == null && B >= PARAMS.crackTemp) tFc = t;
      if (B >= drop) {
        tDrop = t;
        break;
      }
      var Ta = PARAMS.a0 + PARAMS.a1 * power - PARAMS.a2 * (airflow - 50) + (charge - 200) * PARAMS.c1 * Math.exp(-t / PARAMS.tauD);
      var k = PARAMS.k0 * (0.85 + 0.3 * airflow / 100);
      var ev = (B > 100 && moist > 0) ? PARAMS.evap * (B - 100) * moist : 0;
      var crack = 0;
      if (tFc != null) {
        var u = t - tFc;
        if (u >= 0 && u <= 60) {
          var exDen = 2 * PARAMS.exW * PARAMS.exW;
          var enDen = 2 * PARAMS.enW * PARAMS.enW;
          crack = PARAMS.ex * Math.exp(-((u - PARAMS.exAt) * (u - PARAMS.exAt)) / exDen)
            - PARAMS.en * Math.exp(-((u - PARAMS.enAt) * (u - PARAMS.enAt)) / enDen);
        }
      }
      B = B + k * (Ta - B) - ev + crack;
      if (B > 100 && moist > 0) moist = Math.max(0, moist - PARAMS.moist * (B - 100) * moist);
    }

    var rors = probes.map(function (p, i) {
      var t0 = Math.max(0, i - 30);
      if (i === t0) return 0;
      return (p - probes[t0]) / (i - t0) * 60;
    });

    var turnT = 0;
    var turnTemp = probes[0];
    for (var i = 1; i < probes.length; i++) {
      if (probes[i] < turnTemp) {
        turnTemp = probes[i];
        turnT = i;
      }
    }

    var stall = false;
    if (tFc != null) {
      for (var j = tFc; j < rors.length; j++) {
        if (!(rors[j] > 0)) stall = true;
      }
    }

    var dtr = (tDrop != null && tFc != null) ? (tDrop - tFc) / tDrop : null;
    var endBean = beans[beans.length - 1];
    var roast = roastOf(endBean);
    var accEnd = accs[accs.length - 1] || 1;

    var curve = [];
    for (var n = 0; n < beans.length; n++) {
      var phase = 'drying';
      if (tDry != null && n >= tDry) phase = 'maillard';
      if (tFc != null && n >= tFc) phase = 'development';
      if (tDrop != null && n >= tDrop) phase = 'development';
      curve.push({
        t: n,
        bean: probes[n],
        ror: rors[n],
        phase: phase,
        roast: roast * (accs[n] / accEnd)
      });
    }

    var warnings = [];
    if (stall) warnings.push('stall');
    if (dtr != null && dtr < 0.15) warnings.push('underdev');
    if (dtr != null && dtr > 0.25) warnings.push('overdev');
    if (tDrop == null) warnings.push('never');
    if (charge >= 225 && power >= 85) warnings.push('scorch');

    return {
      curve: curve,
      turning: { t: turnT, temp: turnTemp },
      dryEnd: tDry,
      firstCrack: tFc,
      dropTime: tDrop,
      dtr: dtr,
      level: levelOf(endBean),
      roast: roast,
      warnings: warnings,
      beanEnd: endBean
    };
  }

  var STR = {
    zh: {
      charge: '投豆溫度', power: '火力', airflow: '風門', drop: '出豆溫度',
      unitC: '°C', unitPct: '%', unitMin: '°C/分',
      standard: '標準中焙', light: '淺焙', dark: '深焙', low: '火太小', hot: '投豆溫太高',
      reset: '重設', play: '▶ 烘焙',
      turning: '轉折點', crack: '一爆', dropT: '出豆', dtr: '發展時間比例', level: '烘焙深淺', notes: '提醒',
      chartBean: '探針豆溫', chartRor: '升溫速度',
      mTurn: '轉折', mDry: '脫水', mCrack: '一爆', mDrop: '出豆',
      none: '沒有特別提醒',
      stall: '一爆後升溫停了，豆子容易烘出悶、平的味道',
      underdev: '一爆後太快出豆，容易有青草味和尖酸',
      overdev: '一爆後拖太久，甜感被苦味蓋過',
      never: '火力不夠，20 分鐘內到不了出豆溫度',
      scorch: '投豆溫度和火力都太高，豆子表面可能先焦',
      lv: { '淺焙': '淺焙', '中焙': '中焙', '中深焙': '中深焙', '深焙': '深焙' },
      notDone: '沒烘完',
      footnote: '這是簡化的教學模型，用來看方向，不是精準預測。豆子、火力曲線與機台仍會改寫結果。'
    },
    en: {
      charge: 'Charge', power: 'Heat', airflow: 'Airflow', drop: 'Drop',
      unitC: '°C', unitPct: '%', unitMin: '°C/min',
      standard: 'Medium', light: 'Light', dark: 'Dark', low: 'Low heat', hot: 'Hot charge',
      reset: 'Reset', play: '▶ Roast',
      turning: 'Turning point', crack: 'First crack', dropT: 'Drop', dtr: 'Development ratio', level: 'Roast level', notes: 'Notes',
      chartBean: 'Probe temperature', chartRor: 'Rate of rise',
      mTurn: 'Turn', mDry: 'Dry', mCrack: 'Crack', mDrop: 'Drop',
      none: 'Nothing in particular',
      stall: 'The rise stops after first crack, so the coffee tastes flat and baked.',
      underdev: 'Dropped too soon after first crack: grassy and sharp.',
      overdev: 'Held too long after first crack: bitterness covers the sweetness.',
      never: 'Not enough heat to reach the drop temperature within 20 minutes.',
      scorch: 'Charge temperature and heat are both very high, so the surface may scorch.',
      lv: { '淺焙': 'Light', '中焙': 'Medium', '中深焙': 'Medium-dark', '深焙': 'Dark' },
      notDone: 'Not finished',
      footnote: 'A simplified teaching model for direction, not a precise prediction. Beans, the heat curve and the machine still change the cup.'
    }
  };

  var PRESETS = {
    standard: { charge: 200, power: 70, airflow: 50, drop: 215 },
    light: { charge: 200, power: 70, airflow: 50, drop: 207 },
    dark: { charge: 200, power: 70, airflow: 50, drop: 230 },
    low: { charge: 200, power: 35, airflow: 50, drop: 215 },
    hot: { charge: 228, power: 90, airflow: 50, drop: 215 }
  };
  var DEFAULTS = PRESETS.standard;

  var styleInjected = false;
  function injectStyle() {
    if (styleInjected || typeof document === 'undefined') return;
    if (document.getElementById('rl-lab-style')) {
      styleInjected = true;
      return;
    }
    var css = document.createElement('style');
    css.id = 'rl-lab-style';
    css.textContent = [
      '.rl-root{display:flex;flex-direction:column;gap:0.9rem;color:var(--text);min-width:0;max-width:100%;}',
      '.rl-machine{min-height:0;}',
      '.rl-sliders{display:flex;flex-direction:column;gap:0.7rem;}',
      '.rl-row{display:grid;grid-template-columns:6.2rem 1fr auto;gap:0.55rem;align-items:center;}',
      '.rl-row label{font-size:0.88rem;color:var(--muted);}',
      '.rl-row input[type=range]{width:100%;accent-color:var(--accent);}',
      '.rl-val{font-variant-numeric:tabular-nums;font-size:0.88rem;min-width:5.4rem;text-align:right;}',
      '.rl-btns{display:flex;flex-wrap:wrap;gap:0.45rem;}',
      '.rl-btns button{font:inherit;font-size:0.82rem;padding:0.35rem 0.7rem;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--text);cursor:pointer;}',
      '.rl-btns button:hover{border-color:var(--accent);}',
      '.rl-nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.55rem;}',
      '.rl-num{border:1px solid var(--line);border-radius:8px;padding:0.55rem 0.6rem;background:var(--paper);}',
      '.rl-num b{display:block;font-size:1.05rem;font-variant-numeric:tabular-nums;}',
      '.rl-num span{font-size:0.75rem;color:var(--muted);}',
      '.rl-chart{width:100%;overflow:hidden;}',
      '.rl-chart svg{width:100%;height:auto;display:block;max-width:100%;touch-action:pan-y;}',
      '.rl-h{font-size:0.88rem;margin:0 0 0.25rem;color:var(--text);}',
      '.rl-status{margin:0;line-height:1.65;color:var(--text);}',
      '.rl-note{margin:0;font-size:0.82rem;color:var(--muted);}',
      '@media (max-width:520px){.rl-nums{grid-template-columns:repeat(2,minmax(0,1fr));}.rl-row{grid-template-columns:4.6rem minmax(0,1fr) auto;}.rl-val{min-width:4.6rem;}}'
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

  function chartFsFromWidth(px) {
    var w = px > 0 ? px : 640;
    var fs = 13 * 640 / w;
    if (fs < 12) fs = 12;
    if (fs > 26) fs = 26;
    return fs;
  }

  function pad(fs) {
    var top = (fs || 13) * 2.2;
    return { l: 52, r: 16, t: top, b: 36, w: 640, h: 220 };
  }

  function tickText(attrs, content) {
    var el = svgEl('text', attrs);
    el.textContent = content;
    return el;
  }

  function mapX(t, xmax, p) {
    return p.l + (t / xmax) * (p.w - p.l - p.r);
  }

  function xMaxOf(res) {
    var end = res.dropTime != null ? res.dropTime : (res.curve.length ? res.curve[res.curve.length - 1].t : 600);
    return Math.max(600, Math.ceil(end / 60) * 60);
  }

  function crackAmount(t, tFc) {
    if (tFc == null) return 0;
    var u = t - tFc;
    if (u < 0 || u >= 60) return 0;
    return Math.sin(Math.PI * (u + 0.5) / 60);
  }

  function mountRoaster(el) {
    if (!el || el.getAttribute('data-rl-mounted') === '1') return;
    el.setAttribute('data-rl-mounted', '1');
    injectStyle();
    var langKey = el.dataset.lang === 'en' ? 'en' : 'zh';
    var T = STR[langKey];
    var state = {
      charge: DEFAULTS.charge,
      power: DEFAULTS.power,
      airflow: DEFAULTS.airflow,
      drop: DEFAULTS.drop
    };
    var result = model(state);
    var machine = null;
    var playing = false;
    var raf = 0;
    var reduceMotion = typeof global.matchMedia === 'function' && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var root = document.createElement('div');
    root.className = 'rl-root';

    var machineDiv = document.createElement('div');
    machineDiv.className = 'rl-machine';
    root.appendChild(machineDiv);
    if (global.RoasterMachine && typeof global.RoasterMachine.mount === 'function') {
      try {
        machine = global.RoasterMachine.mount(machineDiv, { lang: el.dataset.lang || 'zh-TW' });
      } catch (err) {
        machineDiv.style.display = 'none';
        machine = null;
      }
    } else {
      machineDiv.style.display = 'none';
    }

    function sliderRow(key, min, max, step, label, unit) {
      var wrap = document.createElement('div');
      var row = document.createElement('div');
      row.className = 'rl-row';
      var lab = document.createElement('label');
      lab.textContent = label;
      lab.setAttribute('for', 'rl-' + key);
      var inp = document.createElement('input');
      inp.type = 'range';
      inp.id = 'rl-' + key;
      inp.min = String(min);
      inp.max = String(max);
      inp.step = String(step);
      inp.value = String(state[key]);
      var val = document.createElement('span');
      val.className = 'rl-val';
      function fmt() {
        val.textContent = String(Math.round(Number(inp.value))) + ' ' + unit;
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
      wrap._input = inp;
      wrap._fmt = fmt;
      return wrap;
    }

    var sliders = document.createElement('div');
    sliders.className = 'rl-sliders';
    var rows = {
      charge: sliderRow('charge', 170, 230, 1, T.charge, T.unitC),
      power: sliderRow('power', 20, 100, 1, T.power, T.unitPct),
      airflow: sliderRow('airflow', 0, 100, 1, T.airflow, T.unitPct),
      drop: sliderRow('drop', 205, 235, 1, T.drop, T.unitC)
    };
    sliders.appendChild(rows.charge);
    sliders.appendChild(rows.power);
    sliders.appendChild(rows.airflow);
    sliders.appendChild(rows.drop);
    root.appendChild(sliders);

    var btns = document.createElement('div');
    btns.className = 'rl-btns';
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
      state.charge = p.charge;
      state.power = p.power;
      state.airflow = p.airflow;
      state.drop = p.drop;
      Object.keys(rows).forEach(function (k) {
        rows[k]._input.value = String(p[k]);
        rows[k]._fmt();
      });
      redraw();
    }
    addBtn(T.standard, function () { applyPreset(PRESETS.standard); });
    addBtn(T.light, function () { applyPreset(PRESETS.light); });
    addBtn(T.dark, function () { applyPreset(PRESETS.dark); });
    addBtn(T.low, function () { applyPreset(PRESETS.low); });
    addBtn(T.hot, function () { applyPreset(PRESETS.hot); });
    addBtn(T.reset, function () { applyPreset(DEFAULTS); });
    addBtn(T.play, function () { startPlay(); });
    root.appendChild(btns);

    var nums = document.createElement('div');
    nums.className = 'rl-nums';
    var numEls = {};
    function numCell(key, label) {
      var d = document.createElement('div');
      d.className = 'rl-num';
      var s = document.createElement('span');
      s.textContent = label;
      var b = document.createElement('b');
      d.appendChild(s);
      d.appendChild(b);
      nums.appendChild(d);
      numEls[key] = b;
    }
    numCell('turning', T.turning);
    numCell('crack', T.crack);
    numCell('drop', T.dropT);
    numCell('dtr', T.dtr);
    numCell('level', T.level);
    numCell('notes', T.notes);
    root.appendChild(nums);

    var h1 = document.createElement('p');
    h1.className = 'rl-h';
    h1.textContent = T.chartBean;
    var c1 = document.createElement('div');
    c1.className = 'rl-chart';
    var svg1 = svgEl('svg', { viewBox: '0 0 640 220', role: 'img', 'aria-label': T.chartBean });
    c1.appendChild(svg1);
    root.appendChild(h1);
    root.appendChild(c1);

    var h2 = document.createElement('p');
    h2.className = 'rl-h';
    h2.textContent = T.chartRor;
    var c2 = document.createElement('div');
    c2.className = 'rl-chart';
    var svg2 = svgEl('svg', { viewBox: '0 0 640 220', role: 'img', 'aria-label': T.chartRor });
    c2.appendChild(svg2);
    root.appendChild(h2);
    root.appendChild(c2);

    var status = document.createElement('p');
    status.className = 'rl-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    root.appendChild(status);

    var note = document.createElement('p');
    note.className = 'rl-note';
    note.textContent = T.footnote;
    root.appendChild(note);
    el.appendChild(root);

    var hover1 = null;
    var hover2 = null;
    var lastChartFs = null;
    var lastPlayT = null;

    function measureFs(container) {
      var w = container && container.clientWidth ? container.clientWidth : 640;
      return chartFsFromWidth(w);
    }

    function drawXTicks(svg, xmax, p, fs) {
      for (var t = 0; t <= xmax + 1e-9; t += 120) {
        var xx = mapX(t, xmax, p);
        var last = t >= xmax - 1e-9;
        svg.appendChild(tickText({
          x: String(xx),
          y: String(p.h - 8),
          fill: 'var(--muted)',
          'font-size': String(fs),
          'text-anchor': t === 0 ? 'start' : (last ? 'end' : 'middle')
        }, fmtTime(t)));
      }
    }

    function marker(svg, res, x, y, p, fs, key, label) {
      var tm = key === 'turning' ? res.turning.t : res[key];
      if (tm == null) return;
      var pt = interp(res.curve, tm);
      var yy = y(key === 'ror' ? pt.ror : pt.bean);
      svg.appendChild(svgEl('circle', {
        cx: String(x(tm)), cy: String(yy), r: '4', fill: AMBER
      }));
      svg.appendChild(tickText({
        x: String(x(tm) + 6),
        y: String(Math.max(p.t + 12, yy - 6)),
        fill: 'var(--text)',
        'font-size': String(Math.max(11, fs - 1))
      }, label));
    }

    function bands(svg, res, x, p) {
      var end = res.dropTime != null ? res.dropTime : res.curve[res.curve.length - 1].t;
      var cuts = [
        { a: 0, b: res.dryEnd != null ? res.dryEnd : end, fill: 'rgba(120,160,90,0.14)' },
        { a: res.dryEnd != null ? res.dryEnd : end, b: res.firstCrack != null ? res.firstCrack : end, fill: 'rgba(217,119,6,0.12)' },
        { a: res.firstCrack != null ? res.firstCrack : end, b: end, fill: 'rgba(120,72,40,0.14)' }
      ];
      cuts.forEach(function (c) {
        if (!(c.b > c.a)) return;
        svg.appendChild(svgEl('rect', {
          x: String(x(c.a)),
          y: String(p.t),
          width: String(Math.max(0, x(c.b) - x(c.a))),
          height: String(p.h - p.t - p.b),
          fill: c.fill
        }));
      });
    }

    function appendHover(svg, p, xmax, formatter) {
      var g = svgEl('g', { visibility: 'hidden', 'pointer-events': 'none' });
      var line = svgEl('line', { y1: String(p.t), y2: String(p.h - p.b), stroke: 'var(--muted)', 'stroke-width': '1' });
      var box = svgEl('rect', { width: '168', height: '28', rx: '5', fill: 'var(--paper)', stroke: 'var(--line)' });
      var label = tickText({ fill: 'var(--text)', 'font-size': String(Math.max(12, lastChartFs || 12)), 'dominant-baseline': 'middle' }, '');
      g.appendChild(line); g.appendChild(box); g.appendChild(label); svg.appendChild(g);
      return { g: g, line: line, box: box, label: label, p: p, xmax: xmax, formatter: formatter };
    }

    function drawChartBean(res, playT) {
      lastPlayT = playT == null ? null : playT;
      while (svg1.firstChild) svg1.removeChild(svg1.firstChild);
      var fs = measureFs(c1);
      lastChartFs = fs;
      var p = pad(fs);
      var xmax = xMaxOf(res);
      function x(t) { return mapX(t, xmax, p); }
      function y(bean) { return p.t + (1 - (bean - 40) / 220) * (p.h - p.t - p.b); }
      bands(svg1, res, x, p);
      svg1.appendChild(svgEl('path', {
        d: 'M' + p.l + ' ' + p.t + ' V' + (p.h - p.b) + ' H' + (p.w - p.r),
        fill: 'none', stroke: 'var(--line)', 'stroke-width': '1'
      }));
      [60, 120, 180, 240].forEach(function (v) {
        svg1.appendChild(tickText({
          x: String(p.l - 6), y: String(y(v) + 4),
          fill: 'var(--muted)', 'font-size': String(fs), 'text-anchor': 'end'
        }, String(v)));
      });
      drawXTicks(svg1, xmax, p, fs);
      var d = '';
      res.curve.forEach(function (pt, i) {
        d += (i === 0 ? 'M' : 'L') + x(pt.t).toFixed(2) + ' ' + y(pt.bean).toFixed(2) + ' ';
      });
      svg1.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2' }));
      marker(svg1, res, x, y, p, fs, 'turning', T.mTurn);
      marker(svg1, res, x, y, p, fs, 'dryEnd', T.mDry);
      marker(svg1, res, x, y, p, fs, 'firstCrack', T.mCrack);
      marker(svg1, res, x, y, p, fs, 'dropTime', T.mDrop);
      var playDot = svgEl('circle', { r: '5', fill: AMBER, cx: '-20', cy: '-20' });
      svg1.appendChild(playDot);
      if (playT != null) {
        var pt = interp(res.curve, playT);
        playDot.setAttribute('cx', String(x(pt.t)));
        playDot.setAttribute('cy', String(y(pt.bean)));
      }
      hover1 = appendHover(svg1, p, xmax, function (pt) { return pt.bean.toFixed(1) + ' ' + T.unitC; });
    }

    function drawChartRor(res, playT) {
      lastPlayT = playT == null ? null : playT;
      while (svg2.firstChild) svg2.removeChild(svg2.firstChild);
      var fs = measureFs(c2);
      lastChartFs = fs;
      var p = pad(fs);
      var xmax = xMaxOf(res);
      function x(t) { return mapX(t, xmax, p); }
      function y(ror) { return p.t + (1 - (ror + 2) / 28) * (p.h - p.t - p.b); }
      svg2.appendChild(svgEl('path', {
        d: 'M' + p.l + ' ' + p.t + ' V' + (p.h - p.b) + ' H' + (p.w - p.r),
        fill: 'none', stroke: 'var(--line)', 'stroke-width': '1'
      }));
      [0, 8, 16, 24].forEach(function (v) {
        svg2.appendChild(tickText({
          x: String(p.l - 6), y: String(y(v) + 4),
          fill: 'var(--muted)', 'font-size': String(fs), 'text-anchor': 'end'
        }, String(v)));
      });
      drawXTicks(svg2, xmax, p, fs);
      var d = '';
      res.curve.forEach(function (pt, i) {
        d += (i === 0 ? 'M' : 'L') + x(pt.t).toFixed(2) + ' ' + y(pt.ror).toFixed(2) + ' ';
      });
      svg2.appendChild(svgEl('path', { d: d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2' }));
      var playDot = svgEl('circle', { r: '5', fill: AMBER, cx: '-20', cy: '-20' });
      svg2.appendChild(playDot);
      if (playT != null) {
        var pt = interp(res.curve, playT);
        playDot.setAttribute('cx', String(x(pt.t)));
        playDot.setAttribute('cy', String(y(pt.ror)));
      }
      hover2 = appendHover(svg2, p, xmax, function (pt) { return pt.ror.toFixed(1) + ' ' + T.unitMin; });
    }

    function moveHover(svg, hover, clientX) {
      if (!hover || !result) return;
      var rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      var vx = (clientX - rect.left) / rect.width * 640;
      if (vx < hover.p.l || vx > hover.p.w - hover.p.r) {
        hover.g.setAttribute('visibility', 'hidden');
        return;
      }
      var end = result.dropTime != null ? result.dropTime : result.curve[result.curve.length - 1].t;
      var t = clamp((vx - hover.p.l) / (hover.p.w - hover.p.l - hover.p.r) * hover.xmax, 0, end);
      var pt = interp(result.curve, t);
      var xx = mapX(pt.t, hover.xmax, hover.p);
      var boxX = xx + 7;
      if (boxX + 168 > hover.p.w - hover.p.r) boxX = xx - 174;
      hover.line.setAttribute('x1', String(xx));
      hover.line.setAttribute('x2', String(xx));
      hover.box.setAttribute('x', String(boxX));
      hover.box.setAttribute('y', String(hover.p.t + 5));
      hover.label.setAttribute('x', String(boxX + 8));
      hover.label.setAttribute('y', String(hover.p.t + 19));
      hover.label.textContent = fmtTime(pt.t) + ' · ' + hover.formatter(pt);
      hover.g.setAttribute('visibility', 'visible');
    }

    function bindHover(svg, getHover) {
      svg.addEventListener('pointermove', function (ev) { moveHover(svg, getHover(), ev.clientX); });
      svg.addEventListener('pointerdown', function (ev) { moveHover(svg, getHover(), ev.clientX); });
      svg.addEventListener('pointerleave', function () {
        var h = getHover();
        if (h) h.g.setAttribute('visibility', 'hidden');
      });
      svg.addEventListener('pointercancel', function () {
        var h = getHover();
        if (h) h.g.setAttribute('visibility', 'hidden');
      });
    }
    bindHover(svg1, function () { return hover1; });
    bindHover(svg2, function () { return hover2; });

    function warnText(res) {
      if (!res.warnings.length) return T.none;
      return res.warnings.map(function (w) { return T[w] || w; }).join(' ');
    }

    function setNums(res) {
      var turn = res.turning;
      numEls.turning.textContent = fmtTime(turn.t) + ' · ' + turn.temp.toFixed(1) + ' ' + T.unitC;
      numEls.crack.textContent = fmtTime(res.firstCrack);
      numEls.drop.textContent = fmtTime(res.dropTime);
      numEls.dtr.textContent = res.dtr == null ? '—' : (res.dtr * 100).toFixed(1) + T.unitPct;
      numEls.level.textContent = res.dropTime == null ? T.notDone : (T.lv[res.level] || res.level);
      numEls.notes.textContent = warnText(res);
      status.textContent = warnText(res);
    }

    function frameState(res, t, phaseOverride) {
      var endT = res.dropTime != null ? res.dropTime : res.curve[res.curve.length - 1].t;
      var clamped = clamp(t, 0, endT);
      var pt = interp(res.curve, clamped);
      var phase = phaseOverride || pt.phase;
      if (phaseOverride == null && res.dropTime != null && clamped >= res.dropTime) phase = 'cooling';
      return {
        t: clamped,
        power: state.power,
        airflow: state.airflow,
        bean: pt.bean,
        ror: pt.ror,
        roast: phase === 'cooling' ? res.roast : pt.roast,
        phase: phase,
        crack: phase === 'cooling' ? 0 : crackAmount(clamped, res.firstCrack),
        elapsed: fmtTime(clamped)
      };
    }

    function pushMachine(res, t, phaseOverride) {
      if (!machine || typeof machine.update !== 'function') return;
      try {
        machine.update(frameState(res, t, phaseOverride));
      } catch (err) {
        machine = null;
      }
    }

    function redraw() {
      result = model(state);
      setNums(result);
      drawChartBean(result, null);
      drawChartRor(result, null);
      var endT = result.dropTime != null ? result.dropTime : result.curve[result.curve.length - 1].t;
      var phase = result.dropTime != null ? 'cooling' : result.curve[result.curve.length - 1].phase;
      pushMachine(result, endT, phase);
    }

    function stopPlay(restoreEnd) {
      playing = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (restoreEnd && result) redraw();
    }

    function showEnd() {
      playing = false;
      var endT = result.dropTime != null ? result.dropTime : result.curve[result.curve.length - 1].t;
      setNums(result);
      drawChartBean(result, endT);
      drawChartRor(result, endT);
      pushMachine(result, endT, result.dropTime != null ? 'cooling' : null);
    }

    function startPlay() {
      stopPlay(false);
      result = model(state);
      if (reduceMotion) {
        showEnd();
        return;
      }
      playing = true;
      var t0 = 0;
      var endT = result.dropTime != null ? result.dropTime : result.curve[result.curve.length - 1].t;
      function tick(now) {
        if (!playing) return;
        if (!t0) t0 = now;
        var ms = Math.min(PLAY_MS, now - t0);
        var t = (ms / PLAY_MS) * endT;
        setNums(result);
        drawChartBean(result, t);
        drawChartRor(result, t);
        pushMachine(result, t, null);
        if (ms < PLAY_MS) raf = requestAnimationFrame(tick);
        else {
          playing = false;
          showEnd();
        }
      }
      raf = requestAnimationFrame(tick);
    }

    redraw();

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

    if (typeof ResizeObserver !== 'undefined') {
      var chartRo = new ResizeObserver(function () {
        var fs = measureFs(c1);
        if (fs === lastChartFs) return;
        if (!result) return;
        lastChartFs = fs;
        drawChartBean(result, lastPlayT);
        drawChartRor(result, lastPlayT);
      });
      chartRo.observe(c1);
      chartRo.observe(c2);
    }
  }

  global.RoasterModel = { model: model, PARAMS: PARAMS };
  global.RoasterLab = { PLAY_MS: PLAY_MS, model: model, PARAMS: PARAMS, PRESETS: PRESETS };
  global.mountRoaster = mountRoaster;

  function autoMount() {
    if (typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('[data-lab-demo="roaster"]');
    for (var i = 0; i < nodes.length; i++) mountRoaster(nodes[i]);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PLAY_MS: PLAY_MS,
      model: model,
      PARAMS: PARAMS,
      PRESETS: PRESETS,
      interp: interp
    };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
