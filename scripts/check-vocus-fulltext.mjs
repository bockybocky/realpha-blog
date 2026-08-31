#!/usr/bin/env node
/**
 * 方格子全文守門：部落格中文文章收合後半部並宣稱「全文在方格子」，
 * 這支負責確認那句話是真的——方格子那篇還在、而且真的比部落格露出的多。
 *
 * 2026-08-31 建。為什麼需要它：
 *   收合上線後，每篇文章都在對讀者說「點過去可以讀完」。
 *   若方格子那篇被刪、或發布時只成功一半（DEC-0267 就發生過 build 崩掉導致
 *   狀態沒記錄），讀者點過去會撲空，而我們不會知道——因為部落格這端一切正常。
 *
 * 判定三態（不是二態，抓不到要跟真的壞掉分開）：
 *   ok       文章存在且中文字數 >= 部落格原文的 MIN_RATIO
 *   short    存在但明顯短於原文 → 可能只發了一半
 *   dead     HTTP 失敗或查無文章
 *   unknown  網路層失敗（逾時等）——**不判死**，維持原狀等下次
 *
 * 產物：src/data/vocus-fulltext-status.json，供模板決定要不要收合。
 * 只有 ok 的文章才收合；short/dead/unknown 一律給全文（寧可少導流，不可騙讀者）。
 *
 * 用法：node scripts/check-vocus-fulltext.mjs [--limit N] [--apply]
 *   不加 --apply 只印報告不寫檔。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LINKS = path.join(ROOT, 'src/data/vocus-links.json');
const OUT = path.join(ROOT, 'src/data/vocus-fulltext-status.json');
const POSTS = path.join(ROOT, 'src/content/blog');

// 方格子那篇至少要有部落格原文這個比例的中文字，才算「全文在那裡」。
// 0.7 而非 1.0 的理由：兩邊排版與圖說不同，且方格子版不含程式碼區塊（DEC-0127）。
const MIN_RATIO = 0.7;
const THROTTLE_MS = 1200;

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const limitArg = argv.indexOf('--limit');
const limit = limitArg >= 0 ? Number(argv[limitArg + 1]) : Infinity;

const cjk = (s) => (s.match(/[一-鿿]/g) || []).length;
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');

function localCjk(slug) {
  for (const name of [`${slug}.zh-TW.mdx`, `${slug}.zh-TW.md`]) {
    const p = path.join(POSTS, name);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8').replace(/^---[\s\S]*?\n---/, '');
      return cjk(raw);
    }
  }
  return null;
}

const links = JSON.parse(fs.readFileSync(LINKS, 'utf8'));
const entries = Object.entries(links).slice(0, limit === Infinity ? undefined : limit);
const status = {};
const tally = { ok: 0, short: 0, dead: 0, unknown: 0, no_local: 0 };

for (const [slug, id] of entries) {
  const articleId = typeof id === 'string' ? id : id?.articleId;
  const local = localCjk(slug);
  if (!articleId || local === null) {
    status[slug] = 'no_local';
    tally.no_local += 1;
    continue;
  }
  try {
    const res = await fetch(`https://vocus.cc/article/${articleId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      status[slug] = 'dead';
      tally.dead += 1;
      console.log(`dead   ${slug} (HTTP ${res.status})`);
    } else {
      const remote = cjk(strip(await res.text()));
      const ratio = local ? remote / local : 0;
      if (ratio >= MIN_RATIO) {
        status[slug] = 'ok';
        tally.ok += 1;
      } else {
        status[slug] = 'short';
        tally.short += 1;
        console.log(`short  ${slug} 遠端 ${remote} 字 / 本地 ${local} 字 (${(ratio * 100).toFixed(0)}%)`);
      }
    }
  } catch (e) {
    // 網路層失敗不判死——判死會讓一次逾時就永久關掉那篇的導流
    status[slug] = 'unknown';
    tally.unknown += 1;
    console.log(`unknown ${slug} (${e.name})`);
  }
  await new Promise((r) => setTimeout(r, THROTTLE_MS));
}

console.log(`\n合計 ${entries.length} 篇：ok ${tally.ok}｜short ${tally.short}｜dead ${tally.dead}｜unknown ${tally.unknown}｜無本地檔 ${tally.no_local}`);
console.log(`只有 ok 的會收合，其餘一律給全文（寧可少導流，不可叫讀者去看不存在的全文）。`);

if (apply) {
  fs.writeFileSync(OUT, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  const back = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  console.log(`已寫入 ${path.relative(ROOT, OUT)}（讀回 ${Object.keys(back).length} 筆）`);
} else {
  console.log('（未加 --apply，未寫檔）');
}
