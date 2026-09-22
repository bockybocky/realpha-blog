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
		blog: '全部文章',
		lab: '動手玩',
		projects: '工具箱',
		about: '為什麼',
		aboutNav: '關於',
		weeklyNav: '週報',
		search: '搜尋',
		privacy: '隱私權',
		app: '安裝 App',
		switchLabel: 'English',
	},
	en: {
		htmlLang: 'en',
		label: 'English',
		rssLabel: 'RSS',
		home: 'Home',
		blog: 'All posts',
		lab: 'Lab',
		projects: 'Projects',
		about: 'About',
		aboutNav: 'About',
		weeklyNav: 'Weekly',
		search: 'Search',
		privacy: 'Privacy',
		app: 'Install app',
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
