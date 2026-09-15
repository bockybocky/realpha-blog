// 主題與節目系列的分類規則（純函式、零 import）。
// 刻意不 import 任何東西：scripts/check_taxonomy.mjs 直接用 node 載入本檔跑自檢，
// 網站端（src/lib/catalog.ts）與自檢共用同一套規則，不會各算各的。

export type Lang = 'zh-TW' | 'en';

export type TopicDef = {
	id: string;
	name: Record<Lang, string>;
	nav: Record<Lang, string>;
	tagline: Record<Lang, string>;
	categories: string[];
	keywords: string[];
};

export type SeriesDef = { id: string; name: Record<Lang, string> };

export type PostMeta = {
	slug: string;
	lang: string;
	title: string;
	category: string;
	tags: string[];
};

/** 比對前的正規化：小寫、去掉所有空白（「AI 資本支出」與「ai資本支出」視為同一個詞） */
export function norm(value: string): string {
	return value.toLowerCase().replace(/\s+/g, '');
}

/**
 * 一篇只歸一個主題：
 * 1. category 命中某主題的 categories（tech/systems/lab→learning）直接歸該主題
 * 2. 否則 tags（完全相等）與標題（包含）對各主題關鍵字計分，最高分者勝；同分取 topics 排前面的
 * 3. 零分歸 defaultTopic
 */
export function classifyTopic(post: PostMeta, topics: TopicDef[], defaultTopic: string): string {
	for (const topic of topics) {
		if (topic.categories.includes(post.category)) return topic.id;
	}
	const tags = new Set(post.tags.map(norm));
	const title = norm(post.title);
	let best = defaultTopic;
	let bestScore = 0;
	for (const topic of topics) {
		let score = 0;
		for (const keyword of new Set(topic.keywords.map(norm))) {
			if (!keyword) continue;
			if (tags.has(keyword)) score += 1;
			if (title.includes(keyword)) score += 1;
		}
		if (score > bestScore) {
			best = topic.id;
			bestScore = score;
		}
	}
	return best;
}

/**
 * 同一個 slug 的中英兩版要落在同一個主題：先分繁中版，英文版沿用繁中版的結果；
 * 沒有繁中對應的英文文章才用自己的標題與 tags 分。
 * 回傳 key = `${lang}:${slug}`。
 */
export function buildTopicMap(posts: PostMeta[], topics: TopicDef[], defaultTopic: string): Map<string, string> {
	const zhBySlug = new Map<string, string>();
	for (const post of posts) {
		if (post.lang === 'zh-TW') zhBySlug.set(post.slug, classifyTopic(post, topics, defaultTopic));
	}
	const out = new Map<string, string>();
	for (const post of posts) {
		const topic = zhBySlug.get(post.slug) ?? classifyTopic(post, topics, defaultTopic);
		out.set(`${post.lang}:${post.slug}`, topic);
	}
	return out;
}

/** 節目系列＝slug 第一個「-」之前的前綴，且要在 series 清單內 */
export function seriesIdOf(slug: string, series: SeriesDef[]): string | null {
	const prefix = slug.split('-')[0];
	return series.some((s) => s.id === prefix) ? prefix : null;
}
