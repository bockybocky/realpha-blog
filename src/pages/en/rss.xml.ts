import rss from '@astrojs/rss';
import { getBlogPosts } from '../../lib/content';
import { site } from '../../lib/site';

export async function GET(context) {
	const posts = await getBlogPosts('en');
	const staticItems = [
		{
			title: 'Methodology',
			description: "Realpha Blog's six-gate validation process: bias controls, baselines, trading costs, significance correction, and cross-model red-team review.",
			pubDate: new Date('2026-07-08'),
			link: '/en/methodology/',
		},
		{
			title: 'About',
			description: 'Author, public-lab positioning, collaboration, and licensing notes for Realpha Blog.',
			pubDate: new Date('2026-07-08'),
			link: '/en/about/',
		},
		{
			title: 'Public Lab',
			description: 'Hypotheses, validation plans, and timestamps are published before experiments run, then results are published regardless of outcome.',
			pubDate: new Date('2026-07-08'),
			link: '/en/lab/',
		},
	];
	return rss({
		title: `${site.name} English RSS`,
		description: 'English updates from Realpha Blog.',
		site: context.site ?? site.url,
		items: staticItems.concat(posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/en/blog/${post.data.slug}/`,
		}))),
	});
}
