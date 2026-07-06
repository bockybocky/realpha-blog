MODE: worker
WORKDIR: C:/Users/Charles/Projects/realpha-blog
OBJECTIVE: 依 BLOG_MASTER_SPEC.md 完成 Astro 雙語部落格 Phase A（站體＋主題＋SEO/agent 全套＋lab 示範）；上一輪已留部分骨架（astro.config/package.json/src 已在），續建不重砍。npm 長指令請週期性輸出進度訊息（避免 300 秒無輸出被 watchdog 誤殺）。

CONTEXT:
- 先讀 WORKDIR 下 BLOG_MASTER_SPEC.md——所有架構裁決已定，照做不重議。
- node v24 / npm 11 已裝。網路可用（npm install 允許）。
- 環境 Windows + git-bash；PYTHONUTF8 慣例；檔案 UTF-8。

DELIVERABLES（全部在 WORKDIR 內）:
1. Astro 專案（npm create astro 起手＋MDX＋sitemap 整合），i18n：zh-TW 預設根路徑、en 走 /en/ 前綴；content collections：blog（雙語成對，slug 同名跨語）、lab、projects。
2. 版面主題（自製、不用重型 UI 框架；可用極輕量 CSS）：乾淨閱讀向、深淺色自動、行寬適讀、繁中字排（font-family 堆疊含 Noto Sans TC fallback，不外連 Google Fonts——本地子集或系統字型）、手機優先。首頁＝最新文＋精選 lab；頁尾＝授權標示（文 CC BY-NC-SA 4.0／碼 MIT）＋ RSS/GitHub 連結。
3. 程式碼區塊：shiki 高亮＋一鍵複製按鈕（無框架 vanilla JS island）。
4. SEO/agent 全套（照 SPEC §SEO 九條）：hreflang 成對＋x-default、JSON-LD 四型、sitemap、robots.txt（明確 Allow GPTBot/ClaudeBot/Claude-Web/PerplexityBot/Googlebot 等）、雙語 RSS、llms.txt＋llms-full.txt 於 build 時自動生成（integration 或 build script）、每篇文輸出可直接 GET 的 .md 純文字版、OG 預設模板圖（本地生成，不外連服務）。
5. /lab 兩個示範頁（雙語殼、demo 本體共用）：①canvas 粒子/波形動畫 demo ②D3 或原生 SVG 的互動折線圖 demo（用內建假資料）。每頁附「原始碼」摺疊區＋複製鈕。
6. giscus 留言元件（Astro component，repo/category 參數留 config 常數待 Phase C 填）；文章頁掛載。
7. 佔位內容：每 collection 一篇 lorem 雙語佔位文（Phase B 會換掉），確保 build 綠。
8. README.md：專案結構、指令（dev/build/新文流程）、SPEC 連結。
9. `npm run build` 成功，dist/ 產出上述所有 SEO 工件。

WRITE SCOPE:
- src/
- public/
- scripts/
- astro.config.mjs
- package.json
- package-lock.json
- tsconfig.json
- README.md
- .gitignore

ALLOW DIRTY OVERLAP: true

（禁碰 WORKDIR 以外任何路徑；禁改全域 npm config、環境變數、settings、hooks、排程）

NON-GOALS:
- 不部署、不動 Cloudflare/tunnel/DNS、不建 GitHub repo（Phase C）
- 不寫正式文章內容（Phase B）
- 不裝 CMS、不加資料庫

VERIFICATION（必跑並貼輸出）:
- `npm run build` 零錯誤
- dist/ 內存在並抽查內容：sitemap-index.xml（或 sitemap.xml）、robots.txt、llms.txt、llms-full.txt、rss.xml（雙語）、任一文章頁含 hreflang 兩則＋JSON-LD Article＋複製按鈕 markup、對應 .md 純文字版可讀
- 用 node 起 dist 靜態預覽（或 astro preview）curl 首頁與 /en/ 皆 200，然後關掉
- 回報：檔案樹（兩層）＋上述驗證輸出＋任何偏離 SPEC 之處（無則明說）

STOP CONDITIONS:
- npm 網路失敗連 3 次／Astro 版本重大不相容 → 停下回報實況，不要換框架自作主張
