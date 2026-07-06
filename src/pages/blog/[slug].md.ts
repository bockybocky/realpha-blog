import type { APIContext } from 'astro';
import { getBlogPosts, markdownForPost } from '../../lib/content';

export async function getStaticPaths() {
	const posts = await getBlogPosts('zh-TW');
	return posts.map((post) => ({ params: { slug: post.data.slug }, props: { post } }));
}

export function GET({ props }: APIContext) {
	return new Response(markdownForPost(props.post), {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	});
}
