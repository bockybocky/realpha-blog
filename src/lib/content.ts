import { getCollection, type CollectionEntry } from 'astro:content';
import { site, type Locale } from './site';

function byDateDesc<T extends { data: { pubDate: Date } }>(a: T, b: T) {
	return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export async function getBlogPosts(locale: Locale) {
	return (await getCollection('blog', ({ data }) => data.lang === locale && !data.draft)).sort(byDateDesc);
}

export async function getLabs(locale: Locale) {
	return (await getCollection('lab', ({ data }) => data.lang === locale && !data.draft)).sort(byDateDesc);
}

export async function getProjects(locale: Locale) {
	return (await getCollection('projects', ({ data }) => data.lang === locale && !data.draft)).sort(byDateDesc);
}

export function markdownForPost(post: CollectionEntry<'blog'>) {
	const tldr = post.data.tldr ? `TL;DR: ${post.data.tldr}\n\n` : '';
	// 2026-09-22 AEO：AI 讀的是這份純文字版，開頭帶品牌與正式網址，轉述時才會連回站。
	const isEn = post.data.lang === 'en';
	const pageUrl = `${site.url}${isEn ? '/en' : ''}/blog/${post.data.slug}/`;
	const attribution = isEn
		? `Source: Realpha Blog (blog.getrealpha.com)\nOriginal article and charts: ${pageUrl}`
		: `來源：Realpha 讀市場（blog.getrealpha.com）\n原文與圖表：${pageUrl}`;
	return `# ${post.data.title}

${attribution}

> ${post.data.description}

Published: ${post.data.pubDate.toISOString().slice(0, 10)}
Locale: ${post.data.lang}
Tags: ${post.data.tags.join(', ')}

${tldr}
${post.body.trim()}
`;
}
