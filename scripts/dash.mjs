// 私人儀表板：只有通過 Cloudflare Access 的人看得到。
//
// 為什麼不做成 Astro 頁面：那會進網站地圖、進 llms.txt、進各種列表，
// 而且靜態頁只有建置當下的資料。這裡由伺服器直接算，看到的永遠是現在。
//
// 路徑刻意用 /_dash——底線開頭，不會跟任何文章 slug 撞到。
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE_RULES = [
	[/vocus/i, '方格子'],
	[/getrealpha/i, '站內'],
	[/google\./i, 'Google 搜尋'],
	[/bing\./i, 'Bing 搜尋'],
	[/(t\.co|twitter|x\.com)/i, 'X'],
	[/facebook/i, 'Facebook'],
	[/github/i, 'GitHub'],
];

function sourceOf(ref) {
	if (!ref) return '直接進來或書籤';
	const host = ref.split('//').pop().split('/')[0].toLowerCase();
	for (const [re, name] of SOURCE_RULES) if (re.test(host)) return name;
	return host || '不明';
}

export async function collectStats(logDir, days = 14) {
	const today = new Date();
	const wanted = new Set();
	for (let i = 0; i < days; i += 1) {
		const d = new Date(today.getTime() - i * 86400000);
		wanted.add(d.toISOString().slice(0, 10));
	}

	let files = [];
	try {
		files = (await readdir(logDir)).filter((f) => f.startsWith('visits-') && f.endsWith('.jsonl'));
	} catch {
		return { ready: false, reason: '還沒有任何紀錄檔' };
	}

	const rows = [];
	for (const f of files) {
		const day = f.slice(7, 17);
		if (!wanted.has(day)) continue;
		let text = '';
		try {
			text = await readFile(join(logDir, f), 'utf8');
		} catch {
			continue;
		}
		for (const line of text.split('\n')) {
			if (!line.trim()) continue;
			try {
				rows.push(JSON.parse(line));
			} catch {
				// 寫到一半被截斷的行，跳過
			}
		}
	}

	const human = rows.filter((r) => !r.bot);
	const tally = (arr, key) => {
		const m = new Map();
		for (const r of arr) {
			const k = typeof key === 'function' ? key(r) : r[key];
			m.set(k, (m.get(k) ?? 0) + 1);
		}
		return [...m.entries()].sort((a, b) => b[1] - a[1]);
	};

	const byDay = new Map();
	for (const r of human) {
		const d = r.t.slice(0, 10);
		byDay.set(d, (byDay.get(d) ?? 0) + 1);
	}
	const daily = [...wanted].sort().map((d) => [d, byDay.get(d) ?? 0]);
	const vocus = human.filter((r) => sourceOf(r.ref) === '方格子').length;

	return {
		ready: true,
		days,
		generatedAt: new Date().toISOString(),
		totalHuman: human.length,
		totalBot: rows.length - human.length,
		vocusCount: vocus,
		vocusPct: human.length ? (vocus / human.length) * 100 : 0,
		sources: tally(human, (r) => sourceOf(r.ref)).slice(0, 8),
		pages: tally(human.filter((r) => r.s === 200), 'p').slice(0, 15),
		notFound: tally(human.filter((r) => r.s === 404), 'p').slice(0, 8),
		countries: tally(human.filter((r) => r.cc), 'cc').slice(0, 6),
		daily,
	};
}

export function renderDash(s) {
	if (!s.ready) {
		return `<!doctype html><meta charset="utf-8"><title>流量</title>
<body style="font:16px/1.7 system-ui;padding:2rem;max-width:640px">
<h1>還沒有資料</h1><p>${s.reason}。伺服器重啟之後才開始記錄，過一陣子再回來看。</p>`;
	}

	const maxDaily = Math.max(1, ...s.daily.map(([, n]) => n));
	const bar = (n, max, w = 100) => `${Math.max(n ? 2 : 0, Math.round((n / max) * w))}%`;
	const rows = (list, max) => list.map(([k, n]) => `
		<tr><td class="k">${escape(String(k))}</td><td class="n">${n}</td>
		<td class="b"><i style="width:${bar(n, max)}"></i></td></tr>`).join('');
	const maxOf = (list) => Math.max(1, ...list.map(([, n]) => n));

	return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>流量 · 只有你看得到</title>
<style>
:root{--ink:#1a212b;--dim:#57616f;--line:#dde3ee;--paper:#fff;--soft:#f6f8fc;--accent:#1f6feb}
@media(prefers-color-scheme:dark){:root{--ink:#e6edf3;--dim:#8b949e;--line:#272e39;--paper:#0d1117;--soft:#161b22;--accent:#58a6ff}}
*{box-sizing:border-box}
body{margin:0;padding:1.4rem;font:16px/1.6 system-ui,"Noto Sans TC",sans-serif;background:var(--paper);color:var(--ink);max-width:760px;margin-inline:auto}
h1{font-size:1.4rem;margin:0 0 .2rem}
h2{font-size:1.05rem;margin:2rem 0 .6rem;padding-bottom:.35rem;border-bottom:1px solid var(--line)}
.sub{color:var(--dim);font-size:.86rem;margin:0 0 1.4rem}
.big{display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0}
.card{flex:1 1 150px;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:.85rem 1rem}
.card b{display:block;font-size:1.7rem;line-height:1.2}
.card span{color:var(--dim);font-size:.82rem}
table{width:100%;border-collapse:collapse}
td{padding:.32rem 0;vertical-align:middle}
td.k{font-size:.9rem;word-break:break-all;padding-right:.6rem}
td.n{width:3.2rem;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;padding-right:.6rem}
td.b{width:42%}
td.b i{display:block;height:9px;border-radius:5px;background:var(--accent);opacity:.75}
.empty{color:var(--dim);font-size:.9rem}
footer{margin-top:2.4rem;color:var(--dim);font-size:.8rem;border-top:1px solid var(--line);padding-top:.8rem}
</style>
<body>
<h1>最近 ${s.days} 天</h1>
<p class="sub">只有你看得到這一頁。資料來自自己的伺服器，不經過任何第三方。</p>

<div class="big">
	<div class="card"><b>${s.totalHuman}</b><span>次瀏覽（不含機器人）</span></div>
	<div class="card"><b>${s.vocusCount}</b><span>次從方格子來，佔 ${s.vocusPct.toFixed(0)}%</span></div>
	<div class="card"><b>${s.totalBot}</b><span>次是機器人</span></div>
</div>

<h2>人從哪裡來</h2>
${s.sources.length ? `<table>${rows(s.sources, maxOf(s.sources))}</table>` : '<p class="empty">還沒有資料</p>'}

<h2>哪幾頁有人看</h2>
${s.pages.length ? `<table>${rows(s.pages, maxOf(s.pages))}</table>` : '<p class="empty">還沒有資料</p>'}

<h2>每天</h2>
<table>${s.daily.map(([d, n]) => `
	<tr><td class="k">${d.slice(5)}</td><td class="n">${n}</td>
	<td class="b"><i style="width:${bar(n, maxDaily)}"></i></td></tr>`).join('')}</table>

${s.notFound.length ? `<h2>有人點到不存在的頁面</h2><table>${rows(s.notFound, maxOf(s.notFound))}</table>` : ''}
${s.countries.length ? `<h2>從哪個國家</h2><table>${rows(s.countries, maxOf(s.countries))}</table>` : ''}

<footer>更新於 ${s.generatedAt.replace('T', ' ').slice(0, 16)}（世界標準時間）・重新整理就是最新的</footer>
</body></html>`;
}

function escape(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
