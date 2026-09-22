import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectStats, renderDash } from './dash.mjs';

const HOST = '127.0.0.1';
// 線上固定 8377；SERVE_DIST_PORT 只給本機測試用別的埠（刻意不用通用的 PORT，免得環境變數意外改到線上服務）
const PORT = Number(process.env.SERVE_DIST_PORT) || 8377;
const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)), 'dist');
const TEXT = 'text/plain; charset=utf-8';

// ---- 訪問記錄（2026-08-19）----
// 為什麼記在自己這裡而不是掛外部分析：這台伺服器本來就在跑，
// 而且 referer 標頭直接回答「方格子那條線帶回來幾個人」——
// 那正是做完雙向引流之後最需要知道、目前完全看不到的東西。
// 只記頁面請求，不記靜態資源；不設 cookie、不記完整 IP。
const LOG_DIR = resolve(fileURLToPath(new URL('../', import.meta.url)), 'logs');
const SKIP_LOG = /\.(css|js|mjs|png|jpe?g|svg|webp|ico|woff2?|ttf|map|txt|xml|json)$/i;
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|curl|wget|python-requests|node-fetch/i;
const CRAWLER = /OAI-SearchBot|ChatGPT-User|GPTBot|Claude-SearchBot|Claude-User|ClaudeBot|Perplexity-User|PerplexityBot|Google-Extended|GoogleOther|Googlebot|bingbot|Applebot|Amazonbot|YandexBot|meta-externalagent|Bytespider|CCBot/i;

function logVisit(req, status) {
	try {
		const path = (req.url ?? '/').split('?')[0];
		if (SKIP_LOG.test(path)) return;
		const ua = req.headers['user-agent'] ?? '';
		const row = {
			t: new Date().toISOString(),
			p: path,
			ref: req.headers.referer ?? '',
			bot: BOT.test(ua) ? 1 : 0,
			ua: ua.slice(0, 120),
			// ua 只存前 120 字，Googlebot 手機版等名稱在截斷點之後；先從完整 ua 抽出爬蟲名
			crawler: (ua.match(CRAWLER) ?? [''])[0],
			// Cloudflare 隧道帶進來的訪客國別；本機直連時沒有這個標頭
			cc: req.headers['cf-ipcountry'] ?? '',
			s: status,
		};
		const day = row.t.slice(0, 10);
		appendFile(join(LOG_DIR, `visits-${day}.jsonl`), `${JSON.stringify(row)}\n`).catch(() => {});
	} catch {
		// 記錄失敗絕不影響供稿——這條線壞掉只能少一筆資料，不能讓網站掛掉
	}
}

const types = new Map([
	['.html', 'text/html; charset=utf-8'],
	['.css', 'text/css; charset=utf-8'],
	['.js', 'text/javascript; charset=utf-8'],
	['.mjs', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.xml', 'application/xml; charset=utf-8'],
	['.svg', 'image/svg+xml'],
	['.txt', TEXT],
	['.md', TEXT],
	['.png', 'image/png'],
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.webp', 'image/webp'],
	['.ico', 'image/x-icon'],
	['.woff', 'font/woff'],
	['.woff2', 'font/woff2'],
	['.mp3', 'audio/mpeg'],
	['.webmanifest', 'application/manifest+json'],
]);

// 2026-09-15 PWA：sw.js 一定要每次回原站確認，否則 Cloudflare／瀏覽器沿用舊版，新版網站永遠裝不上去。
// 其他檔案照舊不送 cache-control（維持原本行為）。
export function cacheControl(pathname) {
	return pathname === '/sw.js' ? 'no-cache' : null;
}

// 2026-09-15 有聲文章：podcast App 與 iOS Safari 播音檔會送 Range，只回 200 整檔會拖不動或直接拒播。
// 回傳 {start,end}（含 end）；沒送或看不懂 → null（照舊回整檔）；範圍超出 → 'invalid'（416）。
// 只支援單一範圍；多段範圍（bytes=0-1,5-9）當作看不懂、回整檔，規格允許。
export function parseRange(header, size) {
	if (!header) return null;
	const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
	if (!m || (m[1] === '' && m[2] === '')) return null;
	let start;
	let end;
	if (m[1] === '') {
		const suffix = Number(m[2]);
		if (suffix === 0) return 'invalid';
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = Number(m[1]);
		end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
	}
	if (start >= size || start > end) return 'invalid';
	return { start, end };
}

function contentType(pathname) {
	if (/^\/llms.*\.txt$/i.test(pathname) || extname(pathname).toLowerCase() === '.md') {
		return TEXT;
	}
	return types.get(extname(pathname).toLowerCase()) ?? 'application/octet-stream';
}

function localPath(pathname) {
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (decoded.includes('\0')) return null;

	const relative = normalize(decoded.replace(/\\/g, '/').replace(/^\/+/, ''));
	const target = resolve(ROOT, relative);
	const rootPrefix = ROOT.endsWith(sep) ? ROOT : `${ROOT}${sep}`;
	return target === ROOT || target.startsWith(rootPrefix) ? target : null;
}

async function fileEntry(pathname) {
	const target = localPath(pathname);
	if (!target) return null;

	const info = await stat(target).catch(() => null);
	if (info?.isFile()) return { path: target, typePath: pathname, size: info.size };
	if (!info?.isDirectory()) return null;

	const index = join(target, 'index.html');
	const indexInfo = await stat(index).catch(() => null);
	return indexInfo?.isFile() ? { path: index, typePath: '/index.html', size: indexInfo.size } : null;
}

async function sendFallback(req, res) {
	const fallback = join(ROOT, '404.html');
	const info = await stat(fallback).catch(() => null);
	if (info?.isFile()) {
		res.writeHead(404, { 'content-type': contentType('/404.html') });
		if (req.method === 'HEAD') res.end();
		else createReadStream(fallback).pipe(res);
		return;
	}

	res.writeHead(404, { 'content-type': TEXT });
	res.end(req.method === 'HEAD' ? undefined : '404 Not Found\n');
}

async function handle(req, res) {
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.writeHead(405, { allow: 'GET, HEAD', 'content-type': TEXT });
		res.end('Method Not Allowed\n');
		return;
	}

	const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

	// 私人儀表板。不進 dist、不進網站地圖，外面只靠 Cloudflare Access 擋。
	if (url.pathname === '/_dash' || url.pathname === '/_dash/') {
		const days = Number(url.searchParams.get('days')) || 14;
		const stats = await collectStats(LOG_DIR, Math.min(90, Math.max(1, days)));
		res.writeHead(200, {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'no-store',
			'x-robots-tag': 'noindex, nofollow',
		});
		res.end(req.method === 'HEAD' ? undefined : renderDash(stats));
		return;
	}

	const entry = await fileEntry(url.pathname);
	if (!entry) {
		logVisit(req, 404);
		await sendFallback(req, res);
		return;
	}

	const type = contentType(entry.typePath);
	const range = parseRange(req.headers.range, entry.size);
	if (range === 'invalid') {
		logVisit(req, 416);
		res.writeHead(416, { 'content-range': `bytes */${entry.size}`, 'accept-ranges': 'bytes' });
		res.end();
		return;
	}
	if (range) {
		logVisit(req, 206);
		res.writeHead(206, {
			'content-type': type,
			'accept-ranges': 'bytes',
			'content-range': `bytes ${range.start}-${range.end}/${entry.size}`,
			'content-length': range.end - range.start + 1,
		});
		if (req.method === 'HEAD') res.end();
		else createReadStream(entry.path, range).on('error', () => res.destroy()).pipe(res);
		return;
	}

	logVisit(req, 200);
	const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': entry.size };
	const cc = cacheControl(url.pathname);
	if (cc) headers['cache-control'] = cc;
	res.writeHead(200, headers);
	if (req.method === 'HEAD') res.end();
	else createReadStream(entry.path).on('error', () => res.destroy()).pipe(res);
}

function check() {
	assert.equal(contentType('/llms.txt'), TEXT);
	assert.equal(contentType('/llms-full.txt'), TEXT);
	assert.equal(contentType('/blog/research.md'), TEXT);
	assert.equal(contentType('/sitemap-index.xml'), 'application/xml; charset=utf-8');
	assert.equal(contentType('/asset.svg'), 'image/svg+xml');
	assert.ok(localPath('/en/')?.startsWith(ROOT));
	assert.equal(localPath('/..%2fpackage.json'), null);
	assert.equal(contentType('/audio/a.mp3'), 'audio/mpeg');
	assert.equal(parseRange(undefined, 100), null);
	assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
	assert.deepEqual(parseRange('bytes=0-1', 1000), { start: 0, end: 1 });
	assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
	assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
	assert.deepEqual(parseRange('bytes=-5000', 1000), { start: 0, end: 999 });
	assert.deepEqual(parseRange('bytes=990-5000', 1000), { start: 990, end: 999 });
	assert.equal(parseRange('bytes=1000-', 1000), 'invalid');
	assert.equal(parseRange('bytes=5-3', 1000), 'invalid');
	assert.equal(parseRange('bytes=-0', 1000), 'invalid');
	assert.equal(parseRange('bytes=0-1,5-9', 1000), null);
	assert.equal(parseRange('items=0-1', 1000), null);
	assert.equal(contentType('/manifest.webmanifest'), 'application/manifest+json');
	assert.equal(contentType('/sw.js'), 'text/javascript; charset=utf-8');
	assert.equal(cacheControl('/sw.js'), 'no-cache');
	assert.equal(cacheControl('/copy-code.js'), null);
	assert.equal(cacheControl('/blog/x/'), null);
	console.log('serve_dist self-check ok');
}

if (process.argv.includes('--check')) {
	check();
} else {
	const server = createServer((req, res) => {
		handle(req, res).catch(() => sendFallback(req, res));
	});

	server.on('error', (error) => {
		if (error.code === 'EADDRINUSE') {
			console.error(`${HOST}:${PORT} is already in use`);
			process.exit(1);
		}
		console.error(error.message);
		process.exit(1);
	});

	// 記錄目錄不存在的話，每一筆 appendFile 都會靜默失敗——開機時先建好
	await mkdir(LOG_DIR, { recursive: true });

	server.listen(PORT, HOST, () => {
		console.log(`Serving ${ROOT} at http://${HOST}:${PORT}/`);
		console.log(`Visit log: ${LOG_DIR}`);
	});
}
