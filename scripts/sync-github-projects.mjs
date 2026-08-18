/**
 * 同步 GitHub 公開作品清單到 src/data/github-projects.json。
 *
 * 為什麼不做成每個 repo 一個 mdx：那要替 20 個 repo 生中文介紹，
 * 內容會是湊出來的。這裡只搬 GitHub 上的事實（名稱、描述、語言、星數），
 * 想寫介紹的作品另外開 mdx，兩邊在 /projects/ 頁面上下並排。
 *
 * 只列「有寫描述」的 repo——沒描述的卡片讀者看不出那是什麼。
 * 被跳過的會印出來，不靜默截斷。
 *
 * 抓不到就沿用既有 JSON，不中止 build（外部 API 不該擋住出版）。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/data/github-projects.json');
const USER = 'bockybocky';
// 本站自己不列在作品集裡（讀者已經在站上了）
const EXCLUDE = new Set(['realpha-blog']);

async function fetchRepos() {
	const url = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&type=owner`;
	const res = await fetch(url, {
		headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'realpha-blog-sync' },
	});
	if (!res.ok) throw new Error(`GitHub API ${res.status}`);
	return res.json();
}

function keep(repo) {
	if (repo.private || repo.fork || repo.archived) return false;
	if (EXCLUDE.has(repo.name)) return false;
	return Boolean(repo.description && repo.description.trim());
}

try {
	const all = await fetchRepos();
	const owned = all.filter((r) => !r.private && !r.fork && !r.archived && !EXCLUDE.has(r.name));
	const listed = owned.filter(keep);
	const skipped = owned.filter((r) => !keep(r)).map((r) => r.name);

	const rows = listed
		.map((r) => ({
			name: r.name,
			description: r.description.trim(),
			url: r.html_url,
			homepage: r.homepage || null,
			language: r.language || null,
			stars: r.stargazers_count,
			topics: (r.topics || []).slice(0, 4),
			pushedAt: r.pushed_at,
		}))
		.sort((a, b) => (b.stars - a.stars) || (a.pushedAt < b.pushedAt ? 1 : -1));

	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(OUT, JSON.stringify({ syncedAt: new Date().toISOString(), repos: rows }, null, '\t') + '\n');
	console.log(`sync-github-projects: 列出 ${rows.length} 個作品`);
	if (skipped.length) {
		console.log(`sync-github-projects: 跳過 ${skipped.length} 個沒寫描述的 → ${skipped.join(', ')}`);
	}
} catch (err) {
	if (existsSync(OUT)) {
		const old = JSON.parse(readFileSync(OUT, 'utf8'));
		console.warn(`sync-github-projects: 抓取失敗（${err.message}），沿用 ${old.syncedAt} 的 ${old.repos.length} 筆`);
	} else {
		mkdirSync(dirname(OUT), { recursive: true });
		writeFileSync(OUT, JSON.stringify({ syncedAt: null, repos: [] }, null, '\t') + '\n');
		console.warn(`sync-github-projects: 抓取失敗（${err.message}），且沒有舊資料，這次不顯示作品區`);
	}
}
