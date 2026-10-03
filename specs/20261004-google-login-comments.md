# 規格：部落格留言改 Google 登入（取代 giscus）

## 1. 目標
讀者在文章底部按 Google 登入即可留言，不需 GitHub 帳號。無廣告、資料存本機。

## 2. 檔案
- 新增 `scripts/comments.mjs`：留言接口處理（給 serve_dist.mjs 匯入）。
- 改 `scripts/serve_dist.mjs`：只加「/api/comments 開頭的請求交給 comments.mjs」一段，其他一律不碰。
- 新增 `src/components/Comments.astro`：留言區（列表＋Google 登入按鈕＋輸入框），中英雙語依頁面語言。
- 改 `src/pages/blog/[slug].astro`、`src/pages/en/blog/[slug].astro`：`<Giscus />` 換成 `<Comments />`。Giscus.astro 保留不刪。
- 新增 `scripts/comments_admin.mjs`：命令列 `list`／`hide <id>`／`unhide <id>`。
- 新增 `scripts/test_comments.mjs`：自檢。

## 3. 介面
- `GET /api/comments?path=/blog/<slug>/` → `[{id, name, avatar, body, createdAt}]`（不含 email、不含被隱藏的）。
- `POST /api/comments` JSON `{path, body, credential}`；credential＝Google Identity Services 的 ID token。
  伺服器呼叫 `https://oauth2.googleapis.com/tokeninfo?id_token=...` 驗證：aud 必須等於設定的 client id、email_verified 為真、未過期。
- 設定：`GOOGLE_CLIENT_ID` 從 `C:/Users/Charles/Projects/realpha-blog/.comments.env` 讀（已 gitignore 的檔；不存在時留言區顯示「留言功能準備中」，GET 照常）。前端拿 client id 走 `GET /api/comments/config`。
- 儲存：`data/comments.jsonl`（repo 根目錄下，加進 .gitignore），一行一筆 `{id, path, name, avatar, email, sub, body, createdAt, hidden}`，只追加；hide 用追加一筆狀態紀錄或重寫皆可，但要原子（寫暫存再改名）。

## 4. 限制
- 零新依賴（只用 Node 內建，Node v24）。前端只載 `https://accounts.google.com/gsi/client`。
- 防濫用：body 1～2000 字；同一 sub 每 60 秒最多 1 則、每天最多 30 則；path 必須是 `/blog/` 或 `/en/blog/` 開頭且對應的頁面檔存在於目前服務的資料夾。
- 輸出一律 HTML 跳脫（前端用 textContent，不用 innerHTML 塞使用者內容）。
- 新留言用 `python C:/Users/Charles/scripts/discord_notify.py`（若存在）通知，失敗不影響留言成功；用 spawn 加 windowsHide。
- 不碰 build 腳本、不碰其他頁面、不 git commit、不重啟線上服務。

## 5. 驗收（你要自己跑並貼結果）
1. `node scripts/test_comments.mjs` 全過：至少涵蓋 假 token（mock tokeninfo）被拒／aud 不符被拒／超長被拒／頻率限制／GET 不洩漏 email／hide 後 GET 看不到。
2. `SERVE_DIST_PORT=18377 node scripts/serve_dist.mjs` 起本機測試伺服器，curl GET 一篇已存在文章的 /api/comments 回 `[]`，首頁仍 200。
3. `npx astro check` 或對兩個 [slug].astro 跑建置不報錯（可用 `npx astro build --outDir dist-commenttest` 後刪掉該資料夾）。
