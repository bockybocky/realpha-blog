// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';

function rehypeCopyCode() {
	return (tree) => {
		function walk(node) {
			if (!node || typeof node !== 'object') return;
			if (node.type === 'element' && node.tagName === 'pre') {
				node.properties ??= {};
				const className = Array.isArray(node.properties.className) ? node.properties.className : [];
				node.properties.className = [...new Set([...className, 'code-block'])];
				node.children ??= [];
				const hasButton = node.children.some(
					(child) => child?.type === 'element' && child?.properties?.['data-copy-code'] !== undefined,
				);
				if (!hasButton) {
					node.children.unshift({
						type: 'element',
						tagName: 'button',
						properties: {
							type: 'button',
							className: ['copy-code'],
							'data-copy-code': '',
							'aria-label': 'Copy code',
						},
						children: [{ type: 'text', value: 'Copy' }],
					});
				}
			}
			if (Array.isArray(node.children)) node.children.forEach(walk);
		}
		walk(tree);
	};
}

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.getrealpha.com',
	integrations: [mdx(), sitemap()],
	i18n: {
		defaultLocale: 'zh-TW',
		locales: ['zh-TW', 'en'],
		routing: {
			prefixDefaultLocale: false,
		},
	},
	markdown: {
		syntaxHighlight: 'shiki',
		shikiConfig: {
			theme: 'github-dark',
			wrap: false,
		},
		processor: unified({ rehypePlugins: [rehypeCopyCode] }),
	},
});
