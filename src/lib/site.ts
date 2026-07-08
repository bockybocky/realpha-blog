export type Locale = 'zh-TW' | 'en';

export const site = {
	name: 'Realpha Blog',
	url: 'https://blog.getrealpha.com',
	description: 'Bilingual technical and investment research notes by Realpha, Bocky, and the AI research team.',
	author: 'Bocky',
	github: 'https://github.com/bockybocky',
	org: 'Realpha',
	ogImage: '/og-default.svg',
};

export const localeMeta = {
	'zh-TW': {
		htmlLang: 'zh-Hant-TW',
		label: '繁中',
		rssLabel: 'RSS',
		home: '首頁',
		blog: '文章',
		ledger: '對答案',
		lab: 'Lab',
		methodology: '方法論',
		projects: 'Projects',
		about: '關於',
		switchLabel: 'English',
	},
	en: {
		htmlLang: 'en',
		label: 'English',
		rssLabel: 'RSS',
		home: 'Home',
		blog: 'Blog',
		ledger: 'Ledger',
		lab: 'Lab',
		methodology: 'Methodology',
		projects: 'Projects',
		about: 'About',
		switchLabel: '繁中',
	},
} satisfies Record<Locale, Record<string, string>>;

export const giscusConfig = {
	repo: 'bockybocky/realpha-blog',
	repoId: 'PHASE_C_REPO_ID',
	category: 'Announcements',
	categoryId: 'PHASE_C_CATEGORY_ID',
};

export function withLocale(locale: Locale, path: string) {
	const clean = path.startsWith('/') ? path : `/${path}`;
	if (locale === 'zh-TW') return clean;
	return clean === '/' ? '/en/' : `/en${clean}`;
}

export function otherLocale(locale: Locale): Locale {
	return locale === 'zh-TW' ? 'en' : 'zh-TW';
}

export function absoluteUrl(path: string) {
	return new URL(path, site.url).toString();
}

export function formatDate(date: Date, locale: Locale) {
	return new Intl.DateTimeFormat(locale === 'zh-TW' ? 'zh-TW' : 'en', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
	}).format(date);
}
