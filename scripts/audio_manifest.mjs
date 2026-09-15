// 掃 public/audio/*.mp3，對到存在的文章，輸出 src/data/audio.json：{ key: { src, bytes, seconds } }
//   <slug>.mp3    → 中文版文章，key = <slug>
//   <slug>.en.mp3 → 英文版文章，key = <slug>.en
//   node scripts/audio_manifest.mjs
//   node scripts/audio_manifest.mjs --self-test
// 時長用 ffprobe 量；量不到只填大小、seconds=null 並警告。任何狀況都不讓 build 失敗：最壞輸出 {}。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishedKeys } from './build_popular.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 'x.mp3' → {lang:'zh-TW', slug:'x', key:'x'}；'x.en.mp3' → {lang:'en', slug:'x', key:'x.en'}；其餘 null */
export function parseAudioName(name) {
	const m = name.match(/^(.+?)(\.en)?\.mp3$/i);
	if (!m) return null;
	return m[2] ? { lang: 'en', slug: m[1], key: `${m[1]}.en` } : { lang: 'zh-TW', slug: m[1], key: m[1] };
}

/** ffprobe 量秒數；沒有 ffprobe 或讀不出來回 null */
export function ffprobeSeconds(file) {
	try {
		const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 30000,
		});
		const sec = Number.parseFloat(out.trim());
		return Number.isFinite(sec) && sec > 0 ? Math.round(sec) : null;
	} catch {
		return null;
	}
}

export async function run({ audioDir, contentDir, outFile, probe = ffprobeSeconds }) {
	const manifest = {};
	const warnings = [];
	try {
		if (existsSync(audioDir)) {
			const keys = await publishedKeys(contentDir);
			for (const name of (await readdir(audioDir)).sort()) {
				const a = parseAudioName(name);
				if (!a) continue;
				if (!keys.has(`${a.lang}:${a.slug}`)) {
					warnings.push(`${name} 對不到已發布的${a.lang === 'en' ? '英文' : '中文'}文章，略過`);
					continue;
				}
				const file = join(audioDir, name);
				const bytes = (await stat(file)).size;
				const seconds = probe(file);
				if (seconds === null) warnings.push(`${name} 量不到時長（沒有 ffprobe 或檔案壞了），只填大小`);
				manifest[a.key] = { src: `/audio/${name}`, bytes, seconds };
			}
		}
	} catch (err) {
		warnings.push(`${err?.message ?? err}；輸出 {}`);
		for (const k of Object.keys(manifest)) delete manifest[k];
	}
	await mkdir(dirname(outFile), { recursive: true });
	await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
	return { manifest, warnings };
}

async function selfTest() {
	assert.deepEqual(parseAudioName('a-b.mp3'), { lang: 'zh-TW', slug: 'a-b', key: 'a-b' });
	assert.deepEqual(parseAudioName('a-b.en.mp3'), { lang: 'en', slug: 'a-b', key: 'a-b.en' });
	for (const n of ['a.wav', 'a.mp3.part', '.gitkeep', 'a.en.m4a']) assert.equal(parseAudioName(n), null, n);

	const dir = await mkdtemp(join(tmpdir(), 'audio-'));
	try {
		const content = join(dir, 'content');
		const audio = join(dir, 'audio');
		const out = join(dir, 'audio.json');
		await mkdir(content);
		await mkdir(audio);
		const fm = (slug, lang, draft = false) => `---\ntitle: "x"\nslug: "${slug}"\nlang: "${lang}"\n${draft ? 'draft: true\n' : ''}---\nbody\n`;
		await writeFile(join(content, 'a.zh-TW.mdx'), fm('a', 'zh-TW'));
		await writeFile(join(content, 'a.en.mdx'), fm('a', 'en'));
		await writeFile(join(content, 'b.zh-TW.mdx'), fm('b', 'zh-TW'));
		await writeFile(join(content, 'd.zh-TW.mdx'), fm('d', 'zh-TW', true));
		await writeFile(join(audio, 'a.mp3'), Buffer.alloc(1234));
		await writeFile(join(audio, 'a.en.mp3'), Buffer.alloc(77));
		await writeFile(join(audio, 'b.en.mp3'), Buffer.alloc(5)); // b 沒有英文版
		await writeFile(join(audio, 'd.mp3'), Buffer.alloc(5)); // 草稿
		await writeFile(join(audio, 'ghost.mp3'), Buffer.alloc(5)); // 不存在的文章
		await writeFile(join(audio, 'notes.txt'), 'x');
		const r = await run({ audioDir: audio, contentDir: content, outFile: out, probe: (f) => (f.endsWith('a.mp3') ? 12 : null) });
		assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), {
			a: { src: '/audio/a.mp3', bytes: 1234, seconds: 12 },
			'a.en': { src: '/audio/a.en.mp3', bytes: 77, seconds: null },
		});
		assert.equal(r.warnings.length, 4, r.warnings.join('\n')); // b.en / d / ghost 對不到 + a.en 量不到時長

		// 音檔資料夾不存在 → {}，不丟錯
		const r2 = await run({ audioDir: join(dir, 'nope'), contentDir: content, outFile: out });
		assert.deepEqual(r2.manifest, {});
		assert.equal(await readFile(out, 'utf8'), '{}\n');

		// 網站端的解析規則（src/lib/audio.ts）：audio.json 為主、frontmatter 覆寫
		const { resolveAudio, formatDuration } = await import('../src/lib/audio.ts');
		const m = { a: { src: '/audio/a.mp3', bytes: 1234, seconds: 12 }, 'a.en': { src: '/audio/a.en.mp3', bytes: 77, seconds: null } };
		assert.deepEqual(resolveAudio({ slug: 'a', lang: 'zh-TW' }, m), { src: '/audio/a.mp3', bytes: 1234, seconds: 12 });
		assert.deepEqual(resolveAudio({ slug: 'a', lang: 'en' }, m), { src: '/audio/a.en.mp3', bytes: 77, seconds: null });
		assert.equal(resolveAudio({ slug: 'b', lang: 'zh-TW' }, m), null);
		assert.equal(resolveAudio({ slug: 'b', lang: 'en' }, { b: { src: '/audio/b.mp3', bytes: 1, seconds: 1 } }), null, '英文頁不拿中文音檔');
		assert.deepEqual(resolveAudio({ slug: 'a', lang: 'zh-TW', audioDuration: 99 }, m), { src: '/audio/a.mp3', bytes: 1234, seconds: 99 }, '單欄覆寫');
		assert.deepEqual(
			resolveAudio({ slug: 'a', lang: 'zh-TW', audio: 'https://cdn.example.com/a.mp3', audioBytes: 5, audioDuration: 6 }, m),
			{ src: 'https://cdn.example.com/a.mp3', bytes: 5, seconds: 6 },
			'換了檔案就不沿用 audio.json 的大小與時長',
		);
		assert.deepEqual(resolveAudio({ slug: 'z', lang: 'zh-TW', audio: 'https://cdn.example.com/z.mp3' }, {}), { src: 'https://cdn.example.com/z.mp3', bytes: null, seconds: null });
		assert.equal(formatDuration(null), null);
		assert.equal(formatDuration(59), '0:59');
		assert.equal(formatDuration(754), '12:34');
		assert.equal(formatDuration(3725), '1:02:05');
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
	console.log('audio_manifest self-test: all passed');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	if (process.argv.includes('--self-test')) {
		await selfTest();
	} else {
		const { manifest, warnings } = await run({
			audioDir: join(ROOT, 'public/audio'),
			contentDir: join(ROOT, 'src/content/blog'),
			outFile: join(ROOT, 'src/data/audio.json'),
		});
		for (const w of warnings) console.warn(`[audio_manifest] WARNING ${w}`);
		console.log(`[audio_manifest] ${Object.keys(manifest).length} 個音檔寫入 src/data/audio.json`);
	}
}
