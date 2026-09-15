// 文章頁的附加資訊：閱讀時間、節目系列前綴、延伸閱讀排序、封面 alt。
// 全部是純函式（不 import astro），好讓 scripts/test_article_extras.mjs 直接用 node 跑。

type Lang = 'zh-TW' | 'en';

const HAN = /\p{Script=Han}/gu;
const WORD = /[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*/g;

/** 去掉讀者不會「讀」的部分：程式碼區塊、import/export、圖片、標籤、網址 */
function readableText(body: string) {
	return body
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/^\s*(import|export)\s.*$/gm, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/https?:\/\/\S+/g, ' ');
}

/** 中文：漢字數＋夾雜的英文單字數 ÷ 500；英文：單字數 ÷ 220。四捨五入，最少 1 分鐘。 */
export function readingMinutes(body: string, lang: Lang): number {
	const text = readableText(body ?? '');
	if (lang === 'zh-TW') {
		const han = (text.match(HAN) ?? []).length;
		const words = (text.replace(HAN, ' ').match(WORD) ?? []).length;
		return Math.max(1, Math.round((han + words) / 500));
	}
	return Math.max(1, Math.round((text.match(WORD) ?? []).length / 220));
}

/** 節目系列＝slug 第一個「-」之前的字（沒有「-」就是整個 slug） */
export function seriesPrefix(slug: string) {
	const i = slug.indexOf('-');
	return i === -1 ? slug : slug.slice(0, i);
}

type RelatedCandidate = {
	data: { slug: string; tags: string[]; category: string; pubDate: Date; draft?: boolean };
};

const newestFirst = (a: RelatedCandidate, b: RelatedCandidate) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

/**
 * 延伸閱讀：① 同節目系列（新到舊）→ ② 共同 tag 數多到少（同分新到舊）→ ③ 同分類最新。
 * 排除自己與 draft。呼叫端負責只傳同語言的文章。
 */
export function relatedPosts<T extends RelatedCandidate>(current: T, all: T[], limit = 6, knownSeries?: Set<string>): T[] {
	const others = all.filter((p) => p.data.slug !== current.data.slug && !p.data.draft).sort(newestFirst);
	const picked: T[] = [];
	const add = (p: T) => {
		if (picked.length < limit && !picked.includes(p)) picked.push(p);
	};
	const prefix = seriesPrefix(current.data.slug);
	// 有給節目清單時，只有清單內的前綴才算同系列（避免 ai-、my- 這種通用前綴把不相干的文章湊成一組）
	if (!knownSeries || knownSeries.has(prefix)) others.filter((p) => seriesPrefix(p.data.slug) === prefix).forEach(add);
	const tags = new Set(current.data.tags);
	others
		.map((p) => ({ p, shared: p.data.tags.filter((t) => tags.has(t)).length }))
		.filter((x) => x.shared > 0)
		.sort((a, b) => b.shared - a.shared || newestFirst(a.p, b.p))
		.forEach((x) => add(x.p));
	others.filter((p) => p.data.category === current.data.category).forEach(add);
	return picked;
}

/** 內文裡如果已經有 `![alt](cover)`，沿用那段 alt（通常比標題更能描述畫面） */
export function coverAlt(body: string, cover: string, fallback: string) {
	const escaped = cover.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const m = (body ?? '').match(new RegExp(`!\\[([^\\]]+)\\]\\(\\s*<?${escaped}`));
	return m ? m[1].trim() : fallback;
}
