// 自檢：node scripts/test_article_extras.mjs（Node 22.18+／24 內建 TypeScript 型別剝除）
import assert from 'node:assert/strict';
import { coverAlt, readingMinutes, relatedPosts, seriesPrefix } from '../src/lib/article-extras.ts';

// 閱讀時間
assert.equal(readingMinutes('短', 'zh-TW'), 1, '最少 1 分鐘');
assert.equal(readingMinutes('字'.repeat(1000), 'zh-TW'), 2);
assert.equal(readingMinutes('字'.repeat(1249), 'zh-TW'), 2, '2.498 四捨五入為 2');
assert.equal(readingMinutes('字'.repeat(1250), 'zh-TW'), 3, '2.5 四捨五入為 3');
assert.equal(readingMinutes('字'.repeat(500) + '\n```\n' + '碼'.repeat(5000) + '\n```\n', 'zh-TW'), 1, '程式碼區塊不算');
assert.equal(readingMinutes('import X from "y";\n' + 'word '.repeat(440), 'en'), 2);
assert.equal(readingMinutes('![很長的圖說'.padEnd(2000, '圖') + '](/a.png)', 'zh-TW'), 1, '圖片 alt 不算');

// 系列前綴
assert.equal(seriesPrefix('gooaye-ep681'), 'gooaye');
assert.equal(seriesPrefix('standalone'), 'standalone');

// 延伸閱讀
const d = (s) => new Date(s);
const mk = (slug, tags, category, date, draft = false) => ({ data: { slug, tags, category, pubDate: d(date), draft } });
const cur = mk('show-3', ['a', 'b'], 'tech', '2026-09-03');
const all = [
	cur,
	mk('show-1', [], 'tech', '2026-09-01'),
	mk('show-2', [], 'tech', '2026-09-02'),
	mk('show-draft', ['a', 'b'], 'tech', '2026-09-09', true),
	mk('x-two', ['a', 'b'], 'investing', '2026-08-01'),
	mk('x-one-new', ['a'], 'investing', '2026-08-20'),
	mk('x-one-old', ['b'], 'investing', '2026-08-10'),
	mk('x-cat', [], 'tech', '2026-07-01'),
	mk('x-cat2', [], 'tech', '2026-06-01'),
	mk('x-none', [], 'lab', '2026-09-10'),
];
const got = relatedPosts(cur, all).map((p) => p.data.slug);
assert.deepEqual(got, ['show-2', 'show-1', 'x-two', 'x-one-new', 'x-one-old', 'x-cat']);
assert.ok(!got.includes('show-3') && !got.includes('show-draft') && !got.includes('x-none'));
assert.equal(relatedPosts(cur, [cur]).length, 0);

// 封面 alt
assert.equal(coverAlt('![長廊與畫桌](/covers/a.png)\n內文', '/covers/a.png', '標題'), '長廊與畫桌');
assert.equal(coverAlt('沒有圖', '/covers/a.png', '標題'), '標題');

console.log('test_article_extras: all passed');
