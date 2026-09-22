// 從磁碟讀 src/content/blog/*.mdx 的 frontmatter（slug／lang／kind），給拿不到 astro:content 的地方用：
// astro.config.mjs 的 sitemap 過濾、自檢腳本。判定規則本身在 src/lib/indexing.mjs。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noindexSlugs } from '../src/lib/indexing.mjs';

const blogDir = fileURLToPath(new URL('../src/content/blog/', import.meta.url));

function field(fm, key) {
	const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
	return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
}

export function readFrontmatter(raw) {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return null;
	return { slug: field(m[1], 'slug'), lang: field(m[1], 'lang'), kind: field(m[1], 'kind'), draft: field(m[1], 'draft') };
}

export function readBlogMeta(dir = blogDir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		if (!/\.(md|mdx)$/.test(name)) continue;
		const meta = readFrontmatter(readFileSync(join(dir, name), 'utf8'));
		if (meta?.slug) out.push({ ...meta, file: name });
	}
	return out;
}

export function noindexSlugsFromDisk(dir = blogDir) {
	return noindexSlugs(readBlogMeta(dir));
}
