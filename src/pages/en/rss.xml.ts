import rss from '@astrojs/rss';
import { getBlogPosts } from '../../lib/content';
import { site } from '../../lib/site';

export async function GET(context) {
	const posts = await getBlogPosts('en');
	const staticItems = [
		{
			title: 'About',
			description: 'What Realpha writes about — growth, learning notes, and markets — and how the human and the AI share the work.',
			pubDate: new Date('2026-07-08'),
			link: '/en/about/',
		},
		{
			title: 'Lab',
			description: 'Small tools that turn a concept into something you can try with your own numbers.',
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
