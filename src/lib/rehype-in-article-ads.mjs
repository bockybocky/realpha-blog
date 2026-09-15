// 建置期在文章內文的 h2 前面插「文章內嵌廣告」佔位（照楓羽擺法：每個段落標題前一個）。不改 mdx。
// 設定讀 src/data/ads.json：enabled、client、slots.inArticle、inArticleEvery（每幾個 h2 插一個）、inArticleSkipFirst。
// 規則：
//   - 只看內文最上層的 h2（目錄、TL;DR 面板是頁面層產生的，本來就不在 MDX 樹裡；巢狀在元件／aside／腳註裡的也不算）
//   - 「帶得走的一件事」便利貼（section.takeaway-note）裡面不插，那個標題前面也不插
//   - inArticleSkipFirst 為 true 時第一個 h2 前不插（開場已有多媒體廣告）；其餘依 inArticleEvery 抽樣
//   - frontmatter.category 為 lab 的文章完全不插
//   - enabled 不是 true、client 或 slots.inArticle 空 → 什麼都不插
// 每個廣告的 push 由頁面尾端一段 AdPush 統一做，這裡只放 <ins>。
// 自檢：node scripts/test_rehype_in_article_ads.mjs
import { readFileSync } from 'node:fs';
import { isTakeawayHeading } from './rehype-takeaway-note.mjs';

// 三種廣告單元的 <ins> 屬性（HTML 屬性名）。AdSlot.astro 也讀這張表，兩邊輸出保持一致。
const ATTRS = {
	display: { style: 'display:block', 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' },
	inArticle: { style: 'display:block; text-align:center;', 'data-ad-layout': 'in-article', 'data-ad-format': 'fluid' },
	multiplex: { style: 'display:block', 'data-ad-format': 'autorelaxed' },
};

export function adAttrs(type) {
	return { ...ATTRS[type] };
}

export const adLabel = (locale) => (locale === 'en' ? 'Ad' : '廣告');

const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function inArticleNode(client, slotId, locale) {
	const props = { className: ['adsbygoogle'], dataAdClient: client, dataAdSlot: slotId };
	for (const [k, v] of Object.entries(ATTRS.inArticle)) props[camel(k)] = v;
	const label = adLabel(locale);
	return {
		type: 'element',
		tagName: 'aside',
		properties: { className: ['ad-slot', 'ad-slot-inArticle'], ariaLabel: label, dataPagefindIgnore: true },
		children: [
			{ type: 'element', tagName: 'p', properties: { className: ['ad-label'] }, children: [{ type: 'text', value: label }] },
			{ type: 'element', tagName: 'ins', properties: props, children: [] },
		],
	};
}

function textOf(node) {
	if (!node) return '';
	if (node.type === 'text') return node.value;
	return Array.isArray(node.children) ? node.children.map(textOf).join('') : '';
}

const isEl = (node, name) => node?.type === 'element' && node.tagName === name;
const isAd = (node) => isEl(node, 'aside') && Array.isArray(node.properties?.className) && node.properties.className.includes('ad-slot-inArticle');

function readConfig() {
	return JSON.parse(readFileSync(new URL('../data/ads.json', import.meta.url), 'utf8'));
}

function localeOf(file) {
	const lang = file?.data?.astro?.frontmatter?.lang;
	if (lang === 'en' || lang === 'zh-TW') return lang;
	return /\.en\.mdx?$/.test(String(file?.path ?? '')) ? 'en' : 'zh-TW';
}

export default function rehypeInArticleAds(options = {}) {
	const cfg = options.config ?? readConfig();
	const client = String(cfg?.client ?? '').trim();
	const slotId = String(cfg?.slots?.inArticle ?? '').trim();
	const on = cfg?.enabled === true && client !== '' && slotId !== '';
	const every = Number.isInteger(cfg?.inArticleEvery) && cfg.inArticleEvery >= 1 ? cfg.inArticleEvery : 1;
	const skipFirst = cfg?.inArticleSkipFirst !== false;

	return (tree, file) => {
		if (!on || !Array.isArray(tree?.children)) return;
		if (file?.data?.astro?.frontmatter?.category === 'lab') return;
		const kids = tree.children;
		const heads = kids.filter((n) => isEl(n, 'h2') && !isTakeawayHeading(textOf(n)));
		const picked = (skipFirst ? heads.slice(1) : heads).filter((_, i) => i % every === 0);
		const locale = localeOf(file);
		for (const h of picked) {
			const i = kids.indexOf(h);
			let prev = i - 1;
			while (prev >= 0 && kids[prev].type === 'text' && !kids[prev].value.trim()) prev--;
			if (isAd(kids[prev])) continue; // 已插過（冪等）
			kids.splice(i, 0, inArticleNode(client, slotId, locale));
		}
	};
}
