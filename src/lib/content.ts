import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from './site';

function byDateDesc<T extends { data: { pubDate: Date } }>(a: T, b: T) {
	return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export async function getBlogPosts(locale: Locale) {
	return (await getCollection('blog', ({ data }) => data.lang === locale && !data.draft)).sort(byDateDesc);
}

export async function getLabs(locale: Locale) {
	return (await getCollection('lab', ({ data }) => data.lang === locale && !data.draft)).sort(byDateDesc);
}

export async function getProjects(locale: Locale) {
	return (await getCollection('projects', ({ data }) => data.lang === locale && !data.draft)).sort(byDateDesc);
}

export function markdownForPost(post: CollectionEntry<'blog'>) {
	return `# ${post.data.title}

> ${post.data.description}

Published: ${post.data.pubDate.toISOString().slice(0, 10)}
Locale: ${post.data.lang}
Tags: ${post.data.tags.join(', ')}

${post.body.trim()}
`;
}
