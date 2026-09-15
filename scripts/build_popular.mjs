// 從 serve_dist.mjs 的瀏覽紀錄算熱門文章，輸出 src/data/popular.json。
//   node scripts/build_popular.mjs [--logs ./logs] [--days 30]
//   node scripts/build_popular.mjs --self-test
// 只算真人：濾掉 bot=1、ua 空、ua 含自動化字樣、cc 空（本機直連／非 Cloudflare 進來）、s≠200。
// 只算 /blog/<slug>/ 與 /en/blog/<slug>/，且 slug 要在 src/content/blog 存在、非 draft。
// 任何狀況（logs 不存在、壞行）都不讓 build 失敗：最壞輸出 []。
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOP_N = 20;
const AUTOMATION_UA =
	/python|urllib|curl|wget|go-http|java|okhttp|axios|node|scrapy|httpx|aiohttp|headless|bot|crawl|spider|preview|monitor|uptime|feed|rss/i;

export function isHuman(row) {
	if (!row || row.bot === 1) return false;
	const ua = typeof row.ua === 'string' ? row.ua : '';
	if (!ua.trim() || AUTOMATION_UA.test(ua)) return false;
	if (!row.cc) return false;
	return row.s === 200;
}

/** '/blog/x/' → {lang:'zh-TW', slug:'x'}；'/en/blog/x/' → {lang:'en', slug:'x'}；其餘 null */
export function parseArticlePath(p) {
	const m = typeof p === 'string' ? p.match(/^\/(en\/)?blog\/([^/?#]+)\/$/) : null;
	return m ? { lang: m[1] ? 'en' : 'zh-TW', slug: decodeURIComponent(m[2]) } : null;
}

/** 讀 src/content/blog 的 frontmatter，回傳 Set('zh-TW:slug', 'en:slug')，已排除 draft */
export async function publishedKeys(contentDir) {
	const keys = new Set();
	if (!existsSync(contentDir)) return keys;
	for (const f of await readdir(contentDir)) {
		if (!/\.mdx?$/.test(f)) continue;
		const text = await readFile(join(contentDir, f), 'utf8');
		const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
		if (!fm) continue;
		const slug = fm.match(/^slug:\s*["']?([^"'\r\n]+?)["']?\s*$/m)?.[1];
		const lang = fm.match(/^lang:\s*["']?([^"'\r\n]+?)["']?\s*$/m)?.[1];
		if (!slug || !lang || /^draft:\s*true\s*$/m.test(fm)) continue;
		keys.add(`${lang}:${slug}`);
	}
	return keys;
}

/** 近 N 天（含今天，UTC 日期，與紀錄檔命名一致）的檔名 */
export function logFileNames(days, now = new Date()) {
	const names = [];
	for (let i = 0; i < days; i++) {
		const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
		names.push(`visits-${d}.jsonl`);
	}
	return names;
}

export function aggregate(rows, keys) {
	const counts = new Map();
	let total = 0;
	for (const row of rows) {
		if (!isHuman(row)) continue;
		const a = parseArticlePath(row.p);
		if (!a || !keys.has(`${a.lang}:${a.slug}`)) continue;
		total++;
		const k = `${a.lang}:${a.slug}`;
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	const list = [...counts.entries()]
		.map(([k, views]) => {
			const i = k.indexOf(':');
			return { slug: k.slice(i + 1), lang: k.slice(0, i), views };
		})
		.sort((a, b) => b.views - a.views || a.slug.localeCompare(b.slug) || a.lang.localeCompare(b.lang));
	return { top: list.slice(0, TOP_N), total };
}

// ponytail: 每天一個小檔、整檔讀進記憶體；單日紀錄若長到數百 MB 再改逐行串流
async function readRows(logsDir, days) {
	const rows = [];
	if (!existsSync(logsDir)) return rows;
	for (const name of logFileNames(days)) {
		const file = join(logsDir, name);
		if (!existsSync(file)) continue;
		for (const line of (await readFile(file, 'utf8')).split('\n')) {
			if (!line.trim()) continue;
			try {
				rows.push(JSON.parse(line));
			} catch {
				// 壞行（寫到一半）略過
			}
		}
	}
	return rows;
}

export async function run({ logsDir, days, contentDir, outFile }) {
	let result = { top: [], total: 0 };
	try {
		const keys = await publishedKeys(contentDir);
		result = aggregate(await readRows(logsDir, days), keys);
	} catch (err) {
		console.warn(`[build_popular] WARNING ${err?.message ?? err}；輸出 []`);
	}
	await mkdir(dirname(outFile), { recursive: true });
	await writeFile(outFile, `${JSON.stringify(result.top, null, 2)}\n`, 'utf8');
	return result;
}

function arg(name, fallback) {
	const i = process.argv.indexOf(name);
	return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function selfTest() {
	const ok = { bot: 0, ua: 'Mozilla/5.0 (iPhone) Safari', cc: 'TW', s: 200 };
	assert.equal(isHuman(ok), true);
	assert.equal(isHuman({ ...ok, bot: 1 }), false);
	assert.equal(isHuman({ ...ok, ua: '' }), false);
	for (const ua of ['Python-urllib/3.10', 'curl/8', 'Go-http-client/1.1', 'okhttp', 'axios/1', 'node', 'HeadlessChrome', 'Feedly', 'UptimeRobot', 'Twitterbot', 'Slack Link Preview'])
		assert.equal(isHuman({ ...ok, ua }), false, ua);
	assert.equal(isHuman({ ...ok, cc: '' }), false);
	assert.equal(isHuman({ ...ok, s: 404 }), false);
	assert.equal(isHuman({ ...ok, s: 304 }), false);

	assert.deepEqual(parseArticlePath('/blog/a-b/'), { lang: 'zh-TW', slug: 'a-b' });
	assert.deepEqual(parseArticlePath('/en/blog/a-b/'), { lang: 'en', slug: 'a-b' });
	for (const p of ['/blog/', '/blog/a-b', '/blog/a-b.md', '/blog/a/b/', '/lab/a/', '/'])
		assert.equal(parseArticlePath(p), null, p);

	assert.equal(logFileNames(2, new Date('2026-09-15T12:00:00Z')).join(','), 'visits-2026-09-15.jsonl,visits-2026-09-14.jsonl');

	const dir = await mkdtemp(join(tmpdir(), 'popular-'));
	try {
		const content = join(dir, 'content');
		const logs = join(dir, 'logs');
		const out = join(dir, 'popular.json');
		await mkdir(content);
		await mkdir(logs);
		const fm = (slug, lang, draft = false) => `---\ntitle: "x"\nslug: "${slug}"\nlang: "${lang}"\n${draft ? 'draft: true\n' : ''}---\nbody\n`;
		await writeFile(join(content, 'a.zh-TW.mdx'), fm('a', 'zh-TW'));
		await writeFile(join(content, 'a.en.mdx'), fm('a', 'en'));
		await writeFile(join(content, 'b.zh-TW.mdx'), fm('b', 'zh-TW'));
		await writeFile(join(content, 'd.zh-TW.mdx'), fm('d', 'zh-TW', true));
		const today = new Date().toISOString().slice(0, 10);
		const old = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
		const row = (p, extra = {}) => JSON.stringify({ t: '', p, ref: '', ...ok, ...extra });
		await writeFile(
			join(logs, `visits-${today}.jsonl`),
			[
				row('/blog/a/'), row('/blog/a/'), row('/blog/b/'), row('/en/blog/a/'),
				row('/blog/a/', { bot: 1 }), row('/blog/a/', { cc: '' }), row('/blog/d/'), row('/blog/ghost/'),
				'{broken', '',
			].join('\n'),
		);
		await writeFile(join(logs, `visits-${old}.jsonl`), row('/blog/b/').repeat(1) + '\n' + row('/blog/b/'));
		const r = await run({ logsDir: logs, days: 30, contentDir: content, outFile: out });
		assert.equal(r.total, 4);
		assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), [
			{ slug: 'a', lang: 'zh-TW', views: 2 },
			{ slug: 'a', lang: 'en', views: 1 },
			{ slug: 'b', lang: 'zh-TW', views: 1 },
		]);
		const r2 = await run({ logsDir: join(dir, 'nope'), days: 30, contentDir: content, outFile: out });
		assert.equal(r2.total, 0);
		assert.equal(await readFile(out, 'utf8'), '[]\n');
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
	console.log('build_popular self-test: all passed');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	if (process.argv.includes('--self-test')) {
		await selfTest();
	} else {
		const days = Math.max(1, parseInt(arg('--days', '30'), 10) || 30);
		const logsDir = resolve(arg('--logs', './logs'));
		const r = await run({ logsDir, days, contentDir: join(ROOT, 'src/content/blog'), outFile: join(ROOT, 'src/data/popular.json') });
		console.log(`[build_popular] 近 ${days} 天真人文章瀏覽總數：${r.total}；寫入 ${r.top.length} 筆到 src/data/popular.json`);
		for (const [i, x] of r.top.slice(0, 10).entries()) console.log(`  ${i + 1}. ${x.views}\t${x.lang}\t${x.slug}`);
	}
}
