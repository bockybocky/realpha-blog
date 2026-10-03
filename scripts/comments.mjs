import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DEFAULT_DATA_FILE = join(REPO_ROOT, 'data', 'comments.jsonl');
const DEFAULT_ENV_FILE = join(REPO_ROOT, '.comments.env');
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function send(res, status, value) {
	res.writeHead(status, JSON_HEADERS);
	res.end(JSON.stringify(value));
}

function parseEnv(text) {
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const match = /^GOOGLE_CLIENT_ID\s*=\s*(.*)$/.exec(line);
		if (!match) continue;
		return match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
	}
	return '';
}

async function loadRows(dataFile) {
	const text = await readFile(dataFile, 'utf8').catch((error) => {
		if (error.code === 'ENOENT') return '';
		throw error;
	});
	return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function readBody(req) {
	let text = '';
	for await (const chunk of req) {
		text += chunk;
		if (Buffer.byteLength(text) > 16_384) throw new Error('too_large');
	}
	return JSON.parse(text);
}

function publicRow(row) {
	return { id: row.id, name: row.name, avatar: row.avatar, body: row.body, createdAt: row.createdAt };
}

function validPath(path) {
	return typeof path === 'string' && (/^\/blog\/[^/]+\/$/.test(path) || /^\/en\/blog\/[^/]+\/$/.test(path));
}

function pageExists(path, root) {
	return existsSync(join(root, ...path.split('/').filter(Boolean), 'index.html'));
}

function notify(row) {
	const script = 'C:/Users/Charles/scripts/discord_notify.py';
	if (!existsSync(script)) return;
	const message = `部落格新留言：${row.name}\n${row.path}\n${row.body.slice(0, 500)}`;
	const child = spawn('python', [script, message], { windowsHide: true, detached: true, stdio: 'ignore' });
	child.on('error', () => {});
	child.unref();
}

export function createCommentsHandler(options = {}) {
	const dataFile = options.dataFile ?? DEFAULT_DATA_FILE;
	const envFile = options.envFile ?? DEFAULT_ENV_FILE;
	const fetchImpl = options.fetchImpl ?? fetch;
	const now = options.now ?? (() => Date.now());
	const notifyImpl = options.notifyImpl ?? notify;
	let writeQueue = Promise.resolve();

	async function clientId() {
		return parseEnv(await readFile(envFile, 'utf8').catch(() => ''));
	}

	return async function handleComments(req, res, root) {
		const url = new URL(req.url ?? '/', 'http://localhost');
		if (url.pathname === '/api/comments/config') {
			if (req.method !== 'GET') return send(res, 405, { error: 'Method Not Allowed' });
			return send(res, 200, { clientId: await clientId() });
		}
		if (url.pathname !== '/api/comments') return send(res, 404, { error: 'Not Found' });

		if (req.method === 'GET') {
			const path = url.searchParams.get('path');
			if (!validPath(path)) return send(res, 400, { error: 'Invalid path' });
			const rows = await loadRows(dataFile);
			return send(res, 200, rows.filter((row) => row.path === path && !row.hidden).map(publicRow));
		}
		if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });

		let input;
		try { input = await readBody(req); } catch { return send(res, 400, { error: 'Invalid JSON' }); }
		const { path, body, credential } = input ?? {};
		const cleanBody = typeof body === 'string' ? body.trim() : '';
		if (!validPath(path) || !pageExists(path, root)) return send(res, 400, { error: 'Invalid path' });
		if (cleanBody.length < 1 || cleanBody.length > 2000) return send(res, 400, { error: 'Comment must be 1–2000 characters' });
		if (typeof credential !== 'string' || !credential) return send(res, 401, { error: 'Invalid credential' });
		const expectedAud = await clientId();
		if (!expectedAud) return send(res, 503, { error: 'Comments are not configured' });

		let token;
		try {
			const response = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
			if (!response.ok) return send(res, 401, { error: 'Invalid credential' });
			token = await response.json();
		} catch { return send(res, 401, { error: 'Invalid credential' }); }
		const expiresAt = Number(token.exp) * 1000;
		if (token.aud !== expectedAud || token.email_verified !== 'true' || !token.sub || !Number.isFinite(expiresAt) || expiresAt <= now()) {
			return send(res, 401, { error: 'Invalid credential' });
		}

		let result;
		writeQueue = writeQueue.then(async () => {
			const rows = await loadRows(dataFile);
			const cutoffMinute = now() - 60_000;
			const cutoffDay = now() - 86_400_000;
			const mine = rows.filter((row) => row.sub === token.sub && Date.parse(row.createdAt) > cutoffDay);
			if (mine.some((row) => Date.parse(row.createdAt) > cutoffMinute)) return { status: 429, value: { error: 'Please wait before commenting again' } };
			if (mine.length >= 30) return { status: 429, value: { error: 'Daily comment limit reached' } };
			const row = {
				id: randomUUID(), path, name: String(token.name || token.email || 'Google user').slice(0, 120),
				avatar: typeof token.picture === 'string' ? token.picture.slice(0, 1000) : '', email: String(token.email || ''),
				sub: String(token.sub), body: cleanBody, createdAt: new Date(now()).toISOString(), hidden: false,
			};
			await mkdir(dirname(dataFile), { recursive: true });
			await appendFile(dataFile, `${JSON.stringify(row)}\n`, 'utf8');
			notifyImpl(row);
			return { status: 201, value: publicRow(row) };
		});
		try { result = await writeQueue; } catch { return send(res, 500, { error: 'Could not save comment' }); }
		return send(res, result.status, result.value);
	};
}

export const handleComments = createCommentsHandler();

export async function setCommentHidden(id, hidden, dataFile = DEFAULT_DATA_FILE) {
	const rows = await loadRows(dataFile);
	const row = rows.find((item) => item.id === id);
	if (!row) return false;
	row.hidden = hidden;
	await mkdir(dirname(dataFile), { recursive: true });
	const temporary = `${dataFile}.${process.pid}.${Date.now()}.tmp`;
	await writeFile(temporary, rows.map((item) => JSON.stringify(item)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
	await rename(temporary, dataFile);
	return true;
}

export { DEFAULT_DATA_FILE, loadRows };
