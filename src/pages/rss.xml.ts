import rss from '@astrojs/rss';
import { getBlogPosts } from '../lib/content';
import { site } from '../lib/site';

export async function GET(context) {
	const posts = await getBlogPosts('zh-TW');
	const staticItems = [
		{
			title: '方法論',
			description: 'Realpha Blog 的六關驗證流程：處理偏差、基準對照、交易成本、顯著性校正與跨模型紅隊。',
			pubDate: new Date('2026-07-08'),
			link: '/methodology/',
		},
		{
			title: '關於',
			description: 'Realpha Blog 的作者、公開實驗室定位、協作方式與授權說明。',
			pubDate: new Date('2026-07-08'),
			link: '/about/',
		},
		{
			title: '公開實驗室',
			description: '實驗前公開假設、驗證計畫與時間戳，結果出來後不論成敗照樣發表。',
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
