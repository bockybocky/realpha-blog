// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';

function rehypeCopyCode() {
	// 按鈕放在不捲動的 wrapper 上（不是 pre 內），程式碼再寬、內部怎麼捲，按鈕都固定右上
	return (tree) => {
		function walk(node, parent) {
			if (!node || typeof node !== 'object') return;
			if (
				node.type === 'element' &&
				node.tagName === 'pre' &&
				parent &&
				!(parent.type === 'element' && Array.isArray(parent.properties?.className) && parent.properties.className.includes('code-wrap'))
			) {
				node.properties ??= {};
				const className = Array.isArray(node.properties.className) ? node.properties.className : [];
				node.properties.className = [...new Set([...className, 'code-block'])];
				const wrapper = {
					type: 'element',
					tagName: 'div',
					properties: { className: ['code-wrap'] },
					children: [
						{
							type: 'element',
							tagName: 'button',
							properties: {
								type: 'button',
								className: ['copy-code'],
								'data-copy-code': '',
								'aria-label': 'Copy code',
							},
							children: [{ type: 'text', value: 'Copy' }],
						},
						node,
					],
				};
				const idx = parent.children.indexOf(node);
				if (idx !== -1) parent.children[idx] = wrapper;
				return; // 不再往 wrapper 裡走
			}
			if (Array.isArray(node.children)) [...node.children].forEach((child) => walk(child, node));
		}
		walk(tree, null);
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
