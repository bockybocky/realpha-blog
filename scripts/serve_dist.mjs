import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = 8377;
const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)), 'dist');
const TEXT = 'text/plain; charset=utf-8';

const types = new Map([
	['.html', 'text/html; charset=utf-8'],
	['.css', 'text/css; charset=utf-8'],
	['.js', 'text/javascript; charset=utf-8'],
	['.mjs', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.xml', 'application/xml; charset=utf-8'],
	['.svg', 'image/svg+xml'],
	['.txt', TEXT],
	['.md', TEXT],
	['.png', 'image/png'],
	['.jpg', 'image/jpeg'],
	['.jpeg', 'image/jpeg'],
	['.webp', 'image/webp'],
	['.ico', 'image/x-icon'],
	['.woff', 'font/woff'],
	['.woff2', 'font/woff2'],
]);

function contentType(pathname) {
	if (/^\/llms.*\.txt$/i.test(pathname) || extname(pathname).toLowerCase() === '.md') {
		return TEXT;
	}
	return types.get(extname(pathname).toLowerCase()) ?? 'application/octet-stream';
}

function localPath(pathname) {
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (decoded.includes('\0')) return null;

	const relative = normalize(decoded.replace(/\\/g, '/').replace(/^\/+/, ''));
	const target = resolve(ROOT, relative);
	const rootPrefix = ROOT.endsWith(sep) ? ROOT : `${ROOT}${sep}`;
	return target === ROOT || target.startsWith(rootPrefix) ? target : null;
}

async function fileEntry(pathname) {
	const target = localPath(pathname);
	if (!target) return null;

	const info = await stat(target).catch(() => null);
	if (info?.isFile()) return { path: target, typePath: pathname };
	if (!info?.isDirectory()) return null;

	const index = join(target, 'index.html');
	const indexInfo = await stat(index).catch(() => null);
	return indexInfo?.isFile() ? { path: index, typePath: '/index.html' } : null;
}

async function sendFallback(req, res) {
	const fallback = join(ROOT, '404.html');
	const info = await stat(fallback).catch(() => null);
	if (info?.isFile()) {
		res.writeHead(404, { 'content-type': contentType('/404.html') });
		if (req.method === 'HEAD') res.end();
		else createReadStream(fallback).pipe(res);
		return;
	}

	res.writeHead(404, { 'content-type': TEXT });
	res.end(req.method === 'HEAD' ? undefined : '404 Not Found\n');
}

async function handle(req, res) {
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		res.writeHead(405, { allow: 'GET, HEAD', 'content-type': TEXT });
		res.end('Method Not Allowed\n');
		return;
	}

	const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
	const entry = await fileEntry(url.pathname);
	if (!entry) {
		await sendFallback(req, res);
		return;
	}

	res.writeHead(200, { 'content-type': contentType(entry.typePath) });
	if (req.method === 'HEAD') res.end();
	else createReadStream(entry.path).on('error', () => res.destroy()).pipe(res);
}

function check() {
	assert.equal(contentType('/llms.txt'), TEXT);
	assert.equal(contentType('/llms-full.txt'), TEXT);
	assert.equal(contentType('/blog/research.md'), TEXT);
	assert.equal(contentType('/sitemap-index.xml'), 'application/xml; charset=utf-8');
	assert.equal(contentType('/asset.svg'), 'image/svg+xml');
	assert.ok(localPath('/en/')?.startsWith(ROOT));
	assert.equal(localPath('/..%2fpackage.json'), null);
	console.log('serve_dist self-check ok');
}

if (process.argv.includes('--check')) {
	check();
} else {
	const server = createServer((req, res) => {
		handle(req, res).catch(() => sendFallback(req, res));
	});

	server.on('error', (error) => {
		if (error.code === 'EADDRINUSE') {
			console.error(`${HOST}:${PORT} is already in use`);
			process.exit(1);
		}
		console.error(error.message);
		process.exit(1);
	});

	server.listen(PORT, HOST, () => {
		console.log(`Serving ${ROOT} at http://${HOST}:${PORT}/`);
	});
}
