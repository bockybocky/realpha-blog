// 索引範圍自檢（2026-09-22）：node scripts/test_indexing.mjs
// 1) 判定函式：心得 frontmatter → noindex；原創、週報 → 收錄；中英同進退
// 2) 磁碟現況：每組中英兩版 kind 一致；列出「slug 前綴是節目、但沒標 kind」的可疑文章（只警告）
// 3) dist 已建置時：抽查 noindex meta 與 sitemap 內容
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { blogSlugOfPath, isNotesKind, noindexSlugs } from '../src/lib/indexing.mjs';
import { readBlogMeta, readFrontmatter } from './notes_index.mjs';

const notesMdx = `---\ntitle: "Acquired｜家得寶"\nslug: "acquired-2026-09-13-home-depot"\nlang: "zh-TW"\ncategory: "investing"\nkind: "podcast-notes"\n---\n內文`;
const originalMdx = `---\ntitle: "合約負債"\nslug: "contract-liability-future-revenue"\nlang: "zh-TW"\ncategory: "investing"\n---\n內文`;
const digestMdx = `---\ntitle: "節目筆記週報"\nslug: "weekly-digest-2026-09-07"\nlang: "en"\nkind: "weekly-digest"\n---\n`;

const n = readFrontmatter(notesMdx);
const o = readFrontmatter(originalMdx);
const d = readFrontmatter(digestMdx);
assert.equal(isNotesKind(n.kind), true, '心得要判成 notes');
assert.equal(isNotesKind(o.kind), false, '原創不能判成 notes');
assert.equal(isNotesKind(d.kind), false, '週報不能判成 notes');
const set = noindexSlugs([n, o, d]);
assert.deepEqual([...set], ['acquired-2026-09-13-home-depot']);
// 中英同進退：只有英文版標了心得，中文版也要被擋
const pair = noindexSlugs([{ slug: 'x', lang: 'zh-TW' }, { slug: 'x', lang: 'en', kind: 'podcast-notes' }]);
assert.equal(pair.has('x'), true, '任一語言版是心得，整組 noindex');
assert.equal(blogSlugOfPath('/blog/abc/'), 'abc');
assert.equal(blogSlugOfPath('/en/blog/abc/'), 'abc');
assert.equal(blogSlugOfPath('/blog/2/'), null, '分頁不是文章');
assert.equal(blogSlugOfPath('/topics/growth/'), null);
console.log('判定函式：通過（心得→noindex、原創→收錄、週報→收錄、中英同進退、網址解析）');

const meta = readBlogMeta();
const bySlug = new Map();
for (const m of meta) {
	if (!bySlug.has(m.slug)) bySlug.set(m.slug, []);
	bySlug.get(m.slug).push(m);
}
const mismatched = [...bySlug].filter(([, list]) => new Set(list.map((m) => m.kind ?? 'original')).size > 1).map(([s]) => s);
assert.deepEqual(mismatched, [], `中英兩版 kind 不一致：${mismatched.join(', ')}`);
const topics = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/topics.json', import.meta.url)), 'utf8'));
const seriesIds = new Set(topics.series.map((s) => s.id));
const suspicious = [...bySlug.keys()].filter((s) => seriesIds.has(s.split('-')[0]) && !noindexSlugs(bySlug.get(s)).has(s));
const notes = [...bySlug.keys()].filter((s) => noindexSlugs(bySlug.get(s)).has(s));
console.log(`磁碟：${bySlug.size} 組文章，心得 ${notes.length} 組，其餘 ${bySlug.size - notes.length} 組照常收錄；中英 kind 一致`);
if (suspicious.length) console.log(`提醒（不擋）：slug 前綴是節目但沒標 podcast-notes，請人工確認是否原創：${suspicious.join(', ')}`);

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (existsSync(dist + 'sitemap.xml')) {
	const page = (p) => readFileSync(dist + p + 'index.html', 'utf8');
	const gb = /<meta name="googlebot" content="noindex"/;
	assert.ok(gb.test(page('blog/acquired-2026-09-13-home-depot/')), 'dist 中文心得頁缺 googlebot noindex');
	assert.ok(gb.test(page('en/blog/acquired-2026-09-13-home-depot/')), 'dist 英文心得頁缺 googlebot noindex');
	assert.ok(!gb.test(page('blog/contract-liability-future-revenue/')), 'dist 原創文不該有 noindex');
	assert.ok(!/name="robots" content="noindex"/.test(page('blog/contract-liability-future-revenue/')), 'dist 原創文不該有 robots noindex');
	console.log('dist 抽查：心得中英兩版有 googlebot noindex，原創文沒有');
	for (const f of ['sitemap.xml', 'sitemap-0.xml']) {
		const xml = readFileSync(dist + f, 'utf8');
		const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
		const bad = locs.filter((p) => notes.includes(blogSlugOfPath(p)));
		assert.deepEqual(bad, [], `${f} 還有心得頁`);
		console.log(`dist/${f}：${locs.length} 個網址，心得頁 0`);
	}
}
console.log('test_indexing: 全部通過');
