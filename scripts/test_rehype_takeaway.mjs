// 自檢：rehypeTakeawayNote 把「帶得走的一件事」h2 到下一個 h2（或文末）包進 section.takeaway-note
// 跑法：node scripts/test_rehype_takeaway.mjs
import assert from 'node:assert/strict';
import rehypeTakeawayNote, { isTakeawayHeading } from '../src/lib/rehype-takeaway-note.mjs';

const text = (value) => ({ type: 'text', value });
const el = (tagName, children = [], properties = {}) => ({ type: 'element', tagName, properties, children });
const run = (tree) => {
	rehypeTakeawayNote()(tree);
	return tree;
};
const tags = (nodes) => nodes.map((n) => (n.type === 'element' ? n.tagName : n.type));

// 1. 標題判定：中文一種、英文「one thing」家族；其他相似標題不收
for (const h of ['帶得走的一件事', 'One thing to take with you', 'The one thing to take away', 'The One Thing to Take Away', 'One Thing To Take With You', 'One Thing Worth Taking Away', 'One Thing Worth Taking With You', 'The one thing to take with you']) {
	assert.equal(isTakeawayHeading(h), true, h);
}
for (const h of ['Key Takeaways', 'Three takeaways', 'One thing to know about', '三個帶得走的教訓', '延伸想法', 'Generative AI: each knob controls one thing']) {
	assert.equal(isTakeawayHeading(h), false, h);
}

// 2. 包到下一個 h2 為止，前後內容不動
{
	const tree = {
		type: 'root',
		children: [
			el('h2', [text('這集在講什麼')]),
			el('p', [text('a')]),
			text('\n'),
			el('h2', [text('帶得走的一件事')], { id: 'x' }),
			el('p', [text('b')]),
			el('figure'),
			el('h2', [text('可以參考的資料')]),
			el('ul'),
		],
	};
	run(tree);
	assert.deepEqual(tags(tree.children), ['h2', 'p', 'text', 'section', 'h2', 'ul']);
	const note = tree.children[3];
	assert.deepEqual(note.properties.className, ['takeaway-note']);
	assert.deepEqual(tags(note.children), ['h2', 'p', 'figure']);
	assert.equal(note.children[0].properties.id, 'x', 'h2 的 id 保留（目錄錨點）');
}

// 3. 在文末：包到最後，但腳註 section 與 MDX import/export 留在外面
{
	const footnotes = el('section', [el('h2', [text('Footnotes')])], { dataFootnotes: true, className: ['footnotes'] });
	const esm = { type: 'mdxjsEsm', value: 'export const x = 1' };
	const tree = {
		type: 'root',
		children: [el('h2', [el('strong', [text('The One Thing')]), text(' to Take Away')]), el('p', [text('c')]), { type: 'mdxJsxFlowElement', name: 'Foo', children: [] }, footnotes, esm],
	};
	run(tree);
	assert.deepEqual(tags(tree.children), ['section', 'section', 'mdxjsEsm']);
	assert.deepEqual(tags(tree.children[0].children), ['h2', 'p', 'mdxJsxFlowElement']);
	assert.equal(tree.children[1], footnotes);
}

// 4. 沒有這個標題的文章：樹完全不變
{
	const tree = { type: 'root', children: [el('h2', [text('摘要重點')]), el('p', [text('d')]), el('h2', [text('Key Takeaways')]), el('p')] };
	const before = JSON.stringify(tree);
	run(tree);
	assert.equal(JSON.stringify(tree), before);
}

// 5. 冪等：跑兩次不會包兩層
{
	const tree = { type: 'root', children: [el('h2', [text('帶得走的一件事')]), el('p', [text('e')])] };
	run(tree);
	const once = JSON.stringify(tree);
	run(tree);
	assert.equal(JSON.stringify(tree), once);
	assert.equal(tree.children.length, 1);
}

// 6. 遇到 h1 也停
{
	const tree = { type: 'root', children: [el('h2', [text('帶得走的一件事')]), el('p'), el('h1', [text('x')]), el('p')] };
	run(tree);
	assert.deepEqual(tags(tree.children), ['section', 'h1', 'p']);
}

console.log('test_rehype_takeaway: 6 組全部通過');
