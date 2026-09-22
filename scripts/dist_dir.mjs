// 建置目錄的單一設定來源（2026-09-23）。
//
// 病理：`astro build` 會先把 dist/ 清空再重寫，而 serve_dist.mjs 就是直接服務 dist/，
// 所以每次建置那幾分鐘全站 404——2026-09-22 22:28～22:37 那一輪，logs/visits 記到 219 筆 404，
// 裡面有真實讀者（/blog/gooaye-2026-07-22-ep681/）。
//
// 解法：兩個資料夾輪流用（dist ↔ dist-b），加一個指標檔 dist-current.txt 說「現在服務哪一個」。
// 建置一律寫到「沒在服務的那個」，全部後續步驟跑完才把指標換過去；中途失敗＝指標不動，線上維持舊版。
// 不用資料夾改名，因為 Windows 改不動正在被讀取的資料夾。
//
//   node scripts/dist_dir.mjs --check   自檢
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const POINTER_FILE = join(REPO_ROOT, 'dist-current.txt');

// 只認這兩個名字。指標檔是純文字，被亂寫時不能變成任意路徑。
export const DIST_DIRS = ['dist', 'dist-b'];
export const DEFAULT_DIST = 'dist';

/** 指標檔的內容轉成合法資料夾名；不合法或空的一律回 'dist'（向後相容：第一次部署還沒有這個檔） */
export function normalizeDistName(raw) {
	const name = String(raw ?? '').trim();
	return DIST_DIRS.includes(name) ? name : DEFAULT_DIST;
}

/** 目前線上服務的資料夾名（同步讀，給設定檔與一次性腳本用；伺服器自己有帶快取的版本） */
export function servingDistName() {
	try {
		return normalizeDistName(readFileSync(POINTER_FILE, 'utf8'));
	} catch {
		return DEFAULT_DIST;
	}
}

export function servingDistDir() {
	return join(REPO_ROOT, servingDistName());
}

/** 兩個資料夾輪流：現在服務 dist 就建到 dist-b，反之亦然 */
export function otherDistName(name = servingDistName()) {
	return normalizeDistName(name) === 'dist' ? 'dist-b' : 'dist';
}

/**
 * 這次建置要寫到哪個資料夾。
 * BLOG_BUILD_DIR 由 scripts/build_swap.mjs 設定；沒設就是 'dist'（單獨跑 astro build 的舊行為）。
 */
export function buildDistName() {
	return normalizeDistName(process.env.BLOG_BUILD_DIR);
}

export function buildDistDir() {
	return join(REPO_ROOT, buildDistName());
}

/** 換指標：先寫暫存檔再改名，讀的人不會讀到寫一半的內容 */
export async function writePointer(name) {
	const value = normalizeDistName(name);
	assert.equal(value, String(name).trim(), `不合法的資料夾名：${name}`);
	const tmp = `${POINTER_FILE}.tmp`;
	await writeFile(tmp, `${value}\n`, 'utf8');
	await rename(tmp, POINTER_FILE);
	return value;
}

function check() {
	assert.equal(normalizeDistName('dist'), 'dist');
	assert.equal(normalizeDistName('dist-b\n'), 'dist-b');
	assert.equal(normalizeDistName(' dist-b '), 'dist-b');
	assert.equal(normalizeDistName(''), 'dist');
	assert.equal(normalizeDistName(undefined), 'dist');
	assert.equal(normalizeDistName('../../etc'), 'dist');
	assert.equal(normalizeDistName('dist/../..'), 'dist');
	assert.equal(otherDistName('dist'), 'dist-b');
	assert.equal(otherDistName('dist-b'), 'dist');
	assert.equal(otherDistName('垃圾'), 'dist-b'); // 壞指標當成 dist，所以建到 dist-b，線上那份不會被清掉
	const before = process.env.BLOG_BUILD_DIR;
	process.env.BLOG_BUILD_DIR = 'dist-b';
	assert.equal(buildDistName(), 'dist-b');
	delete process.env.BLOG_BUILD_DIR;
	assert.equal(buildDistName(), 'dist');
	if (before !== undefined) process.env.BLOG_BUILD_DIR = before;
	assert.ok(existsSync(join(REPO_ROOT, 'package.json')), 'REPO_ROOT 指錯地方');
	console.log('dist_dir self-check ok');
}

// 只有直接跑這支才自檢——被 import 時 argv 是別人的，不能拿來當開關
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && process.argv.includes('--check')) check();
