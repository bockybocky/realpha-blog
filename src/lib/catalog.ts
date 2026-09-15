// 網站端的文章目錄：把 blog collection 套上主題與節目系列（規則在 taxonomy.ts）。
import { getCollection, type CollectionEntry } from 'astro:content';
import topicsData from '../data/topics.json';
import { buildTopicMap, seriesIdOf, type Lang, type SeriesDef, type TopicDef } from './taxonomy';
import { withLocale } from './site';

export type Post = CollectionEntry<'blog'>;
export type Series = SeriesDef & { posts: Post[] };

export const topics = topicsData.topics as TopicDef[];
export const seriesDefs = topicsData.series as SeriesDef[];
export const PAGE_SIZE = 24;

let allPosts: Promise<Post[]> | undefined;

async function loadAll() {
	const posts = await getCollection('blog', ({ data }) => !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getCatalog(locale: Lang) {
	const all = await (allPosts ??= loadAll());
	const topicMap = buildTopicMap(
		all.map((p) => ({ slug: p.data.slug, lang: p.data.lang, title: p.data.title, category: p.data.category, tags: p.data.tags })),
		topics,
		topicsData.defaultTopic,
	);
	const posts = all.filter((p) => p.data.lang === locale);
	const topicOf = (post: Post) => topicMap.get(`${post.data.lang}:${post.data.slug}`) ?? topicsData.defaultTopic;
	const byTopic = new Map(topics.map((t) => [t.id, posts.filter((p) => topicOf(p) === t.id)]));
	const series: Series[] = seriesDefs
		.map((s) => ({ ...s, posts: posts.filter((p) => seriesIdOf(p.data.slug, seriesDefs) === s.id) }))
		.filter((s) => s.posts.length >= topicsData.seriesMinPosts)
		.sort((a, b) => b.posts.length - a.posts.length);
	const seriesIds = new Set(series.map((s) => s.id));
	const seriesPosts = posts.filter((p) => seriesIds.has(seriesIdOf(p.data.slug, seriesDefs) ?? ''));
	const topicName = (id: string) => topics.find((t) => t.id === id)?.name[locale] ?? id;
	return { locale, posts, topics, byTopic, series, seriesPosts, topicOf, topicName };
}

export const topicPath = (locale: Lang, id: string) => withLocale(locale, `/topics/${id}/`);
