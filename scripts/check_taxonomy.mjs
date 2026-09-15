// 分類自檢：node scripts/check_taxonomy.mjs
// 用網站同一份規則（src/lib/taxonomy.ts）把全部文章分一次，印每主題／每系列篇數，並斷言：
//   ① 每篇都有主題  ② 五個主題在繁中都 > 0  ③ 同 slug 的中英兩版主題一致
// 任一不成立 exit 1。需要 Node 22.18+（直接載入 .ts）。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { buildTopicMap, seriesIdOf } from '../src/lib/taxonomy.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const blogDir = join(root, 'src', 'content', 'blog');
const cfg = JSON.parse(readFileSync(join(root, 'src', 'data', 'topics.json'), 'utf8'));

function unquote(v) {
	return v.trim().replace(/^["']|["']$/g, '');
}

// # ponytail: 只吃本站 frontmatter 用到的單行純量與單行／多行字串陣列；遇到巢狀結構要換 yaml 套件
function parseFrontmatter(raw) {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	assert.ok(m, 'frontmatter missing');
	const data = {};
	const lines = m[1].split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const idx = line.indexOf(':');
		if (idx < 0 || /^\s/.test(line)) continue;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim();
		if (value.startsWith('[')) {
			data[key] = value.slice(1, value.lastIndexOf(']')).split(',').map(unquote).filter(Boolean);
		} else if (value === '' && lines[i + 1]?.trim().startsWith('- ')) {
			const list = [];
			while (lines[i + 1]?.trim().startsWith('- ')) list.push(unquote(lines[++i].trim().slice(2)));
			data[key] = list;
		} else {
			data[key] = unquote(value);
		}
	}
	return data;
}

const posts = [];
for (const file of readdirSync(blogDir)) {
	if (!/\.mdx?$/.test(file)) continue;
	const d = parseFrontmatter(readFileSync(join(blogDir, file), 'utf8'));
	if (d.draft === 'true') continue;
	posts.push({ slug: d.slug, lang: d.lang, title: d.title ?? '', category: d.category ?? 'tech', tags: d.tags ?? [], file });
}

const map = buildTopicMap(posts, cfg.topics, cfg.defaultTopic);

for (const lang of ['zh-TW', 'en']) {
	const mine = posts.filter((p) => p.lang === lang);
	console.log(`\n[${lang}] ${mine.length} 篇`);
	for (const t of cfg.topics) {
		const n = mine.filter((p) => map.get(`${lang}:${p.slug}`) === t.id).length;
		console.log(`  ${t.id.padEnd(16)} ${String(n).padStart(4)}  ${t.name[lang]}`);
		if (lang === 'zh-TW') assert.ok(n > 0, `主題 ${t.id} 在繁中是 0 篇`);
	}
	const seriesCount = new Map();
	for (const p of mine) {
		const s = seriesIdOf(p.slug, cfg.series);
		if (s) seriesCount.set(s, (seriesCount.get(s) ?? 0) + 1);
	}
	const shown = [...seriesCount].filter(([, n]) => n >= cfg.seriesMinPosts).sort((a, b) => b[1] - a[1]);
	console.log(`  系列（>= ${cfg.seriesMinPosts} 篇才出頁）：${shown.map(([id, n]) => `${id} ${n}`).join('、')}`);
}

for (const p of posts) {
	const topic = map.get(`${p.lang}:${p.slug}`);
	assert.ok(topic && cfg.topics.some((t) => t.id === topic), `${p.file} 沒有主題`);
	if (p.lang === 'en' && posts.some((q) => q.lang === 'zh-TW' && q.slug === p.slug)) {
		assert.equal(topic, map.get(`zh-TW:${p.slug}`), `${p.slug} 中英主題不一致`);
	}
}

// 規則自檢（陽性對照）：category 優先、關鍵字計分、零分歸預設
const probe = (o) => buildTopicMap([{ slug: 'x', lang: 'zh-TW', title: '', category: 'investing', tags: [], ...o }], cfg.topics, cfg.defaultTopic).get('zh-TW:x');
assert.equal(probe({ category: 'systems', tags: ['聯準會'] }), 'learning');
assert.equal(probe({ category: 'lab' }), 'learning');
assert.equal(probe({ tags: ['AI 資本支出'] }), 'markets');
assert.equal(probe({ title: '聯準會又升息' }), 'markets');
assert.equal(probe({ tags: ['投資心理'] }), 'growth');
assert.equal(probe({ tags: ['podcast-notes'] }), 'markets');
assert.equal(seriesIdOf('gooaye-2026-07-18-ep680', cfg.series), 'gooaye');
assert.equal(seriesIdOf('herdr-guide', cfg.series), null);

console.log(`\nOK：${posts.length} 篇全部有主題，各主題繁中皆 > 0，中英同 slug 主題一致，規則自檢 8/8 通過`);
