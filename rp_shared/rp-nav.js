/* ============================================================
   Realpha 共用頂端選單  rp-nav.js  v2（2026-10-26）
   用法（各站加兩行，放在 <body> 開頭或 </body> 前都可）：
     <link rel="stylesheet" href="https://getrealpha.com/rp/rp-tokens.css?v=1">
     <script src="https://getrealpha.com/rp/rp-nav.js?v=1"
             data-rp-site="stock" data-rp-theme="dark"></script>
   屬性（都放在 script 標籤上）：
     data-rp-site    必填，站代號（見 SITES）。
     data-rp-theme   light | dark。站的預設主題。沒給→cookie→系統。
     data-rp-mode    bar（預設，靜態在流、會隨頁面捲走）
                     sticky（黏在頂端；只給沒有自家 sticky 頁首的站）
                     float（全螢幕站：右上角浮動小鈕，零版面佔用）
     data-rp-corner  tl | tr（預設）| bl | br。只對 float：浮動鈕放哪個角（距邊 10px）；
                     左側兩角的抽屜改從左邊滑出。站內 CSS rp-nav{...} 仍可覆寫。
     data-rp-frame   "1" 允許在 iframe 裡掛選單（沒給→在 iframe 裡什麼都不做）
     data-rp-toggle  "1" 顯示深淺切換鈕（站已接 rp:theme 事件或吃 --rp- 變數時才開）
     data-rp-lock    "1" 鎖定主題（忽略 cookie；同時隱藏切換鈕）
   v2 新增：data-rp-corner、iframe 守衛（data-rp-frame）、自報版本（version='2'、host[data-rp-version="2"]）。
         沒加新屬性的站行為與 v1 相同。
   鐵律：classic script（不要改成 type=module）、不 fetch、不載字型 → 跨網域免 CORS。
         只動三樣東西：插入 <rp-nav>、設 html[data-rp-theme]、寫 --rp-nav-h。
         不碰各站任何元素的 position / top / margin。
   對外 API：window.RealphaNav = { setTheme(t), getTheme(), open(), close(), version }
   事件：document 上派發 CustomEvent('rp:theme', {detail:{theme}})
   ============================================================ */
(function () {
  'use strict';
  if (window.RealphaNav) return; // 重複載入保護

  // ---------- 讀 script 屬性（必須同步讀，之後 currentScript 會是 null） ----------
  var me = document.currentScript;
  var ds = (me && me.dataset) || {};

  // ---------- iframe 守衛：在別人的框裡不掛（除非 data-rp-frame="1"） ----------
  var framed;
  try { framed = window.self !== window.top; } catch (e) { framed = true; } // 跨網域讀 top 會丟例外 → 視同在 iframe
  if (framed && ds.rpFrame !== '1') return; // 不建元素、不改 html 屬性、不設 window.RealphaNav

  var VERSION = '2';
  var DOMAIN = 'getrealpha.com';
  var HUB_URL = 'https://' + DOMAIN + '/hub/';
  var COOKIE = 'rp_theme';

  // ---------- 14 站清單（順序＝選單順序） ----------
  var GROUPS = [
    { id: 'invest', label: '投資', sites: [
      { id: 'stock',  host: 'stock',         name: '持股決策', desc: '' },
      { id: 'seller', host: 'seller',        name: '台指選擇權', desc: '' },
      { id: 'asset',  host: 'asset',         name: '資產彙總', desc: '' },
      { id: 'kline',  host: 'kline',         name: 'K 線台', desc: '' },
      { id: 'cycle',  host: 'cycle',         name: '營運週期', desc: '' },
      { id: 'zhangtianping', host: 'zhangtianping', name: '掌天瓶', desc: '' }
    ]},
    { id: 'intel', label: '情報', sites: [
      { id: 'hot',    host: 'hot',           name: '熱點', desc: '' },
      { id: 'patent', host: 'patent',        name: '專利情報', desc: '' }
    ]},
    { id: 'learn', label: '學習', sites: [
      { id: 'learn',  host: 'learn',         name: '學習站', desc: '' },
      { id: 'piano',  host: 'piano',         name: 'Piano Quest', desc: '' }
    ]},
    { id: 'life', label: '生活', sites: [
      { id: 'health', host: 'health',        name: '健康站', desc: '' },
      { id: 'fitable', host: 'fitable',      name: '健身車', desc: '' }
    ]},
    { id: 'make', label: '創作', sites: [
      { id: 'blog',   host: 'blog',          name: '部落格', desc: '聽我陪你做研究（公開）' },
      { id: 'easel',  host: 'easel',         name: 'Easel', desc: '' }
    ]}
  ];

  var SITE = ds.rpSite || guessSite();
  var MODE = ds.rpMode || 'bar';
  var LOCK = ds.rpLock === '1';
  var SHOW_TOGGLE = ds.rpToggle === '1' && !LOCK;
  var DEFAULT_THEME = ds.rpTheme === 'dark' || ds.rpTheme === 'light' ? ds.rpTheme : null;
  // 只認四個值；沒給或亂給 → null（不設 data-corner，沿用 v1 的右上角規則）
  var CORNER = MODE === 'float' && /^(tl|tr|bl|br)$/.test(ds.rpCorner || '') ? ds.rpCorner : null;

  function guessSite() {
    var h = location.hostname.split('.')[0];
    for (var g = 0; g < GROUPS.length; g++) for (var s = 0; s < GROUPS[g].sites.length; s++)
      if (GROUPS[g].sites[s].host === h) return GROUPS[g].sites[s].id;
    return h === DOMAIN.split('.')[0] || h === 'www' ? 'hub' : '';
  }
  function findSite(id) {
    for (var g = 0; g < GROUPS.length; g++) for (var s = 0; s < GROUPS[g].sites.length; s++)
      if (GROUPS[g].sites[s].id === id) return GROUPS[g].sites[s];
    return null;
  }
  function siteUrl(s) { return 'https://' + s.host + '.' + DOMAIN + '/'; }

  // ---------- 主題 ----------
  function readCookie() {
    var m = document.cookie.match(/(?:^|;\s*)rp_theme=(light|dark)/);
    return m ? m[1] : null;
  }
  function writeCookie(t) {
    try {
      var secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = COOKIE + '=' + t + '; Domain=.' + DOMAIN + '; Path=/; Max-Age=31536000; SameSite=Lax' + secure;
      // 本機開發（localhost:埠）Domain 寫不進去，再寫一份不帶 Domain 的
      if (location.hostname.indexOf(DOMAIN) < 0) document.cookie = COOKIE + '=' + t + '; Path=/; Max-Age=31536000; SameSite=Lax';
    } catch (e) {}
  }
  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function resolveTheme() {
    var html = document.documentElement.getAttribute('data-rp-theme');
    if (html === 'light' || html === 'dark') return html;   // 站自己已先設好 → 尊重
    if (LOCK) return DEFAULT_THEME || systemTheme();
    return (SHOW_TOGGLE && readCookie()) || DEFAULT_THEME || readCookie() || systemTheme();
  }
  var theme = resolveTheme();
  document.documentElement.setAttribute('data-rp-theme', theme); // 越早設越不閃

  function setTheme(t, opts) {
    if (t !== 'light' && t !== 'dark') return;
    theme = t;
    document.documentElement.setAttribute('data-rp-theme', t);
    if (!(opts && opts.silent)) writeCookie(t);
    if (host) host.setAttribute('data-theme', t);
    try { document.dispatchEvent(new CustomEvent('rp:theme', { detail: { theme: t } })); } catch (e) {}
  }

  // ---------- 樣式（Shadow DOM 內，吃宿主頁的 --rp- 變數；變數缺時有備援值） ----------
  var CSS = [
    ':host{all:initial;display:block;font-family:var(--rp-font-sans,"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif);',
    '  font-size:14px;line-height:1.4;color:var(--rp-text,#2b2f3a);-webkit-font-smoothing:antialiased;',
    '  --h:44px;--bg:var(--rp-nav-bg,rgba(246,245,241,.92));--line:var(--rp-nav-line,#e4e1d8);--text:var(--rp-text,#2b2f3a);',
    '  --muted:var(--rp-text-muted,#5d6474);--accent:var(--rp-accent,#3a4f9a);--tint:var(--rp-accent-tint,rgba(58,79,154,.1));',
    '  --surface:var(--rp-surface,#fffefb);--shadow:var(--rp-shadow-hover,0 14px 26px -16px rgba(0,0,0,.35));--r:var(--rp-radius,6px);',
    '  --z:var(--rp-z-nav,40);--dur:var(--rp-dur,160ms);--ease:var(--rp-ease,cubic-bezier(.2,.7,.2,1))}',
    ':host([data-mode="sticky"]){position:sticky;top:0;z-index:var(--z)}',
    ':host([data-mode="float"]){position:fixed;top:10px;right:10px;z-index:var(--z);width:auto}',
    /* v2 角落：只在 data-corner 存在時生效；站內 rp-nav{...} 屬外層樣式，照樣蓋得過 :host */
    ':host([data-mode="float"][data-corner="tl"]){top:10px;left:10px;right:auto;bottom:auto}',
    ':host([data-mode="float"][data-corner="tr"]){top:10px;right:10px;left:auto;bottom:auto}',
    ':host([data-mode="float"][data-corner="bl"]){top:auto;bottom:10px;left:10px;right:auto}',
    ':host([data-mode="float"][data-corner="br"]){top:auto;bottom:10px;right:10px;left:auto}',
    ':host([hidden]){display:none}',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'a{color:inherit;text-decoration:none}',
    'button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}',
    'button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}',
    /* 橫條 */
    '.bar{display:flex;align-items:center;gap:6px;height:var(--h);padding:0 12px;background:var(--bg);',
    '  border-bottom:1px solid var(--line);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);position:relative;z-index:1}',
    '.brand{display:inline-flex;align-items:center;gap:8px;padding:4px 6px 4px 2px;border-radius:var(--r);white-space:nowrap}',
    '.brand:hover{background:var(--tint)}',
    '.logo{width:22px;height:22px;flex:none}',
    '.brand b{font-weight:700;letter-spacing:.01em}',
    '.brand .here{color:var(--muted);font-weight:500}',
    '.brand .here::before{content:"/";margin:0 6px;color:var(--line)}',
    '.groups{display:flex;align-items:center;gap:2px;margin-left:8px;flex:1;min-width:0}',
    '.g{position:relative}',
    '.g>button{display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 10px;border-radius:var(--r);color:var(--muted);white-space:nowrap}',
    '.g>button:hover,.g>button[aria-expanded="true"]{color:var(--text);background:var(--tint)}',
    '.g.on>button{color:var(--accent);font-weight:700}',
    '.g>button .car{width:10px;height:10px;opacity:.6}',
    '.menu{position:absolute;left:0;top:calc(100% + 6px);min-width:240px;padding:6px;background:var(--surface);border:1px solid var(--line);',
    '  border-radius:var(--r);box-shadow:var(--shadow);display:none;z-index:2}',
    '.g[open] .menu{display:block}',
    '.item{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:7px 10px;border-radius:4px;color:var(--text)}',
    '.item:hover{background:var(--tint)}',
    '.item .d{grid-column:1/-1;font-size:12px;color:var(--muted)}',
    '.item.on{color:var(--accent)}',
    '.item.on>span:first-child::after{content:"";display:inline-block;width:6px;height:6px;margin-left:6px;vertical-align:middle;border-radius:50%;background:var(--accent)}',
    '.right{display:flex;align-items:center;gap:4px;margin-left:auto}',
    '.ib{display:inline-flex;align-items:center;justify-content:center;width:32px;height:30px;border-radius:var(--r);color:var(--muted)}',
    '.ib:hover{color:var(--text);background:var(--tint)}',
    '.ib svg{width:18px;height:18px}',
    '.hub{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:var(--r);color:var(--muted);white-space:nowrap}',
    '.hub:hover{color:var(--text);background:var(--tint)}',
    '.burger{display:none}',
    /* 浮動模式 */
    '.fab{display:none;align-items:center;gap:6px;height:34px;padding:0 10px 0 8px;border-radius:999px;background:var(--bg);',
    '  border:1px solid var(--line);box-shadow:var(--shadow);backdrop-filter:blur(6px);color:var(--text);font-weight:600;opacity:.55;transition:opacity var(--dur) var(--ease)}',
    '.fab:hover,.fab[aria-expanded="true"]{opacity:1}',
    '.fab .logo{width:18px;height:18px}',
    ':host([data-mode="float"]) .bar{display:none}',
    ':host([data-mode="float"]) .fab{display:inline-flex}',
    /* 全站面板（手機與浮動模式共用） */
    '.panel{position:fixed;inset:0;z-index:var(--z);display:none}',
    '.panel[open]{display:block}',
    '.scrim{position:absolute;inset:0;background:rgba(0,0,0,.35)}',
    '.sheet{position:absolute;top:0;right:0;bottom:0;width:min(360px,92vw);overflow:auto;background:var(--surface);border-left:1px solid var(--line);',
    '  box-shadow:var(--shadow);padding:12px 12px 24px;color:var(--text)}',
    ':host([data-corner="tl"]) .sheet,:host([data-corner="bl"]) .sheet{right:auto;left:0;border-left:0;border-right:1px solid var(--line)}',
    '.sheet .top{display:flex;align-items:center;justify-content:space-between;height:36px;margin-bottom:8px}',
    '.sheet h4{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.06em;margin:14px 8px 4px}',
    '.sheet .item{padding:9px 10px}',
    '.sheet .hubrow{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--line);border-radius:var(--r);margin-top:4px}',
    '.sheet .hubrow:hover{background:var(--tint)}',
    '@media (max-width:760px){.groups,.hub .t{display:none}.burger{display:inline-flex}.brand .here{display:none}}',
    '@media (prefers-reduced-motion:reduce){*{transition:none!important}}'
  ].join('\n');

  // ---------- SVG ----------
  var LOGO = '<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 9.5 6l3.2 6.2L15.8 6 21 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 14.5h12" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/></svg>';
  var CARET = '<svg class="car" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  var GRID = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  var BURGER = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- 組 HTML ----------
  function render() {
    var cur = findSite(SITE);
    var hereName = cur ? cur.name : (SITE === 'hub' ? '總入口' : '');
    var groupsHtml = GROUPS.map(function (g) {
      var on = g.sites.some(function (s) { return s.id === SITE; });
      return '<div class="g' + (on ? ' on' : '') + '" data-g="' + g.id + '">' +
        '<button type="button" aria-haspopup="true" aria-expanded="false">' + esc(g.label) + CARET + '</button>' +
        '<div class="menu" role="menu">' + g.sites.map(itemHtml).join('') + '</div></div>';
    }).join('');
    var sheetHtml = GROUPS.map(function (g) {
      return '<h4>' + esc(g.label) + '</h4>' + g.sites.map(itemHtml).join('');
    }).join('');
    var toggleHtml = SHOW_TOGGLE ? '<button type="button" class="ib tg" aria-label="切換深淺色" title="切換深淺色">' + (theme === 'dark' ? SUN : MOON) + '</button>' : '';
    return '<style>' + CSS + '</style>' +
      '<nav class="bar" aria-label="Realpha 全站">' +
        '<a class="brand" href="' + HUB_URL + '" title="Realpha 總入口">' + LOGO + '<b>Realpha</b>' + (hereName ? '<span class="here">' + esc(hereName) + '</span>' : '') + '</a>' +
        '<div class="groups">' + groupsHtml + '</div>' +
        '<div class="right">' +
          '<a class="hub" href="' + HUB_URL + '">' + GRID.replace('<svg', '<svg style="width:16px;height:16px"') + '<span class="t">總入口</span></a>' +
          toggleHtml +
          '<button type="button" class="ib burger" aria-label="全站選單" aria-expanded="false">' + BURGER + '</button>' +
        '</div>' +
      '</nav>' +
      '<button type="button" class="fab" aria-label="Realpha 全站選單" aria-expanded="false">' + LOGO + '<span>' + esc(hereName || 'Realpha') + '</span></button>' +
      '<div class="panel" role="dialog" aria-label="Realpha 全站選單">' +
        '<div class="scrim"></div>' +
        '<div class="sheet">' +
          '<div class="top"><a class="brand" href="' + HUB_URL + '">' + LOGO + '<b>Realpha</b></a>' +
            '<span style="display:flex;gap:4px">' + toggleHtml.replace('class="ib tg"', 'class="ib tg"') + '<button type="button" class="ib close" aria-label="關閉">' + X + '</button></span></div>' +
          '<a class="hubrow" href="' + HUB_URL + '">' + GRID.replace('<svg', '<svg style="width:18px;height:18px"') + '<b>總入口</b><span style="color:var(--muted);font-size:12px;margin-left:auto">14 站</span></a>' +
          sheetHtml +
        '</div>' +
      '</div>';
  }
  function itemHtml(s) {
    var on = s.id === SITE;
    return '<a class="item' + (on ? ' on' : '') + '" role="menuitem" href="' + siteUrl(s) + '"' + (on ? ' aria-current="page"' : '') + '>' +
      '<span>' + esc(s.name) + '</span>' + (s.desc ? '<span class="d">' + esc(s.desc) + '</span>' : '') + '</a>';
  }

  // ---------- 掛載 ----------
  var host = null, root = null;
  function mount() {
    if (host) return;
    host = document.createElement('rp-nav');
    host.setAttribute('data-mode', MODE);
    host.setAttribute('data-site', SITE);
    host.setAttribute('data-theme', theme);
    host.setAttribute('data-rp-version', VERSION);
    if (CORNER) host.setAttribute('data-corner', CORNER);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = render();

    var parent = document.body;
    if (MODE === 'float') parent.appendChild(host);
    else parent.insertBefore(host, parent.firstChild);

    // 實際高度寫回變數，站若想避讓（例：自家 sticky 頁首 top:var(--rp-nav-h)）可用
    var h = MODE === 'float' ? 0 : host.getBoundingClientRect().height || 44;
    document.documentElement.style.setProperty('--rp-nav-h', h + 'px');

    wire();
  }

  function wire() {
    var panel = root.querySelector('.panel');
    var fab = root.querySelector('.fab');
    var burger = root.querySelector('.burger');

    function openPanel() { panel.setAttribute('open', ''); fab.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-expanded', 'true'); }
    function closePanel() { panel.removeAttribute('open'); fab.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-expanded', 'false'); }
    function closeMenus() {
      root.querySelectorAll('.g[open]').forEach(function (g) { g.removeAttribute('open'); g.querySelector('button').setAttribute('aria-expanded', 'false'); });
    }
    fab.addEventListener('click', function () { panel.hasAttribute('open') ? closePanel() : openPanel(); });
    burger.addEventListener('click', openPanel);
    root.querySelector('.scrim').addEventListener('click', closePanel);
    root.querySelector('.close').addEventListener('click', closePanel);

    // 分組下拉：點開／hover 開、移出延遲關、Esc 關、點外面關
    root.querySelectorAll('.g').forEach(function (g) {
      var btn = g.querySelector('button'), timer = null;
      function open() { closeMenus(); g.setAttribute('open', ''); btn.setAttribute('aria-expanded', 'true'); }
      function close() { g.removeAttribute('open'); btn.setAttribute('aria-expanded', 'false'); }
      btn.addEventListener('click', function () { g.hasAttribute('open') ? close() : open(); });
      g.addEventListener('mouseenter', function () { clearTimeout(timer); if (matchMedia('(hover:hover)').matches) open(); });
      g.addEventListener('mouseleave', function () { timer = setTimeout(close, 180); });
    });
    document.addEventListener('click', function (e) { if (!e.composedPath().some(function (n) { return n === host; })) closeMenus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenus(); closePanel(); } });

    root.querySelectorAll('.tg').forEach(function (b) {
      b.addEventListener('click', function () {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        root.querySelectorAll('.tg').forEach(function (x) { x.innerHTML = theme === 'dark' ? SUN : MOON; });
      });
    });
  }

  // ---------- 公開 API ----------
  window.RealphaNav = {
    version: VERSION,
    site: SITE,
    sites: GROUPS,
    hub: HUB_URL,
    setTheme: function (t) { setTheme(t); if (root) root.querySelectorAll('.tg').forEach(function (x) { x.innerHTML = t === 'dark' ? SUN : MOON; }); },
    getTheme: function () { return theme; },
    open: function () { if (root) root.querySelector('.fab').click(); },
    close: function () { if (root) root.querySelector('.scrim').click(); }
  };

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
