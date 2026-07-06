import rss from '@astrojs/rss';
import { getBlogPosts } from '../../lib/content';
import { site } from '../../lib/site';

export async function GET(context) {
	const posts = await getBlogPosts('en');
	return rss({
		title: `${site.name} English RSS`,
		description: 'English updates from Realpha Blog.',
		site: context.site ?? site.url,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/en/blog/${post.data.slug}/`,
		})),
	});
}
