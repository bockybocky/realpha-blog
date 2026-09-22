// 索引範圍規則（2026-09-22 Fable 判決、Charles 拍板）：節目心得頁只擋 Google、不進 sitemap。
// 純函式、零 import：網站端（[slug].astro、sitemap.xml.ts）、astro.config.mjs（經 scripts/notes_index.mjs 讀磁碟）
// 與自檢腳本 scripts/test_indexing.mjs 共用同一套判定，不會各算各的。
//
// 判定依據＝frontmatter 的 kind 欄位，不看 slug 前綴：
//   kind: "podcast-notes"  → 節目收聽心得（自動發文線與手寫的單集心得）→ googlebot noindex、移出 sitemap
//   kind: "weekly-digest"  → 每週節目整理（原創性整理）→ 照常收錄
//   沒寫或 "original"      → 原創文 → 照常收錄
// hreflang 配對的中英兩版要同進退：任一語言版本是心得，兩版都 noindex（一收一不收會讓 Google 忽略整組）。

export const NOTES_KIND = 'podcast-notes';
export const DIGEST_KIND = 'weekly-digest';
export const KINDS = ['original', NOTES_KIND, DIGEST_KIND];

export function isNotesKind(kind) {
	return kind === NOTES_KIND;
}

/**
 * @param {{slug: string, lang: string, kind?: string}[]} posts 兩種語言的文章都要傳進來
 * @returns {Set<string>} 要對 Google 不收錄的 slug（中英兩版共用同一個 slug）
 */
export function noindexSlugs(posts) {
	const out = new Set();
	for (const post of posts) if (isNotesKind(post.kind)) out.add(post.slug);
	return out;
}

/** 部落格文章網址 → slug；不是文章頁回 null（/blog/<slug>/ 與 /en/blog/<slug>/，分頁 /blog/2/ 不算） */
export function blogSlugOfPath(pathname) {
	const m = pathname.match(/^\/(?:en\/)?blog\/([^/]+)\/?$/);
	if (!m || /^\d+$/.test(m[1])) return null;
	return m[1];
}
