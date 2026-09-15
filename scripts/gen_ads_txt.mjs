// 依 src/data/ads.json 產生或移除 dist/ads.txt。要在 astro build 之後跑（dist 已存在）。
//   node scripts/gen_ads_txt.mjs             正常執行
//   node scripts/gen_ads_txt.mjs --self-test 自檢
// 規則：enabled 且 client 是合法的 ca-pub-數字 → 寫 ads.txt；其餘情況 → 若 dist/ads.txt 存在就刪掉。
// client 格式錯誤只警告不讓 build 失敗（每天兩次自動發文要能過），但也不產生錯的 ads.txt。
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOOGLE_CERT_ID = 'f08c47fec0942fa0';

/** 回傳 ads.txt 內容；不該產生時回傳 null 並附原因 */
export function adsTxtContent(cfg) {
	if (!cfg || cfg.enabled !== true) return { content: null, reason: 'disabled' };
	const client = String(cfg.client ?? '').trim();
	if (!client) return { content: null, reason: 'enabled but client is empty' };
	const m = client.match(/^(?:ca-)?(pub-\d{10,20})$/);
	if (!m) return { content: null, reason: `enabled but client "${client}" is not ca-pub-<digits>` };
	return { content: `google.com, ${m[1]}, DIRECT, ${GOOGLE_CERT_ID}\n`, reason: 'enabled' };
}

export async function run(root) {
	const cfg = JSON.parse(await readFile(join(root, 'src/data/ads.json'), 'utf8'));
	const dist = join(root, 'dist');
	const target = join(dist, 'ads.txt');
	const { content, reason } = adsTxtContent(cfg);
	if (content) {
		if (!existsSync(dist)) {
			console.warn('[gen_ads_txt] dist/ 不存在，略過（要在 astro build 之後跑）');
			return 'skipped';
		}
		await writeFile(target, content, 'utf8');
		console.log(`[gen_ads_txt] wrote dist/ads.txt: ${content.trim()}`);
		return 'written';
	}
	if (reason !== 'disabled') console.warn(`[gen_ads_txt] WARNING ${reason}；不產生 ads.txt`);
	if (existsSync(target)) {
		await rm(target);
		console.log(`[gen_ads_txt] removed dist/ads.txt (${reason})`);
		return 'removed';
	}
	console.log(`[gen_ads_txt] no ads.txt (${reason})`);
	return 'none';
}

async function selfTest() {
	assert.equal(adsTxtContent({ enabled: false, client: 'ca-pub-1234567890123456' }).content, null);
	assert.equal(adsTxtContent({ enabled: true, client: '' }).content, null);
	assert.equal(adsTxtContent({ enabled: true, client: 'garbage' }).content, null);
	assert.equal(adsTxtContent({ enabled: true, client: ' ca-pub-1234567890123456 ' }).content, 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
	assert.equal(adsTxtContent({ enabled: true, client: 'pub-1234567890123456' }).content, 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');

	const root = await mkdtemp(join(tmpdir(), 'gen-ads-'));
	try {
		await mkdir(join(root, 'src/data'), { recursive: true });
		await mkdir(join(root, 'dist'));
		const write = (cfg) => writeFile(join(root, 'src/data/ads.json'), JSON.stringify(cfg));
		await write({ enabled: true, client: 'ca-pub-0000000000000000', slots: {} });
		assert.equal(await run(root), 'written');
		assert.equal(await readFile(join(root, 'dist/ads.txt'), 'utf8'), 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n');
		await write({ enabled: false, client: 'ca-pub-0000000000000000', slots: {} });
		assert.equal(await run(root), 'removed');
		assert.ok(!existsSync(join(root, 'dist/ads.txt')));
		assert.equal(await run(root), 'none');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
	console.log('gen_ads_txt self-test: all passed');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	if (process.argv.includes('--self-test')) await selfTest();
	else await run(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}
