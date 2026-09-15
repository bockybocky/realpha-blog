// 自檢：rehypeInArticleAds 在文章內文的 h2 前面插「文章內嵌廣告」
// 跑法：node scripts/test_rehype_in_article_ads.mjs
import assert from 'node:assert/strict';
import rehypeInArticleAds, { adAttrs, inArticleNode } from '../src/lib/rehype-in-article-ads.mjs';
import rehypeTakeawayNote from '../src/lib/rehype-takeaway-note.mjs';

const text = (value) => ({ type: 'text', value });
const el = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, properties, children });
const h2 = (label) => el('h2', [text(label)]);
const isAd = (n) => n?.type === 'element' && n.tagName === 'aside' && n.properties?.className?.includes('ad-slot-inArticle');
const countAds = (node) => (isAd(node) ? 1 : 0) + (Array.isArray(node?.children) ? node.children.reduce((s, c) => s + countAds(c), 0) : 0);
const cfg = (over = {}) => ({ enabled: true, client: 'ca-pub-1', slots: { display: '1', inArticle: '2222222222', multiplex: '3' }, inArticleEvery: 1, inArticleSkipFirst: true, ...over });
const file = (frontmatter = {}, path = 'x.zh-TW.mdx') => ({ path, data: { astro: { frontmatter } } });
const run = (tree, config, f = file({ lang: 'zh-TW', category: 'tech' })) => {
	rehypeInArticleAds({ config })(tree, f);
	return tree;
};
// 標題序列：每個 h2 前面有沒有廣告（用 'A' 標出廣告位置）
const shape = (children) => children.filter((n) => n.type === 'element' || n.type === 'mdxjsEsm').map((n) => (isAd(n) ? 'A' : n.tagName ?? n.type));
const article = () => ({
	type: 'root',
	children: [
		el('p', [text('開場')]),
		h2('一'),
		el('p'),
		text('\n'),
		h2('二'),
		el('p'),
		h2('三'),
		el('p'),
		h2('帶得走的一件事'),
		el('p', [text('便利貼內容')]),
		el('h3', [text('便利貼裡的小標')]),
		h2('可以參考的資料'),
		el('ul'),
		el('section', [h2('Footnotes')], { dataFootnotes: true, className: ['footnotes'] }),
		{ type: 'mdxjsEsm', value: 'export const x = 1' },
	],
});
const withNote = () => {
	const tree = article();
	rehypeTakeawayNote()(tree);
	return tree;
};

// 1. 預設（每個都插、跳過第一個）：一、便利貼、腳註不插；二、三、可以參考的資料 前面各一個
{
	const tree = run(withNote(), cfg());
	assert.deepEqual(shape(tree.children), ['p', 'h2', 'p', 'A', 'h2', 'p', 'A', 'h2', 'p', 'section', 'A', 'h2', 'ul', 'section', 'mdxjsEsm']);
	assert.equal(countAds(tree), 3);
	const note = tree.children.find((n) => n.properties?.className?.includes('takeaway-note'));
	assert.equal(countAds(note), 0, '便利貼裡面零廣告');
	const foot = tree.children.find((n) => n.properties?.dataFootnotes);
	assert.equal(countAds(foot), 0, '腳註裡零廣告');
}

// 2. 便利貼外掛還沒跑（保險）：「帶得走的一件事」h2 前面也不插
{
	const tree = run(article(), cfg());
	const i = tree.children.findIndex((n) => n.tagName === 'h2' && n.children[0].value === '帶得走的一件事');
	assert.ok(!isAd(tree.children[i - 1]) && !isAd(tree.children[i - 2]), '帶得走標題前不插');
	assert.equal(countAds(tree), 3);
}

// 3. 不跳第一個：四個 h2（一、二、三、可以參考的資料）都插
assert.equal(countAds(run(withNote(), cfg({ inArticleSkipFirst: false }))), 4);

// 4. 每兩個插一個：候選 = 二、三、可以參考的資料 → 取第 0、2 個 = 二、可以參考的資料
{
	const tree = run(withNote(), cfg({ inArticleEvery: 2 }));
	assert.deepEqual(shape(tree.children), ['p', 'h2', 'p', 'A', 'h2', 'p', 'h2', 'p', 'section', 'A', 'h2', 'ul', 'section', 'mdxjsEsm']);
}

// 5. 不合法的 inArticleEvery 退回 1
assert.equal(countAds(run(withNote(), cfg({ inArticleEvery: 0 }))), 3);
assert.equal(countAds(run(withNote(), cfg({ inArticleEvery: 'x' }))), 3);

// 6. id 空／關閉／client 空／lab 分類：樹完全不變
for (const [name, config, f] of [
	['inArticle id 空', cfg({ slots: { display: '1', inArticle: '', multiplex: '3' } }), undefined],
	['inArticle id 只有空白', cfg({ slots: { inArticle: '   ' } }), undefined],
	['slots 缺', cfg({ slots: undefined }), undefined],
	['enabled false', cfg({ enabled: false }), undefined],
	['client 空', cfg({ client: '' }), undefined],
	['lab 文章', cfg(), file({ lang: 'zh-TW', category: 'lab' })],
]) {
	const tree = withNote();
	const before = JSON.stringify(tree);
	run(tree, config, f);
	assert.equal(JSON.stringify(tree), before, name);
}

// 7. 巢狀在 aside（目錄／TL;DR 面板）或 JSX 元件裡的 h2 不算：只看內文最上層
{
	const tree = {
		type: 'root',
		children: [
			el('aside', [h2('TL;DR')], { className: ['tldr-panel'] }),
			el('nav', [h2('目錄')], { className: ['toc'] }),
			h2('一'),
			h2('二'),
		],
	};
	run(tree, cfg());
	assert.deepEqual(shape(tree.children), ['aside', 'nav', 'h2', 'A', 'h2']);
}

// 8. 冪等：跑兩次不會多插
{
	const tree = run(withNote(), cfg());
	const once = JSON.stringify(tree);
	run(tree, cfg());
	assert.equal(JSON.stringify(tree), once);
}

// 9. 插入的元素與 AdSlot 的 inArticle 輸出一致；英文標籤看 frontmatter.lang，沒有就看檔名
{
	const node = inArticleNode('ca-pub-1', '2222222222', 'zh-TW');
	assert.equal(node.tagName, 'aside');
	assert.deepEqual(node.properties.className, ['ad-slot', 'ad-slot-inArticle']);
	assert.equal(node.properties.dataPagefindIgnore, true);
	const [label, ins] = node.children;
	assert.equal(label.children[0].value, '廣告');
	assert.deepEqual(ins.properties.className, ['adsbygoogle']);
	assert.equal(ins.properties.style, 'display:block; text-align:center;');
	assert.equal(ins.properties.dataAdLayout, 'in-article');
	assert.equal(ins.properties.dataAdFormat, 'fluid');
	assert.equal(ins.properties.dataAdClient, 'ca-pub-1');
	assert.equal(ins.properties.dataAdSlot, '2222222222');
	assert.deepEqual(adAttrs('inArticle'), { style: 'display:block; text-align:center;', 'data-ad-layout': 'in-article', 'data-ad-format': 'fluid' });
	assert.deepEqual(adAttrs('display'), { style: 'display:block', 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' });
	assert.deepEqual(adAttrs('multiplex'), { style: 'display:block', 'data-ad-format': 'autorelaxed' });
	const first = (t) => t.children.find(isAd).children[0].children[0].value;
	assert.equal(first(run(withNote(), cfg(), file({ lang: 'en' }, 'a.en.mdx'))), 'Ad');
	assert.equal(first(run(withNote(), cfg(), file({}, 'C:/x/a.en.mdx'))), 'Ad');
	assert.equal(first(run(withNote(), cfg(), {})), '廣告', '拿不到 file 資訊預設中文');
}

console.log('test_rehype_in_article_ads: 9 組全部通過');
