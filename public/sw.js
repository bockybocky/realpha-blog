/*
 * Realpha service worker（2026-09-15）
 *
 * 快取策略（改這支檔要改 VERSION，新版啟用時會刪掉舊版快取）：
 * 1. 頁面導覽（HTML）：先網路、失敗才用快取。網站每天發新文章，不能讓人看到舊首頁。
 *    - 成功載入的文章頁（/blog/<slug>/、/en/blog/<slug>/）存進「讀過的文章」快取，最多 60 篇，超過刪最舊。
 *    - 其他頁面（首頁、主題頁…）存進「頁面」快取，最多 20 頁，只在沒網路時拿出來用。
 *    - 沒網路又沒快取：回離線頁（/offline/ 或 /en/offline/），列出讀過的文章。
 * 2. 同網域靜態檔（/_astro/ 的 css/js/字型、/icons/、/brand/、/pagefind/、favicon）：先快取、背景更新（stale-while-revalidate）。
 *    /covers/、/figures/ 圖片同樣策略，但放另一個快取、最多 150 張（封面一張數百 KB，不設上限會吃爆手機空間）。
 * 3. 不碰（直接交給瀏覽器、不快取）：
 *    - 跨網域請求（Google Fonts、AdSense、giscus、Substack 內嵌）
 *    - /audio/ 的 mp3 與任何帶 Range 標頭的請求（拖曳播放由瀏覽器自己處理）
 *    - /_dash、GET 以外的請求、其他沒列到的路徑
 */
const VERSION = 'v1';
const PREFIX = 'realpha-';
const CACHE = {
	shell: `${PREFIX}shell-${VERSION}`,
	articles: `${PREFIX}articles-${VERSION}`,
	pages: `${PREFIX}pages-${VERSION}`,
	static: `${PREFIX}static-${VERSION}`,
	media: `${PREFIX}media-${VERSION}`,
};
const LIMIT = { articles: 60, pages: 20, media: 150 };
const OFFLINE = { zh: '/offline/', en: '/en/offline/' };
const SHELL = [
	OFFLINE.zh,
	OFFLINE.en,
	'/manifest.webmanifest',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
	'/favicon.svg',
	'/brand/logo-lockup-lighttheme.svg',
	'/brand/logo-lockup.svg',
];

const ARTICLE = /^\/(en\/)?blog\/[^/]+\/$/;
const STATIC = /^\/(_astro|icons|brand|pagefind)\/|^\/(favicon[^/]*|apple-touch-icon\.png|copy-code\.js|manifest\.webmanifest)$/;
const MEDIA = /^\/(covers|figures)\//;

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE.shell);
			await cache.addAll(SHELL);
			// 離線頁本身引用的 css/js（檔名帶雜湊，每次建置不同）一起存，否則沒網路時離線頁會沒有樣式
			const assets = new Set();
			for (const page of [OFFLINE.zh, OFFLINE.en]) {
				const res = await cache.match(page);
				const html = res ? await res.text() : '';
				for (const m of html.matchAll(/(?:href|src)="(\/_astro\/[^"]+)"/g)) assets.add(m[1]);
			}
			if (assets.size) await cache.addAll([...assets]);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const current = new Set(Object.values(CACHE));
			const names = await caches.keys();
			// 讀過的文章是讀者的資料：換版時先搬進新版快取再刪舊版
			for (const name of names) {
				if (name.startsWith(`${PREFIX}articles-`) && !current.has(name)) {
					const oldCache = await caches.open(name);
					const newCache = await caches.open(CACHE.articles);
					for (const req of await oldCache.keys()) {
						const res = await oldCache.match(req);
						if (res && !(await newCache.match(req))) await newCache.put(req, res);
					}
				}
			}
			await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !current.has(n)).map((n) => caches.delete(n)));
			await trim(CACHE.articles, LIMIT.articles);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	if (request.headers.has('range')) return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	const path = url.pathname;
	if (path.startsWith('/audio/') || path.startsWith('/_dash') || path === '/sw.js') return;

	if (request.mode === 'navigate') {
		event.respondWith(navigate(event, request, path));
		return;
	}
	if (STATIC.test(path)) {
		event.respondWith(staleWhileRevalidate(event, request, CACHE.static));
		return;
	}
	if (MEDIA.test(path)) {
		event.respondWith(staleWhileRevalidate(event, request, CACHE.media, LIMIT.media));
	}
});

async function navigate(event, request, path) {
	try {
		const res = await fetch(request);
		if (res.ok && res.type === 'basic' && (res.headers.get('content-type') || '').includes('text/html')) {
			const isArticle = ARTICLE.test(path);
			const name = isArticle ? CACHE.articles : CACHE.pages;
			const key = new URL(path, self.location.origin).href; // 不含 ?query，同一篇只存一份
			const copy = res.clone();
			event.waitUntil(
				(async () => {
					const cache = await caches.open(name);
					await cache.delete(key); // 先刪再放：重讀的文章移到最新，trim 時不會被當成最舊的刪掉
					await cache.put(key, copy);
					await trim(name, isArticle ? LIMIT.articles : LIMIT.pages);
				})(),
			);
		}
		return res;
	} catch {
		const key = new URL(path, self.location.origin).href;
		const cached = (await caches.match(key)) || (await caches.match(request));
		if (cached) return cached;
		const offline = await caches.match(path.startsWith('/en/') ? OFFLINE.en : OFFLINE.zh, { cacheName: CACHE.shell });
		return offline || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
	}
}

async function staleWhileRevalidate(event, request, name, limit) {
	const cache = await caches.open(name);
	const cached = await cache.match(request);
	const network = fetch(request)
		.then(async (res) => {
			if (res.ok && res.type === 'basic') {
				await cache.put(request, res.clone());
				if (limit) await trim(name, limit);
			}
			return res;
		})
		.catch(() => undefined);
	if (cached) {
		event.waitUntil(network);
		return cached;
	}
	const res = await network;
	return res || (await caches.match(request)) || Response.error();
}

// Cache Storage 的 keys() 依放入順序排列，最前面就是最舊的
async function trim(name, max) {
	const cache = await caches.open(name);
	const keys = await cache.keys();
	for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}
