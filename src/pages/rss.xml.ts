import rss from '@astrojs/rss';
import { getBlogPosts } from '../lib/content';
import { site } from '../lib/site';

export async function GET(context) {
	const posts = await getBlogPosts('zh-TW');
	return rss({
		title: `${site.name} RSS`,
		description: 'Realpha Blog 繁中文章更新。',
		site: context.site ?? site.url,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/blog/${post.data.slug}/`,
		})),
	});
}
