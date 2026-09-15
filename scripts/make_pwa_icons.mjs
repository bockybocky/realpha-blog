// PWA 圖示產生器（2026-09-15）：把 public/brand/logo-mark.svg 畫在手帳底色上，輸出到 public/icons/。
// 用法：node scripts/make_pwa_icons.mjs          產生四張 png
//       node scripts/make_pwa_icons.mjs --check  只驗證四張檔存在且尺寸正確（不重畫）
// 一般圖示（purpose any）：標誌寬度佔 80%；可遮罩圖示（maskable）：四邊各留 20%，標誌只放中間 60%，
// 被 Android 裁成圓形或圓角方形時不會切到。產出很小，直接進 git，不放進 build。
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'public', 'brand', 'logo-mark.svg');
const OUT = join(root, 'public', 'icons');
const BG = '#f6f5f1';

export const ICONS = [
	{ file: 'icon-192.png', size: 192, content: 0.8 },
	{ file: 'icon-512.png', size: 512, content: 0.8 },
	{ file: 'maskable-192.png', size: 192, content: 0.6 },
	{ file: 'maskable-512.png', size: 512, content: 0.6 },
];

async function render({ file, size, content }, svg) {
	const box = Math.round(size * content);
	const mark = await sharp(svg, { density: 300 })
		.resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer();
	await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
		.composite([{ input: mark, gravity: 'center' }])
		.flatten({ background: BG })
		.png({ compressionLevel: 9 })
		.toFile(join(OUT, file));
}

async function check() {
	for (const icon of ICONS) {
		const meta = await sharp(join(OUT, icon.file)).metadata();
		assert.equal(meta.width, icon.size, `${icon.file} 寬度`);
		assert.equal(meta.height, icon.size, `${icon.file} 高度`);
		assert.equal(meta.format, 'png', `${icon.file} 格式`);
		// 角落必須是手帳底色（maskable 被裁切時露出的就是這一塊）
		const { data } = await sharp(join(OUT, icon.file)).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
		assert.deepEqual([...data.subarray(0, 3)], [0xf6, 0xf5, 0xf1], `${icon.file} 角落底色`);
		console.log(`ok ${icon.file} ${meta.width}x${meta.height}`);
	}
	console.log('make_pwa_icons self-check ok');
}

if (!process.argv.includes('--check')) {
	await mkdir(OUT, { recursive: true });
	const svg = await readFile(SRC);
	for (const icon of ICONS) await render(icon, svg);
}
await check();
