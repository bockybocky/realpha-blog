// 建置期把文末「帶得走的一件事」做成便利貼：該 h2 到下一個 h1/h2（或文末）包進 <section class="takeaway-note">。
// 不改 mdx。腳註區（section[data-footnotes]）與 MDX 的 import/export 永遠留在外面。
// 自檢：node scripts/test_rehype_takeaway.mjs

// 英文版實際用字（2026-09-15 grep src/content/blog/*.en.mdx）：
// One thing to take with you／The one thing to take away／The One Thing to Take Away／One Thing To Take With You／
// One thing to take away／The one thing to take with you／One Thing Worth Taking Away／One Thing Worth Taking With You
// 另有 5 篇英文檔直接沿用中文標題「帶得走的一件事」。
// 「Three takeaways」「三個帶得走的教訓」這類是別種段落，不收。
const ZH = /^帶得走的一件事$/;
const EN = /^(the )?one thing (to take (away|with you)|worth taking (away|with you))$/i;

export function isTakeawayHeading(label) {
	const s = String(label).replace(/\s+/g, ' ').trim();
	return ZH.test(s) || EN.test(s);
}

function textOf(node) {
	if (!node) return '';
	if (node.type === 'text') return node.value;
	return Array.isArray(node.children) ? node.children.map(textOf).join('') : '';
}

const isEl = (node, ...names) => node?.type === 'element' && names.includes(node.tagName);
const hasClass = (node, name) => Array.isArray(node?.properties?.className) && node.properties.className.includes(name);
const isFootnotes = (node) => isEl(node, 'section') && (node.properties?.dataFootnotes !== undefined || hasClass(node, 'footnotes'));
const stopsNote = (node) => isEl(node, 'h1', 'h2') || isFootnotes(node) || node?.type === 'mdxjsEsm';

function wrapIn(parent) {
	const kids = parent.children;
	for (let i = 0; i < kids.length; i++) {
		const node = kids[i];
		if (!isEl(node, 'h2') || !isTakeawayHeading(textOf(node))) continue;
		let end = i + 1;
		while (end < kids.length && !stopsNote(kids[end])) end++;
		const section = { type: 'element', tagName: 'section', properties: { className: ['takeaway-note'] }, children: kids.slice(i, end) };
		kids.splice(i, end - i, section);
	}
}

export default function rehypeTakeawayNote() {
	return (tree) => {
		const walk = (node) => {
			if (!node || !Array.isArray(node.children)) return;
			if (hasClass(node, 'takeaway-note')) return; // 已包過（冪等）
			wrapIn(node);
			for (const child of node.children) if (!hasClass(child, 'takeaway-note')) walk(child);
		};
		walk(tree);
	};
}
