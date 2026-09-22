// 零停機建置（2026-09-23）：建到「沒在服務的那個資料夾」，全部跑完才換指標檔。
//   node scripts/build_swap.mjs          正常執行（npm run build 會叫它）
//   node scripts/build_swap.mjs --check  自檢（不建置）
//
// 中途任何一步失敗 → 直接離開，指標檔不動，線上維持上一版（照樣 200）。
// 舊資料夾不刪：它就是下一次的建置目標，等於兩份輪流用。
// 故意讓它失敗來演練回滾：BLOG_BUILD_FAIL_AT=astro|ads|postbuild|pagefind
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	DIST_DIRS,
	REPO_ROOT,
	buildDistName,
	normalizeDistName,
	otherDistName,
	servingDistName,
	writePointer,
} from './dist_dir.mjs';

const astroBin = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'astro.cmd' : 'astro');

// shell=true 只給 .cmd／npx（Windows 一定要走 shell），node 自己不走——
// node.exe 的路徑含空白（C:\Program Files\nodejs），經 shell 會被切成兩半。
export function steps(target) {
	return [
		{ id: 'astro', cmd: astroBin, args: ['build'], shell: process.platform === 'win32' },
		{ id: 'ads', cmd: process.execPath, args: [join('scripts', 'gen_ads_txt.mjs')], shell: false },
		{ id: 'postbuild', cmd: process.execPath, args: [join('scripts', 'postbuild.mjs')], shell: false },
		{ id: 'pagefind', cmd: 'npx', args: ['-y', 'pagefind@1', '--site', target], shell: process.platform === 'win32' },
	];
}

function run(step, env) {
	if (process.env.BLOG_BUILD_FAIL_AT === step.id) {
		console.error(`[build_swap] 演練：在 ${step.id} 這一步故意失敗`);
		return 1;
	}
	const r = spawnSync(step.cmd, step.args, {
		cwd: REPO_ROOT,
		env,
		stdio: 'inherit',
		shell: step.shell === true,
	});
	if (r.error) {
		console.error(`[build_swap] ${step.id} 起不來：${r.error.message}`);
		return 1;
	}
	return r.status ?? 1;
}

async function main() {
	const serving = servingDistName();
	const target = otherDistName(serving);
	console.log(`[build_swap] 線上服務中＝${serving}／這次建到＝${target}`);

	const env = { ...process.env, BLOG_BUILD_DIR: target };
	for (const step of steps(target)) {
		const code = run(step, env);
		if (code !== 0) {
			console.error(`\n[build_swap] ${step.id} 失敗（exit ${code}）；指標檔不動，線上仍是 ${serving}/`);
			process.exit(code);
		}
	}

	if (!existsSync(join(REPO_ROOT, target, 'index.html'))) {
		console.error(`[build_swap] ${target}/index.html 不存在，不換指標；線上仍是 ${serving}/`);
		process.exit(1);
	}

	await writePointer(target);
	console.log(`[build_swap] 換手完成：線上改服務 ${target}/（舊的 ${serving}/ 留著當下一次的建置目標）`);
}

function check() {
	const s = steps('dist-b');
	assert.deepEqual(s.map((x) => x.id), ['astro', 'ads', 'postbuild', 'pagefind']);
	assert.deepEqual(s.at(-1).args.slice(-2), ['--site', 'dist-b']);
	assert.ok(existsSync(astroBin), `找不到 astro 執行檔：${astroBin}`);
	// 輪流：建置目標永遠不是正在服務的那個
	for (const name of DIST_DIRS) assert.notEqual(otherDistName(name), name);
	assert.equal(normalizeDistName(buildDistName()), buildDistName());
	console.log('build_swap self-check ok');
}

if (process.argv.includes('--check')) check();
else await main();
