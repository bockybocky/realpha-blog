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

const preregistration = {
	hypothesis: z.string().optional(),
	plan: z.string().optional(),
	preregistered_at: z.coerce.date().optional(),
	result: z.string().default('驗證中'),
};

const blog = defineCollection({
	loader: glob({
		pattern: '**/*.{md,mdx}',
		base: './src/content/blog',
		generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ''),
	}),
	schema: base.extend({
		category: z.enum(['tech', 'investing', 'systems', 'lab']).default('tech'),
		tags: z.array(z.string()).default([]),
		ogImage: z.string().default('/og-default.svg'),
		tldr: z.string().optional(),
		...preregistration,
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
		...preregistration,
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
