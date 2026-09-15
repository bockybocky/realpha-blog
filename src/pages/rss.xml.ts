import rss from '@astrojs/rss';
import { getBlogPosts } from '../lib/content';
import { site } from '../lib/site';

export async function GET(context) {
	const posts = await getBlogPosts('zh-TW');
	const staticItems = [
		{
			title: '關於',
			description: 'Realpha 寫什麼：心法與成長、研究筆記、投資與市場，以及人和 AI 怎麼分工。',
			pubDate: new Date('2026-07-08'),
			link: '/about/',
		},
		{
			title: '動手玩',
			description: '把一個概念做成可以自己輸入數字玩玩看的小工具。',
			pubDate: new Date('2026-07-08'),
			link: '/lab/',
		},
	];
	return rss({
		title: `${site.name} RSS`,
		description: 'Realpha Blog 繁中文章更新。',
		site: context.site ?? site.url,
		items: staticItems.concat(posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/blog/${post.data.slug}/`,
		}))),
	});
}
