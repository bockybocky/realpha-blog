import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { createCommentsHandler, loadRows, setCommentHidden } from './comments.mjs';

const temporary = await mkdtemp(join(process.cwd(), '.comments-test-'));
const root = join(temporary, 'dist');
const dataFile = join(temporary, 'comments.jsonl');
const envFile = join(temporary, '.comments.env');
await mkdir(join(root, 'blog', 'test'), { recursive: true });
await writeFile(join(root, 'blog', 'test', 'index.html'), 'ok');
await writeFile(envFile, 'GOOGLE_CLIENT_ID=test-client\n');

let clock = Date.parse('2026-10-04T00:00:00Z');
let tokenMode = 'ok';
const fetchImpl = async () => {
	if (tokenMode === 'fake') return new Response('{}', { status: 400 });
	return new Response(JSON.stringify({ aud: tokenMode === 'aud' ? 'wrong' : 'test-client', email_verified: 'true', exp: String(Math.floor(clock / 1000) + 3600), sub: 'person-1', email: 'secret@example.com', name: 'Tester', picture: 'https://example.com/a.png' }));
};
const handler = createCommentsHandler({ dataFile, envFile, fetchImpl, now: () => clock, notifyImpl: () => {} });
const server = createServer((req, res) => handler(req, res, root));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const post = (body, credential = 'token') => fetch(`${base}/api/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/blog/test/', body, credential }) });

try {
	tokenMode = 'fake'; assert.equal((await post('hello')).status, 401, 'fake token rejected');
	tokenMode = 'aud'; assert.equal((await post('hello')).status, 401, 'aud mismatch rejected');
	tokenMode = 'ok'; assert.equal((await post('x'.repeat(2001))).status, 400, 'overlong body rejected');
	const created = await post('first'); assert.equal(created.status, 201);
	assert.equal((await post('too soon')).status, 429, 'rate limit enforced');
	const response = await fetch(`${base}/api/comments?path=${encodeURIComponent('/blog/test/')}`);
	const comments = await response.json();
	assert.equal(comments.length, 1); assert.equal('email' in comments[0], false, 'GET does not leak email');
	const stored = await loadRows(dataFile); assert.equal(stored[0].email, 'secret@example.com');
	assert.equal(await setCommentHidden(comments[0].id, true, dataFile), true);
	const hidden = await (await fetch(`${base}/api/comments?path=${encodeURIComponent('/blog/test/')}`)).json();
	assert.deepEqual(hidden, [], 'hidden comment omitted');
	console.log('PASS fake token rejected');
	console.log('PASS aud mismatch rejected');
	console.log('PASS overlong comment rejected');
	console.log('PASS per-sub rate limit enforced');
	console.log('PASS GET does not expose email');
	console.log('PASS hidden comment omitted from GET');
	console.log('All comments tests passed');
} finally {
	await new Promise((resolve) => server.close(resolve));
	await rm(temporary, { recursive: true, force: true });
}
