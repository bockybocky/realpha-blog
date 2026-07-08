import { getBlogPosts, getLabs, getProjects } from '../lib/content';
import { absoluteUrl, type Locale } from '../lib/site';

const locales: Locale[] = ['zh-TW', 'en'];
const staticPaths = [
	'/',
	'/blog/',
	'/lab/',
	'/methodology/',
	'/projects/',
	'/about/',
	'/en/',
	'/en/blog/',
	'/en/lab/',
	'/en/methodology/',
	'/en/projects/',
	'/en/about/',
];

function item(path: string, lastmod = '2026-07-08') {
	return `<url><loc>${absoluteUrl(path)}</loc><lastmod>${lastmod}</lastmod></url>`;
}

export async function GET() {
	const dynamicPaths: { path: string; lastmod: string }[] = [];

	for (const locale of locales) {
		const prefix = locale === 'en' ? '/en' : '';
		const posts = await getBlogPosts(locale);
		const labs = await getLabs(locale);
		const projects = await getProjects(locale);

		for (const post of posts) {
			dynamicPaths.push({
				path: `${prefix}/blog/${post.data.slug}/`,
				lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString().slice(0, 10),
			});
		}

		for (const lab of labs) {
			dynamicPaths.push({
				path: `${prefix}/lab/${lab.data.slug}/`,
				lastmod: (lab.data.updatedDate ?? lab.data.pubDate).toISOString().slice(0, 10),
			});
		}

		for (const project of projects) {
			dynamicPaths.push({
				path: `${prefix}/projects/${project.data.slug}/`,
				lastmod: (project.data.updatedDate ?? project.data.pubDate).toISOString().slice(0, 10),
			});
		}
	}

	const urls = staticPaths.map((path) => item(path)).concat(dynamicPaths.map(({ path, lastmod }) => item(path, lastmod)));
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
}
