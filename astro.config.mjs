// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeTakeawayNote from './src/lib/rehype-takeaway-note.mjs';
import rehypeInArticleAds from './src/lib/rehype-in-article-ads.mjs';
import { blogSlugOfPath } from './src/lib/indexing.mjs';
import { noindexSlugsFromDisk } from './scripts/notes_index.mjs';
import { buildDistName } from './scripts/dist_dir.mjs';

const notesSlugs = noindexSlugsFromDisk();

function rehypeCopyCode() {
	// 按鈕放在不捲動的 wrapper 上（不是 pre 內），程式碼再寬、內部怎麼捲，按鈕都固定右上
	return (tree) => {
		function walk(node, parent) {
			if (!node || typeof node !== 'object') return;
			if (
				node.type === 'element' &&
				node.tagName === 'pre' &&
				parent &&
				!(parent.type === 'element' && Array.isArray(parent.properties?.className) && parent.properties.className.includes('code-wrap'))
			) {
				node.properties ??= {};
				const className = Array.isArray(node.properties.className) ? node.properties.className : [];
				node.properties.className = [...new Set([...className, 'code-block'])];
				const wrapper = {
					type: 'element',
					tagName: 'div',
					properties: { className: ['code-wrap'] },
					children: [
						{
							type: 'element',
							tagName: 'button',
							properties: {
								type: 'button',
								className: ['copy-code'],
								'data-copy-code': '',
								'aria-label': 'Copy code',
							},
							children: [{ type: 'text', value: 'Copy' }],
						},
						node,
					],
				};
				const idx = parent.children.indexOf(node);
				if (idx !== -1) parent.children[idx] = wrapper;
				return; // 不再往 wrapper 裡走
			}
			if (Array.isArray(node.children)) [...node.children].forEach((child) => walk(child, node));
		}
		walk(tree, null);
	};
}

// 2026-09-15 改版後舊網址轉址（Charles 手機存的 /ledger/ 撞 404 → 回報「部落格打不開」）：
// 驗證簿三頁拿掉、五類併成三類、節目頁拿掉。舊網址一律轉到最接近的新頁，不讓人撞錯誤頁。
const oldTopic = { mindset: 'growth', 'ai-tools': 'learning', lab: 'learning', 'ai-supply-chain': 'markets', macro: 'markets' };
const seriesIds = JSON.parse(readFileSync(new URL('./src/data/topics.json', import.meta.url), 'utf8')).series.map((s) => s.id);
const redirects = {
	'/ledger': '/',
	'/propose': '/',
	'/methodology': '/',
	'/en/methodology': '/en/',
	'/series': '/blog/',
	'/en/series': '/en/blog/',
};
for (const [from, to] of Object.entries(oldTopic)) {
	redirects[`/topics/${from}`] = `/topics/${to}/`;
	redirects[`/en/topics/${from}`] = `/en/topics/${to}/`;
}
for (const id of seriesIds) {
	redirects[`/series/${id}`] = '/blog/';
	redirects[`/en/series/${id}`] = '/en/blog/';
}

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.getrealpha.com',
	// 2026-09-23 零停機建置：建到沒在服務的那個資料夾（由 scripts/build_swap.mjs 設 BLOG_BUILD_DIR）；
	// 沒設就是 dist，維持單獨跑 astro build 的舊行為。
	outDir: `./${buildDistName()}`,
	// 離線頁是 service worker 的備用頁，不給搜尋引擎（2026-09-15 PWA）
	// 節目心得頁不進 sitemap-index／sitemap-0（2026-09-22 索引範圍）；判定讀 frontmatter kind，規則在 src/lib/indexing.mjs
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => {
				const pathname = new URL(page).pathname;
				if (/\/offline\/$/.test(pathname)) return false;
				const slug = blogSlugOfPath(pathname);
				return !(slug && notesSlugs.has(slug));
			},
		}),
	],
	redirects,
	i18n: {
		defaultLocale: 'zh-TW',
		locales: ['zh-TW', 'en'],
		routing: {
			prefixDefaultLocale: false,
		},
	},
	markdown: {
		syntaxHighlight: 'shiki',
		shikiConfig: {
			theme: 'github-dark',
			wrap: false,
		},
		processor: unified({ rehypePlugins: [rehypeCopyCode, rehypeTakeawayNote, rehypeInArticleAds] }),
	},
});
