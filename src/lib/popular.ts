// 熱門文章資料（src/data/popular.json 由另一條線產生）。
// 用 fs 讀而不是 import：檔案不存在、空檔或壞 JSON 都只回空陣列，build 不會因此失敗。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PopularRow = { slug: string; lang: string; views: number };

/** 每篇累計真人瀏覽數（src/data/views.json，鍵為 `lang:slug`，由 build_popular.mjs 產生；缺檔回 0） */
let viewsCache: Record<string, number> | null = null;
export function viewsOf(lang: string, slug: string): number {
	if (viewsCache === null) {
		try {
			const parsed = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'views.json'), 'utf8'));
			viewsCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
		} catch {
			viewsCache = {};
		}
	}
	const n = Number(viewsCache![`${lang}:${slug}`]);
	return Number.isFinite(n) && n > 0 ? n : 0;
}

export function readPopular(): PopularRow[] {
	try {
		const raw = readFileSync(join(process.cwd(), 'src', 'data', 'popular.json'), 'utf8');
		const rows = JSON.parse(raw);
		if (!Array.isArray(rows)) return [];
		return rows.filter((r) => r && typeof r.slug === 'string' && typeof r.lang === 'string' && Number.isFinite(Number(r.views)));
	} catch {
		return [];
	}
}
