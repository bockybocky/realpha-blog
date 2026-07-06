import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const locale = z.enum(['zh-TW', 'en']);
const base = z.object({
	title: z.string(),
	description: z.string(),
	slug: z.string(),
	lang: locale,
	pubDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	featured: z.boolean().default(false),
	draft: z.boolean().default(false),
});

const blog = defineCollection({
	loader: glob({
		pattern: '**/*.{md,mdx}',
		base: './src/content/blog',
		generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ''),
	}),
	schema: base.extend({
		category: z.enum(['tech', 'investing', 'systems']).default('tech'),
		tags: z.array(z.string()).default([]),
		ogImage: z.string().default('/og-default.svg'),
	}),
});

const lab = defineCollection({
	loader: glob({
		pattern: '**/*.{md,mdx}',
		base: './src/content/lab',
		generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ''),
	}),
	schema: base.extend({
		demo: z.enum(['canvas-waves', 'line-chart']),
	}),
});

const projects = defineCollection({
	loader: glob({
		pattern: '**/*.{md,mdx}',
		base: './src/content/projects',
		generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ''),
	}),
	schema: base.extend({
		repoUrl: z.string().url().optional(),
		homepageUrl: z.string().url().optional(),
	}),
});

export const collections = { blog, lab, projects };
