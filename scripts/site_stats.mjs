// 全站計數器：從 serve_dist.mjs 的瀏覽紀錄算「今日瀏覽」（台灣時間）與「總瀏覽」，寫成 stats.json。
//   node scripts/site_stats.mjs              → 寫 public/stats.json；dist/ 存在時也寫 dist/stats.json（線上立即生效，不必重建）
//   node scripts/site_stats.mjs --self-test
// 2026-09-15 Charles「首頁的今日瀏覽／總瀏覽」（學楓羽）。build 會先跑一次（首頁顯示建置當下的數字），
// 排程 RealphaBlogStats 每 10 分鐘再跑一次，首頁打開時抓最新的。
// 只算真人（濾法同 build_popular.isHuman）且只算網頁（路徑以 / 結尾），圖片、.md、API 不算。
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHuman } from './build_popular.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TAIPEI_OFFSET_MS = 8 * 3600 * 1000;

export const taipeiDate = (ms) => new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);

export function isPageView(row) {
	if (!isHuman(row)) return false;
	const p = typeof row.p === 'string' ? row.p : '';
	return p.startsWith('/') && p.endsWith('/') && !p.startsWith('/_dash');
}

export function computeStats(rows, nowMs = Date.now()) {
	const today = taipeiDate(nowMs);
	let total = 0;
	let todayCount = 0;
	for (const row of rows) {
		if (!isPageView(row)) continue;
		total++;
		const ms = Date.parse(row.t);
		if (Number.isFinite(ms) && taipeiDate(ms) === today) todayCount++;
	}
	return { today: todayCount, total, date: today, asOf: new Date(nowMs).toISOString() };
}

// ponytail: 每次整批讀全部紀錄檔（目前一個月約數 MB）；紀錄長到上百 MB 再改成快取已結束日期的小計
async function readAllRows(logsDir) {
	const rows = [];
	if (!existsSync(logsDir)) return rows;
	for (const name of (await readdir(logsDir)).filter((n) => /^visits-\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort()) {
		for (const line of (await readFile(join(logsDir, name), 'utf8')).split('\n')) {
			if (!line.trim()) continue;
			try {
				rows.push(JSON.parse(line));
			} catch {
				// 寫到一半的行略過
			}
		}
	}
	return rows;
}

// 先寫暫存檔再改名，瀏覽器不會讀到寫一半的檔
async function writeAtomic(file, text) {
	await mkdir(dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	await writeFile(tmp, text, 'utf8');
	await rename(tmp, file);
}

async function selfTest() {
	const ok = { bot: 0, ua: 'Mozilla/5.0 (iPhone) Safari', cc: 'TW', s: 200 };
	const now = Date.parse('2026-09-15T05:00:00Z'); // 台灣 13:00
	const rows = [
		{ ...ok, p: '/', t: '2026-09-15T01:00:00Z' }, // 台灣 09:00 今天
		{ ...ok, p: '/blog/a/', t: '2026-09-14T16:30:00Z' }, // 台灣 00:30 今天（UTC 還是昨天）
		{ ...ok, p: '/blog/a/', t: '2026-09-14T15:59:00Z' }, // 台灣 23:59 昨天
		{ ...ok, p: '/blog/a.md', t: '2026-09-15T01:00:00Z' }, // 不是網頁
		{ ...ok, p: '/covers/x.png', t: '2026-09-15T01:00:00Z' },
		{ ...ok, p: '/_dash/', t: '2026-09-15T01:00:00Z' },
		{ ...ok, p: '/', t: '2026-09-15T01:00:00Z', bot: 1 }, // 機器人
		{ ...ok, p: '/', t: '2026-09-15T01:00:00Z', cc: '' }, // 本機直連
		{ ...ok, p: '/', t: 'garbage' }, // 時間壞掉：算總數不算今日
	];
	const s = computeStats(rows, now);
	assert.equal(s.total, 4);
	assert.equal(s.today, 2);
	assert.equal(s.date, '2026-09-15');
	assert.deepEqual(computeStats([], now), { today: 0, total: 0, date: '2026-09-15', asOf: new Date(now).toISOString() });
	console.log('site_stats self-test: all passed');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	if (process.argv.includes('--self-test')) {
		await selfTest();
	} else {
		let stats = { today: 0, total: 0, date: taipeiDate(Date.now()), asOf: new Date().toISOString() };
		try {
			stats = computeStats(await readAllRows(join(ROOT, 'logs')));
		} catch (err) {
			console.warn(`[site_stats] WARNING ${err?.message ?? err}；輸出 0`);
		}
		const text = `${JSON.stringify(stats)}\n`;
		await writeAtomic(join(ROOT, 'public', 'stats.json'), text);
		// dist 被 astro build 清空的那一兩分鐘不存在，就只寫 public；下一輪再補
		if (existsSync(join(ROOT, 'dist', 'index.html'))) await writeAtomic(join(ROOT, 'dist', 'stats.json'), text);
		console.log(`[site_stats] 今日（${stats.date}）${stats.today}｜總 ${stats.total}`);
	}
}
