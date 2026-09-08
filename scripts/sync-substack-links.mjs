// 產生 src/data/substack-links.json：文章代號 → Substack 文章網址。
// 給 SubstackLink 元件用（英文文章底部的引流區塊），做法照 sync-vocus-links.mjs。
// 來源是 substack_publish_mdx.py 的台帳；build 前跑一次，新文發上 Substack 後就自動有連結。
// 只收已發布（有 post_id）且網址是 /p/ 的；草稿網址是後台連結，讀者點了進不去。
// 找不到來源檔時不讓建置失敗——只是那批連結會少，站台照常出得去。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SRC = path.join(os.homedir(), 'scripts', 'blog_auto', 'substack_ids.json');
const POSTS = path.join(process.cwd(), 'src', 'content', 'blog');
const OUT = path.join(process.cwd(), 'src', 'data', 'substack-links.json');

function main() {
  if (!fs.existsSync(SRC)) {
    console.log(`[substack-links] 找不到來源 ${SRC}，維持現有對應表`);
    return;
  }
  const ids = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  const slugs = fs
    .readdirSync(POSTS)
    .filter((f) => f.endsWith('.en.mdx'))
    .map((f) => f.slice(0, -'.en.mdx'.length));

  const out = {};
  for (const slug of slugs.sort()) {
    const rec = ids[slug];
    const url = rec?.url;
    if (rec?.post_id && typeof url === 'string' && url.includes('/p/')) out[slug] = url;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const next = JSON.stringify(out, null, 1);
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
  if (prev.trim() === next.trim()) {
    console.log(`[substack-links] 無變動（${Object.keys(out).length} 筆對應，共 ${slugs.length} 篇）`);
    return;
  }
  fs.writeFileSync(OUT, next);
  console.log(`[substack-links] 已更新：${Object.keys(out).length} 筆對應，共 ${slugs.length} 篇`);
}

main();
