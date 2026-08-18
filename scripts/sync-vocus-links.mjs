// 產生 src/data/vocus-links.json：文章代號 → 方格子文章 ID。
// 給 VocusLink 元件用（文章底部的引流區塊）。
// 來源是自動發文管線的紀錄檔；build 前跑一次，新文發布後就會自動有連結。
// 找不到來源檔時不讓建置失敗——只是那批連結會少，站台照常出得去。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SRC = path.join(os.homedir(), 'scripts', 'blog_auto', 'vocus_ids.json');
const POSTS = path.join(process.cwd(), 'src', 'content', 'blog');
const OUT = path.join(process.cwd(), 'src', 'data', 'vocus-links.json');

function main() {
  if (!fs.existsSync(SRC)) {
    console.log(`[vocus-links] 找不到來源 ${SRC}，維持現有對應表`);
    return;
  }
  const ids = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  const slugs = fs
    .readdirSync(POSTS)
    .filter((f) => f.endsWith('.zh-TW.mdx'))
    .map((f) => f.slice(0, -'.zh-TW.mdx'.length));   // 長度用算的，不寫死數字

  const out = {};
  for (const slug of slugs.sort()) {
    const id = ids[slug]?.articleId;
    if (id) out[slug] = id;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const next = JSON.stringify(out, null, 1);
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
  if (prev.trim() === next.trim()) {
    console.log(`[vocus-links] 無變動（${Object.keys(out).length} 筆對應，共 ${slugs.length} 篇）`);
    return;
  }
  fs.writeFileSync(OUT, next);
  console.log(`[vocus-links] 已更新：${Object.keys(out).length} 筆對應，共 ${slugs.length} 篇`);
}

main();
