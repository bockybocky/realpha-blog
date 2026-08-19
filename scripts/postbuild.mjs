import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentRoot = join(root, 'src', 'content');
const distRoot = join(root, 'dist');
const publicRoot = join(root, 'public');
const siteUrl = 'https://blog.getrealpha.com';

// # ponytail: this parser supports the simple scalar/list frontmatter used in Phase A; upgrade to gray-matter if nested content metadata arrives.
function parseFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) return { data: {}, body: raw };
	const data = {};
	for (const line of match[1].split(/\r?\n/)) {
		const index = line.indexOf(':');
		if (index < 0) continue;
		const key = line.slice(0, index).trim();
		let value = line.slice(index + 1).trim();
		if (value.startsWith('[') && value.endsWith(']')) {
			value = value
				.slice(1, -1)
				.split(',')
				.map((item) => item.trim().replace(/^["']|["']$/g, ''))
				.filter(Boolean);
		} else if (value === 'true' || value === 'false') {
			value = value === 'true';
		} else {
			value = value.replace(/^["']|["']$/g, '');
		}
		data[key] = value;
	}
	return { data, body: match[2].trim() };
}

async function collectFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const next = join(dir, entry.name);
			return entry.isDirectory() ? collectFiles(next) : next;
		}),
	);
	return files.flat().filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));
}

function pagePath(collection, data, markdown = false) {
	const prefix = data.lang === 'en' ? '/en' : '';
	if (collection === 'blog') return `${prefix}/blog/${data.slug}${markdown ? '.md' : '/'}`;
	if (collection === 'lab') return `${prefix}/lab/${data.slug}/`;
	if (collection === 'projects') return `${prefix}/projects/${data.slug}/`;
	return `${prefix}/`;
}

const files = await collectFiles(contentRoot);
const entries = [];
for (const file of files) {
	const raw = await readFile(file, 'utf8');
	const { data, body } = parseFrontmatter(raw);
	const collection = relative(contentRoot, file).split(/[\\/]/)[0];
	if (!data.title || data.draft === true) continue;
	entries.push({ collection, data, body });
}

entries.sort((a, b) => String(b.data.pubDate || '').localeCompare(String(a.data.pubDate || '')));

const fullLines = entries.map((entry) => {
	const path = pagePath(entry.collection, entry.data);
	const md = entry.collection === 'blog' ? `\nMarkdown: ${siteUrl}${pagePath(entry.collection, entry.data, true)}` : '';
	return `## ${entry.data.title}
URL: ${siteUrl}${path}
Collection: ${entry.collection}
Locale: ${entry.data.lang}
Description: ${entry.data.description || ''}${md}

${entry.body}`;
});

await mkdir(distRoot, { recursive: true });
const publicLlms = await readFile(join(publicRoot, 'llms.txt'), 'utf8');
await writeFile(
	join(distRoot, 'llms.txt'),
	`${publicLlms.trimEnd()}\n`,
	'utf8',
);

await writeFile(
	join(distRoot, 'llms-full.txt'),
	`# Realpha Blog Full Text

${fullLines.join('\n\n')}
`,
	'utf8',
);

console.log(`postbuild: wrote llms.txt and llms-full.txt for ${entries.length} entries`);

// ---- 開篇引言閘（2026-08-16 Charles 拍板）----
// 病理：規則只寫在自動線的提示詞裡，手寫文章沒有任何東西會檢查 → 08-15 手寫四篇全漏。
// 建置是自動線與手寫共同的必經關卡，所以閘門放這裡。
// 基線＋棘輪：既有缺口先豁免，新出現的直接擋；補好了自動從基線移除，不能倒退。
const EPIGRAPH_BASELINE = join(root, 'scripts', 'epigraph_baseline.json');

function hasEpigraph(body) {
	const head = body.split(/\n##\s/)[0];
	return /^>\s*\S/m.test(head);
}

const zhPosts = entries.filter((e) => e.collection === 'blog' && e.data.lang !== 'en');
const missing = zhPosts.filter((e) => !hasEpigraph(e.body)).map((e) => e.data.slug).sort();

let baseline = [];
try {
	baseline = JSON.parse(await readFile(EPIGRAPH_BASELINE, 'utf8'));
} catch {
	baseline = [];
}

const fresh = missing.filter((slug) => !baseline.includes(slug));
if (fresh.length > 0) {
	console.error(`\n開篇引言閘：以下 ${fresh.length} 篇沒有開篇引言，不准發布`);
	for (const slug of fresh) console.error(`   - ${slug}`);
	console.error('   規則：封面圖之後、第一個 ## 標題之前，要有一段 > 引用格式的開篇引言。');
	console.error('   詩詞／文章段落／歌詞都行，中外不限；仍有版權的只短引 1-2 句。');
	console.error('   引言下方標「作品・作者/演唱者・年份」。');
	console.error('   真的要例外：把 slug 加進 scripts/epigraph_baseline.json\n');
	process.exit(1);
}

const stillMissing = baseline.filter((slug) => missing.includes(slug));
if (stillMissing.length !== baseline.length) {
	await writeFile(EPIGRAPH_BASELINE, `${JSON.stringify(stillMissing, null, '\t')}\n`, 'utf8');
	console.log(`postbuild: 引言基線棘輪 ${baseline.length} → ${stillMissing.length} 篇`);
}
console.log(`postbuild: 開篇引言閘通過（${zhPosts.length} 篇，基線豁免 ${stillMissing.length} 篇）`);

// ---- 站內斷連結閘（2026-08-19）----
// 病理：語言切換鈕寫死指向 /en/...，沒出英文版的文章點了就是 404；
// 這種錯只有讀者點下去才會發現，而發現的人通常是 Charles 本人。
// 把每個 href/src 對回 dist 裡的實體檔案，斷掉就擋建置。
// 外部網址不查——403 與逾時多半是擋機器人，不是連結壞掉。
const LINK_BASELINE = join(root, 'scripts', 'linkcheck_baseline.json');

async function listHtml(dir, base = dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await listHtml(full, base)));
		else if (entry.name.endsWith('.html')) out.push(relative(base, full));
	}
	return out;
}

function resolveInDist(url) {
	const clean = decodeURIComponent(url.split('#')[0].split('?')[0]);
	if (!clean.startsWith('/')) return null;          // 相對連結不查
	const target = join(distRoot, clean.replace(/^\//, ''));
	if (clean.endsWith('/')) return existsSync(join(target, 'index.html'));
	return existsSync(target) || existsSync(`${target}.html`) || existsSync(join(target, 'index.html'));
}

const htmlFiles = await listHtml(distRoot);
const brokenLinks = new Map();
let linkCount = 0;
for (const rel of htmlFiles) {
	const html = await readFile(join(distRoot, rel), 'utf8');
	for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
		const url = m[1];
		if (/^(https?:|mailto:|data:|javascript:|#|\/\/)/.test(url)) continue;
		linkCount += 1;
		if (resolveInDist(url) === false) {
			if (!brokenLinks.has(url)) brokenLinks.set(url, []);
			brokenLinks.get(url).push(rel.split(sep).join('/'));
		}
	}
}

let linkBaseline;
try {
	linkBaseline = JSON.parse(await readFile(LINK_BASELINE, 'utf8'));
} catch {
	linkBaseline = [];
}

const freshBroken = [...brokenLinks.keys()].filter((u) => !linkBaseline.includes(u));
if (freshBroken.length > 0) {
	console.error(`
斷連結閘：以下 ${freshBroken.length} 個站內連結指向不存在的頁面，不准發布`);
	for (const url of freshBroken) {
		const from = brokenLinks.get(url);
		console.error(`   - ${url}`);
		console.error(`       出現在：${from.slice(0, 3).join('、')}${from.length > 3 ? ` 等 ${from.length} 頁` : ''}`);
	}
	console.error('   常見成因：語言切換鈕指向還沒出的翻譯版、改了 slug 沒改連到它的地方。');
	console.error('   真的要例外：把網址加進 scripts/linkcheck_baseline.json');
	process.exit(1);
}

const stillBroken = linkBaseline.filter((u) => brokenLinks.has(u));
if (stillBroken.length !== linkBaseline.length) {
	await writeFile(LINK_BASELINE, `${JSON.stringify(stillBroken, null, '	')}
`, 'utf8');
	console.log(`postbuild: 斷連結基線棘輪 ${linkBaseline.length} → ${stillBroken.length} 個`);
}
console.log(`postbuild: 斷連結閘通過（${htmlFiles.length} 頁 / ${linkCount} 個站內連結，基線豁免 ${stillBroken.length} 個）`);

// ---- 封面換圖閘（2026-08-19）----
// 病理：Cloudflare 依網址快取。封面內容換了但檔名沒換，線上會一直吐舊圖，
// 而本地看起來完全正常——Charles 看到的是「圖沒換呀」，我這邊每次都驗過。
// 解法是換檔名（{slug}-cover-v2.png 這種）讓網址改變。
// 這道閘只認一件事：同一個檔名，內容變了。
const COVER_HASHES = join(root, 'scripts', 'cover_hashes.json');
const coversDir = join(publicRoot, 'covers');

let knownHashes;
try {
	knownHashes = JSON.parse(await readFile(COVER_HASHES, 'utf8'));
} catch {
	knownHashes = {};
}

const coverFiles = (await readdir(coversDir)).filter((f) => !f.startsWith('.'));
const currentHashes = {};
const silentlySwapped = [];
for (const name of coverFiles) {
	const buf = await readFile(join(coversDir, name));
	const hash = createHash('md5').update(buf).digest('hex').slice(0, 16);
	currentHashes[name] = hash;
	if (knownHashes[name] && knownHashes[name] !== hash) silentlySwapped.push(name);
}

if (silentlySwapped.length > 0) {
	console.error(`\n封面換圖閘：以下 ${silentlySwapped.length} 張封面換了內容卻沿用同一個檔名，不准發布`);
	for (const name of silentlySwapped) console.error(`   - ${name}`);
	console.error('   Cloudflare 依網址快取，檔名不變＝線上一直吐舊圖，只有你自己看到新的。');
	console.error('   正解：新圖改名（例如 xxx-cover-v2.png），並同步改三處——');
	console.error('   frontmatter 的 ogImage、cover，以及內文的 ![alt](...) 圖片語法。');
	console.error('   真的要沿用檔名：刪掉 scripts/cover_hashes.json 裡那一筆再建置。');
	process.exit(1);
}

const firstRun = Object.keys(knownHashes).length === 0;
if (JSON.stringify(knownHashes) !== JSON.stringify(currentHashes)) {
	await writeFile(COVER_HASHES, `${JSON.stringify(currentHashes, null, '\t')}\n`, 'utf8');
}
console.log(`postbuild: 封面換圖閘通過（${coverFiles.length} 張${firstRun ? '，本次建立基線' : ''}）`);
