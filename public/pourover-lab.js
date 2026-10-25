/* Pour-over laboratory: deterministic teaching model + dependency-free UI. */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var PLAY_MS = 15000;
  // All calibration constants live here. The equations below contain no method/dripper result bonuses.
  var PARAMS = {
    dose: 15, retain: 2, emax: 0.30, bloomEnd: 40, steepEnd: 150,
    flowC: 0.02000, drainHeadOffset: 30, k0: 0.040, emaxAccess: 0.7326, emaxGrindExp: 0.25, emaxTempScale: 60, finesRate: 0.0042, wetBed: 30,
    stirBase: 0.9, stirRate: 0.04, pourKick: 1.15,
    drippers: {
      v60: { flowK: 1.00, bypass: 0.10, cap: 300, extractionK: 1.00 },
      kadou: { flowK: 1.10, bypass: 0.10, cap: 300, extractionK: 1.02 },
      kalita: { flowK: 0.70, bypass: 0.03, cap: 300, extractionK: 1.06 },
      melitta: { flowK: 0.50, bypass: 0.05, cap: 300, extractionK: 1.00 },
      clever: { flowK: 1.10, bypass: 0.00, cap: 350, extractionK: 1.10, emaxMultiplier: 1.08 }
    }
  };

  var PRESETS = {
    standard: { grind: 700, temp: 93, ratio: 17, pourRate: 5 },
    sour: { grind: 1000, temp: 88, ratio: 17, pourRate: 5 },
    bitter: { grind: 450, temp: 99, ratio: 17, pourRate: 5 },
    weak: { grind: 1100, temp: 93, ratio: 18, pourRate: 5 },
    rush: { grind: 450, temp: 93, ratio: 18, pourRate: 10 },
    original46: { method: '46', grind: 900, ratio: 15 }
  };

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, Number(x))); }
  function pourPlan(method, water, rate) {
    var pours = [], bloom = Math.min(30, water);
    function add(start, grams) {
      grams = Math.max(0, Math.min(grams, water - pours.reduce(function (s, p) { return s + p.grams; }, 0)));
      if (grams > 0.0001) pours.push({ start: start, end: start + grams / rate, grams: grams });
    }
    if (method === '46') {
      for (var i = 0; i < 5; i++) add(i * 45, water / 5);
    } else {
      add(0, bloom);
      var rem = water - bloom;
      if (method === 'single') add(40, rem);
      else if (method === 'two') { add(40, water * 0.60 - bloom); add(100, water * 0.40); }
      else if (method === 'pulse') {
        var at = 40;
        while (rem > 0.0001) { var g = Math.min(30, rem); add(at, g); rem -= g; at += 12; }
      } else { add(40, rem / 3); add(80, rem / 3); add(120, rem / 3); }
    }
    return pours;
  }

  function model(input) {
    input = input || {};
    var grind = clamp(input.grind == null ? 700 : input.grind, 400, 1200);
    var temp = clamp(input.temp == null ? 93 : input.temp, 85, 100);
    var ratio = clamp(input.ratio == null ? 17 : input.ratio, 13, 18);
    var pourRate = clamp(input.pourRate == null ? 5 : input.pourRate, 2, 10);
    var dripper = PARAMS.drippers[input.dripper] ? input.dripper : 'v60';
    var method = ['single', 'two', 'three', 'pulse', '46'].indexOf(input.method) >= 0 ? input.method : 'three';
    var D = PARAMS.drippers[dripper], dose = PARAMS.dose, water = dose * ratio;
    var pours = pourPlan(method, water, pourRate), scheduledEnd = pours[pours.length - 1].end;
    var poured = 0, absorbed = 0, head = 0, cup = 0, pool = 0, cupSolids = 0, peakHead = 0;
    var curve = [], overflow = false, pourEnd = 0, totalTime = 600, previousPouring = false;
    var fmax = 0.05 + (1200 - grind) / 800 * 0.30;
    for (var t = 0; t <= 600; t++) {
      var incoming = 0, pouring = false, pourStart = false;
      for (var pi = 0; pi < pours.length; pi++) {
        var p = pours[pi];
        var delivered = Math.max(0, Math.min(p.grams, (t + 1 - p.start) * pourRate)) - Math.max(0, Math.min(p.grams, (t - p.start) * pourRate));
        if (delivered > 0) { incoming += delivered; pouring = true; if (t >= p.start && t < p.start + 1) pourStart = true; }
      }
      poured = Math.min(water, poured + incoming);
      var uptake = Math.min(incoming, dose * PARAMS.retain - absorbed);
      absorbed += uptake;
      head += incoming - uptake;
      var allPoured = poured >= water - 0.001;
      if (allPoured && !pourEnd) pourEnd = t + 1;
      var valve = dripper !== 'clever' || (allPoured && t >= PARAMS.steepEnd);
      var fines = fmax * (1 - Math.exp(-PARAMS.finesRate * t));
      var perm = Math.pow(grind / 700, 2) * (1 - fines);
      var flow = valve ? Math.min(head, PARAMS.flowC * D.flowK * (head + PARAMS.drainHeadOffset) * perm) : 0;
      var stir = (PARAMS.stirBase + PARAMS.stirRate * pourRate) * (pourStart ? PARAMS.pourKick : 1);
      var wet = head > 0.01 ? 1 : 0.3;
      var kE = PARAMS.k0 * Math.pow(700 / grind, 0.8) * Math.exp((temp - 93) / 12) * D.extractionK * stir;
      var totalExtracted = pool + cupSolids;
      var emaxEff = PARAMS.emax * PARAMS.emaxAccess * (D.emaxMultiplier || 1) * Math.pow(700 / grind, PARAMS.emaxGrindExp) * Math.exp((temp - 93) / PARAMS.emaxTempScale);
      var dE = kE * (emaxEff * dose - totalExtracted) * wet;
      pool += Math.max(0, dE);
      if (flow > 0) {
        var carrying = flow * (1 - D.bypass);
        var concentration = pool / Math.max(head + PARAMS.wetBed, 1);
        var solidsOut = Math.min(pool, carrying * concentration);
        pool -= solidsOut; cupSolids += solidsOut;
      }
      head -= flow; cup += flow;
      if (head < 1e-9) head = 0;
      peakHead = Math.max(peakHead, head);
      if (head > D.cap) overflow = true;
      var eyNow = cupSolids / dose * 100;
      var phase;
      if (t < PARAMS.bloomEnd) phase = 'bloom';
      else if (dripper === 'clever' && !valve) phase = 'steep';
      else if (pouring) phase = 'pour';
      else if (!allPoured) phase = 'wait';
      else if (head >= 0.5) phase = 'drawdown';
      else phase = 'done';
      curve.push({ t: t, poured: poured, head: head, flow: flow, cup: cup, ey: eyNow, phase: phase, pouring: pouring, valve: valve });
      previousPouring = pouring;
      if (allPoured && head < 0.5) { totalTime = t; curve[curve.length - 1].phase = 'done'; break; }
    }
    var ey = cupSolids / dose * 100, tds = cup > 0 ? cupSolids / cup * 100 : 0;
    var warnings = [];
    if (overflow) warnings.push('overflow');
    if (totalTime > 270 && totalTime < 600) warnings.push('choke');
    if (totalTime < 120) warnings.push('fast');
    if (totalTime >= 600 && head >= 0.5) warnings.push('never');
    return {
      curve: curve, pours: pours, bloomEnd: PARAMS.bloomEnd, pourEnd: pourEnd || Math.ceil(scheduledEnd), totalTime: totalTime,
      ey: ey, tds: tds, taste: { extraction: ey < 18 ? 'sour' : ey <= 22 ? 'balanced' : 'bitter', strength: tds < 1.15 ? 'weak' : tds <= 1.35 ? 'ideal' : 'strong' },
      peakHead: peakHead, warnings: warnings
    };
  }

  function cssOnce() {
    if (document.getElementById('pl-style')) return;
    var s = document.createElement('style'); s.id = 'pl-style';
    s.textContent = '.pl{--paper:#11110f;--panel:#191816;--text:#f2eee6;--muted:#aaa397;--line:#3e3a34;--accent:#b45309;--blue:#83a9bd;font:14px/1.45 system-ui,sans-serif;color:var(--text);max-width:760px;margin:auto}.pl[data-theme="light"]{--paper:#faf8f2;--panel:#fff;--text:#24211d;--muted:#706b62;--line:#d6d0c5}.pl *{box-sizing:border-box}.pl button,.pl input{font:inherit}.pl-machine{min-height:260px}.pl-groups,.pl-presets{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 16px}.pl-choice{border:1px solid var(--line);background:var(--panel);color:var(--text);padding:8px 10px;border-radius:8px;cursor:pointer}.pl-choice small{display:block;color:var(--muted);font-size:11px}.pl-choice[aria-pressed="true"]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--panel))}.pl h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:18px 0 7px}.pl-row{display:grid;grid-template-columns:6rem 1fr 4.8rem;gap:10px;align-items:center;margin:10px 0}.pl-row input{width:100%;accent-color:var(--accent)}.pl-val{text-align:right;font-variant-numeric:tabular-nums}.pl-charts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pl-chart,.pl-map{width:100%;height:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px}.pl-nums{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0}.pl-num{padding:9px;background:var(--panel);border:1px solid var(--line);border-radius:8px}.pl-num small{display:block;color:var(--muted)}.pl-num strong{font-variant-numeric:tabular-nums}.pl-compare{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.pl-compare th,.pl-compare td{padding:6px;border-bottom:1px solid var(--line);text-align:right}.pl-compare th:first-child,.pl-compare td:first-child{text-align:left}.pl-compare .sel{background:color-mix(in srgb,var(--accent) 13%,transparent)}.pl-note{color:var(--muted);min-height:1.5em}.pl-play{background:var(--accent);color:white;border-color:var(--accent)}@media(max-width:600px){.pl-charts{grid-template-columns:1fr}.pl-nums{grid-template-columns:repeat(2,1fr)}.pl-row{grid-template-columns:5.2rem 1fr 4.3rem}.pl-machine{min-height:180px}.pl{font-size:13px}}';
    document.head.appendChild(s);
  }
  function S(tag, attrs, text) { var n = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(attrs || {}).forEach(function(k){n.setAttribute(k, attrs[k]);}); if(text != null)n.textContent=text; return n; }
  function path(curve, x, y, key) { var d=''; for(var i=0;i<curve.length;i++)d+=(i?'L':'M')+x(curve[i].t).toFixed(1)+' '+y(curve[i][key]).toFixed(1)+' '; return d; }
  function fmtTime(s) { return Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0'); }
  function interp(curve,t){var i=Math.max(0,Math.min(curve.length-1,Math.floor(t)));return curve[i];}

  var I18N = {
    zh: { dripper:'濾杯',method:'注水方式',controls:'沖煮設定',compare:'比一比',compareMethod:'比注水法',compareDripper:'比濾杯',grind:'研磨度',temp:'水溫',ratio:'粉水比',rate:'注水速度',standard:'標準',sour:'太酸',bitter:'太苦',weak:'太淡',rush:'注水太急',original46:'4:6 原版',note46:'原版用偏粗的粉、1:15',reset:'重設',play:'▶ 沖煮',time:'總時間',ey:'萃取率',tds:'濃度',taste:'口味',head:'最高水量',warning:'提醒',none:'沒有提醒',sourTaste:'偏酸',balanced:'平衡',bitterTaste:'偏苦',weakTaste:'淡',ideal:'剛好',strong:'濃',poured:'累積注水',inDripper:'濾杯水量',cup:'下壺咖啡',v60:'V60 錐形',kadou:'星芒',kalita:'Kalita 平底',melitta:'Melitta 梯形小孔',clever:'聰明濾杯',single:'一刀流',two:'兩段式',three:'三段式',pulse:'脈衝式','46':'4:6 法',vd:['大孔與螺旋肋條','陶瓷錐形、32 條長短肋骨','三小孔、流速穩','梯形小孔、滴得慢','先浸泡再開閥'],md:['悶蒸後一口氣注完','分兩次控制水位','分三次均勻注水','每次少量、頻繁注水','五注、每注相隔 45 秒'],overflow:'水注太急，濾杯快滿出來，水會從旁邊繞過粉層',choke:'粉太細，細粉把濾紙堵住，水滴得太久',fast:'水太快流過粉層，來不及帶出味道',never:'10 分鐘內滴不完'},
    en: { dripper:'Dripper',method:'Pour method',controls:'Brew settings',compare:'Compare',compareMethod:'Compare methods',compareDripper:'Compare drippers',grind:'Grind',temp:'Water temperature',ratio:'Brew ratio',rate:'Pour rate',standard:'Standard',sour:'Too sour',bitter:'Too bitter',weak:'Too weak',rush:'Pour too fast',original46:'Original 4:6',note46:'The original uses a coarse grind and 1:15',reset:'Reset',play:'▶ Brew',time:'Total time',ey:'Extraction',tds:'Strength',taste:'Taste',head:'Peak water',warning:'Note',none:'No warning',sourTaste:'sour',balanced:'balanced',bitterTaste:'bitter',weakTaste:'weak',ideal:'ideal',strong:'strong',poured:'Water poured',inDripper:'Water in dripper',cup:'Coffee in carafe',v60:'V60 cone',kalita:'Kalita flat bed',melitta:'Melitta one-hole',clever:'Clever dripper',single:'Single pour',two:'Two-stage',three:'Three-stage',pulse:'Pulse pour','46':'4:6 method',vd:['Large hole, spiral ribs','Three holes, even flow','One hole, slower drawdown','Steep first, then open valve'],md:['One continuous pour after bloom','Two pours control the water level','Three evenly spaced pours','Many small, frequent pours','Five pours, 45 seconds apart'],overflow:'The dripper is nearly overflowing; water may bypass the bed',choke:'Fine particles have clogged the filter; drawdown is too long',fast:'Water passed through too quickly to extract enough flavour',never:'The brew did not drain within 10 minutes'}
  };
  I18N.zh.kadou='星芒'; I18N.zh.melitta='Melitta 梯形小孔';
  I18N.zh.vd=['大孔與螺旋肋條','陶瓷錐形、32 條長短肋骨','三小孔、流速穩','梯形小孔、滴得慢','先浸泡再開閥'];
  I18N.en.kadou='KADOU starburst'; I18N.en.melitta='Melitta trapezoid small opening';
  I18N.en.vd=['Large hole, spiral ribs','Ceramic cone, 32 long and short ribs','Three holes, even flow','Trapezoid small opening, slow drawdown','Steep first, then open valve'];

  function mount(el) {
    if (!el || el.__pouroverMounted) return; el.__pouroverMounted=true; cssOnce();
    var T=I18N[el.getAttribute('data-lang')==='en'?'en':'zh'];
    var state={grind:700,temp:93,ratio:17,pourRate:5,dripper:'v60',method:'three'}, result, machine=null, oldPoint=null, raf=0;
    el.classList.add('pl'); el.innerHTML='<div class="pl-machine"></div><h3>'+T.dripper+'</h3><div class="pl-groups pl-drippers"></div><h3>'+T.method+'</h3><div class="pl-groups pl-methods"></div><div class="pl-method-note"></div><h3>'+T.controls+'</h3><div class="pl-sliders"></div><div class="pl-presets"></div><div class="pl-charts"><svg class="pl-chart" viewBox="0 0 640 270"></svg><svg class="pl-chart" viewBox="0 0 640 270"></svg></div><h3>'+T.taste+'</h3><svg class="pl-map" viewBox="0 0 640 250"></svg><div class="pl-nums"></div><div class="pl-note"></div><h3>'+T.compare+'</h3><div class="pl-groups"><button class="pl-choice pl-cm" aria-pressed="true">'+T.compareMethod+'</button><button class="pl-choice pl-cd" aria-pressed="false">'+T.compareDripper+'</button></div><table class="pl-compare"></table>';
    var machineBox=el.querySelector('.pl-machine');
    if(global.PourOverMachine&&typeof global.PourOverMachine.mount==='function')machine=global.PourOverMachine.mount(machineBox,{lang:el.getAttribute('data-lang')==='en'?'en':'zh-TW'});
    function buttons(box,keys,descs,field){keys.forEach(function(k,i){var b=document.createElement('button');b.className='pl-choice';b.innerHTML=T[k]+'<small>'+descs[i]+'</small>';b.onclick=function(){state[field]=k;redraw(true);};box.appendChild(b);});}
    buttons(el.querySelector('.pl-drippers'),['v60','kadou','kalita','melitta','clever'],T.vd,'dripper'); buttons(el.querySelector('.pl-methods'),['single','two','three','pulse','46'],T.md,'method');
    var defs=[['grind',T.grind,400,1200,10,function(v){return v+' µm';}],['temp',T.temp,85,100,.5,function(v){return Number(v).toFixed(1)+'°C';}],['ratio',T.ratio,13,18,.5,function(v){return '1:'+Number(v).toFixed(v%1?1:0);}],['pourRate',T.rate,2,10,.5,function(v){return Number(v).toFixed(1)+' g/s';}]];
    defs.forEach(function(d){var row=document.createElement('label');row.className='pl-row';row.innerHTML='<span>'+d[1]+'</span><input type="range" min="'+d[2]+'" max="'+d[3]+'" step="'+d[4]+'"><span class="pl-val"></span>';var inp=row.querySelector('input');inp.value=state[d[0]];inp.oninput=function(){state[d[0]]=Number(inp.value);redraw(true);};row._def=d;el.querySelector('.pl-sliders').appendChild(row);});
    [['standard','standard'],['sour','sour'],['bitter','bitter'],['weak','weak'],['rush','rush'],['original46','original46']].forEach(function(x){var b=document.createElement('button');b.className='pl-choice';b.textContent=T[x[0]];b.onclick=function(){Object.assign(state,PRESETS[x[1]]);redraw(true);};el.querySelector('.pl-presets').appendChild(b);});
    var reset=document.createElement('button');reset.className='pl-choice';reset.textContent=T.reset;reset.onclick=function(){state={grind:700,temp:93,ratio:17,pourRate:5,dripper:'v60',method:'three'};redraw(true);};el.querySelector('.pl-presets').appendChild(reset);
    var play=document.createElement('button');play.className='pl-choice pl-play';play.textContent=T.play;play.onclick=startPlay;el.querySelector('.pl-presets').appendChild(play);
    var compareMode='method';el.querySelector('.pl-cm').onclick=function(){compareMode='method';redraw(false);};el.querySelector('.pl-cd').onclick=function(){compareMode='dripper';redraw(false);};
    function push(pt){if(!machine||typeof machine.update!=='function')return;machine.update({t:pt.t,grind:state.grind,temp:state.temp,pourRate:state.pourRate,pouring:pt.pouring,poured:pt.poured,head:pt.head,flow:pt.flow,cup:pt.cup,dripper:state.dripper,valve:pt.valve,phase:pt.phase,elapsed:fmtTime(pt.t)});}
    function base(svg){while(svg.firstChild)svg.removeChild(svg.firstChild);svg.appendChild(S('path',{d:'M48 18V232H620',fill:'none',stroke:'var(--line)'}));}
    function drawCharts(playT){var a=el.querySelectorAll('.pl-chart'),maxT=Math.max(1,result.totalTime),x=function(t){return 48+t/maxT*572;};base(a[0]);[['0','rgba(120,150,175,.08)',0,result.bloomEnd],['1','rgba(180,130,70,.07)',result.bloomEnd,result.pourEnd],['2','rgba(110,110,100,.06)',result.pourEnd,result.totalTime]].forEach(function(z){a[0].insertBefore(S('rect',{x:x(z[2]),y:18,width:Math.max(0,x(z[3])-x(z[2])),height:214,fill:z[1]}),a[0].firstChild);});var maxW=Math.max(state.ratio*15,result.peakHead,1),y=function(v){return 232-v/maxW*200;};[['poured','var(--blue)'],['head','var(--accent)'],['cup','#8c6a43']].forEach(function(q){a[0].appendChild(S('path',{d:path(result.curve,x,y,q[0]),fill:'none',stroke:q[1],'stroke-width':'2'}));});result.pours.forEach(function(p){a[0].appendChild(S('path',{d:'M'+x(p.start)+' 18l-5 9h10z',fill:'var(--accent)'}));});a[0].appendChild(S('text',{x:52,y:15,fill:'var(--muted)'},T.poured+' · '+T.inDripper+' · '+T.cup));base(a[1]);var yE=function(v){return 232-v/26*200;};a[1].appendChild(S('rect',{x:48,y:yE(22),width:572,height:yE(18)-yE(22),fill:'rgba(90,160,110,.13)'}));a[1].appendChild(S('path',{d:path(result.curve,x,yE,'ey'),fill:'none',stroke:'var(--accent)','stroke-width':'2'}));a[1].appendChild(S('text',{x:52,y:15,fill:'var(--muted)'},T.ey+' 18–22%'));if(playT!=null){var pt=interp(result.curve,playT);a[0].appendChild(S('circle',{cx:x(pt.t),cy:y(pt.head),r:5,fill:'var(--accent)'}));a[1].appendChild(S('circle',{cx:x(pt.t),cy:yE(pt.ey),r:5,fill:'var(--accent)'}));}}
    function drawMap(){var svg=el.querySelector('.pl-map');while(svg.firstChild)svg.removeChild(svg.firstChild);var xs=[14,18,22,26],ys=[.9,1.15,1.35,1.7];for(var i=0;i<3;i++)for(var j=0;j<3;j++)svg.appendChild(S('rect',{x:55+i*180,y:20+(2-j)*65,width:180,height:65,fill:(i===1&&j===1)?'rgba(90,160,110,.15)':'none',stroke:'var(--line)'}));function px(v){return 55+(v-14)/12*540;}function py(v){return 215-(v-.9)/.8*195;}if(oldPoint)svg.appendChild(S('circle',{cx:px(oldPoint.ey),cy:py(oldPoint.tds),r:6,fill:'var(--muted)',opacity:.35}));svg.appendChild(S('circle',{cx:px(result.ey),cy:py(result.tds),r:8,fill:'var(--accent)'}));svg.appendChild(S('text',{x:240,y:120,fill:'var(--muted)'},T.balanced+' · '+T.ideal));}
    function updateNumbers(pt){var r=result,live=pt||result.curve[result.curve.length-1],taste=(r.taste.extraction==='sour'?T.sourTaste:r.taste.extraction==='balanced'?T.balanced:T.bitterTaste)+' × '+(r.taste.strength==='weak'?T.weakTaste:r.taste.strength==='ideal'?T.ideal:T.strong);var vals=[[T.time,fmtTime(pt?pt.t:r.totalTime)],[T.ey,(pt?live.ey:r.ey).toFixed(1)+'%'],[T.tds,r.tds.toFixed(2)+'%'],[T.taste,taste],[T.head,r.peakHead.toFixed(1)+' g']];el.querySelector('.pl-nums').innerHTML=vals.map(function(v){return '<div class="pl-num"><small>'+v[0]+'</small><strong>'+v[1]+'</strong></div>';}).join('');el.querySelector('.pl-note').textContent=T.warning+': '+(r.warnings.length?r.warnings.map(function(w){return T[w];}).join('；'):T.none);}
    function drawCompare(){var keys=compareMode==='method'?['single','two','three','pulse','46']:['v60','kadou','kalita','melitta','clever'],field=compareMode==='method'?'method':'dripper';el.querySelector('.pl-cm').setAttribute('aria-pressed',compareMode==='method');el.querySelector('.pl-cd').setAttribute('aria-pressed',compareMode==='dripper');var html='<thead><tr><th>'+T[field]+'</th><th>'+T.time+'</th><th>'+T.ey+'</th><th>'+T.tds+'</th><th>'+T.head+'</th></tr></thead><tbody>';keys.forEach(function(k){var q=Object.assign({},state);q[field]=k;var r=model(q);html+='<tr class="'+(state[field]===k?'sel':'')+'"><td>'+T[k]+'</td><td>'+fmtTime(r.totalTime)+'</td><td>'+r.ey.toFixed(1)+'%</td><td>'+r.tds.toFixed(2)+'%</td><td>'+r.peakHead.toFixed(0)+' g</td></tr>';});el.querySelector('.pl-compare').innerHTML=html+'</tbody>';}
    function redraw(track){if(raf){cancelAnimationFrame(raf);raf=0;}if(track&&result)oldPoint={ey:result.ey,tds:result.tds};result=model(state);el.querySelectorAll('.pl-row').forEach(function(row){var d=row._def;row.querySelector('input').value=state[d[0]];row.querySelector('.pl-val').textContent=d[5](state[d[0]]);});el.querySelectorAll('.pl-drippers button').forEach(function(b,i){b.setAttribute('aria-pressed',['v60','kadou','kalita','melitta','clever'][i]===state.dripper);});el.querySelectorAll('.pl-methods button').forEach(function(b,i){b.setAttribute('aria-pressed',['single','two','three','pulse','46'][i]===state.method);});el.querySelector('.pl-method-note').textContent=state.method==='46'?T.note46:'';drawCharts(null);drawMap();updateNumbers(null);drawCompare();push(result.curve[result.curve.length-1]);}
    function startPlay(){result=model(state);var reduce=global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce){redraw(false);return;}var start=0;function tick(now){if(!start)start=now;var u=Math.min(1,(now-start)/PLAY_MS),t=u*result.totalTime,pt=interp(result.curve,t);drawCharts(t);updateNumbers(pt);push(pt);if(u<1)raf=requestAnimationFrame(tick);else{raf=0;redraw(false);}}raf=requestAnimationFrame(tick);}
    el.querySelectorAll('.pl-chart').forEach(function(svg,chartIndex){function hover(ev){if(!result)return;var title=svg.querySelector('title');if(!title){title=document.createElementNS('http://www.w3.org/2000/svg','title');svg.appendChild(title);}var box=svg.getBoundingClientRect(),u=clamp((ev.clientX-box.left)/Math.max(1,box.width),0,1),pt=interp(result.curve,u*result.totalTime);title.textContent=fmtTime(pt.t)+' · '+(chartIndex===0?T.poured+' '+pt.poured.toFixed(1)+' g · '+T.inDripper+' '+pt.head.toFixed(1)+' g · '+T.cup+' '+pt.cup.toFixed(1)+' g':T.ey+' '+pt.ey.toFixed(2)+'%');}svg.addEventListener('pointermove',hover);svg.addEventListener('pointerdown',hover);});
    redraw(false);
  }
  function autoMount(){if(typeof document==='undefined')return;document.querySelectorAll('[data-lab-demo="pourover"]').forEach(mount);}
  global.PourOverModel={model:model,PARAMS:PARAMS};global.mountPourOver=mount;
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoMount);else autoMount();}
  if(typeof module!=='undefined'&&module.exports)module.exports={model:model,PARAMS:PARAMS,PRESETS:PRESETS,PLAY_MS:PLAY_MS,VERSION:VERSION,pourPlan:pourPlan};
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
