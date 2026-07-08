import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
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
