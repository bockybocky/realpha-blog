// 有聲版 podcast 訂閱源（中文）：只收有音檔的中文文章。音檔對應規則見 src/lib/audio.ts。
import rss from '@astrojs/rss';
import { resolveAudio } from '../lib/audio';
import { getBlogPosts } from '../lib/content';
import { absoluteUrl, site } from '../lib/site';

// ponytail: 站上沒有 1400px 以上的方形封面，暫用 512px 圖示；Apple Podcasts 送審前要換（README 已標缺口）
const COVER = '/favicon-512.png';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(context) {
	const posts = await getBlogPosts('zh-TW');
	const items = posts
		.map((post) => ({ post, audio: resolveAudio(post.data) }))
		.filter((x) => x.audio !== null)
		.map(({ post, audio }) => {
			const link = absoluteUrl(`/blog/${post.data.slug}/`);
			return {
				title: post.data.title,
				description: `${post.data.description}\n\n全文：${link}`,
				pubDate: post.data.pubDate,
				link,
				enclosure: { url: absoluteUrl(audio!.src), length: audio!.bytes ?? 0, type: 'audio/mpeg' },
				customData: audio!.seconds !== null ? `<itunes:duration>${audio!.seconds}</itunes:duration>` : '',
			};
		});
	return rss({
		title: 'Realpha 有聲版',
		description: 'Realpha Blog 文章的有聲版，由作者本人聲音以 AI 合成朗讀。',
		site: context.site ?? site.url,
		xmlns: { itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd' },
		customData: [
			'<language>zh-TW</language>',
			`<itunes:author>${esc(site.author)}</itunes:author>`,
			`<itunes:image href="${absoluteUrl(COVER)}"/>`,
			'<itunes:category text="Business"><itunes:category text="Investing"/></itunes:category>',
			'<itunes:explicit>false</itunes:explicit>',
			'<itunes:type>episodic</itunes:type>',
		].join(''),
		items,
	});
}
