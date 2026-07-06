MODE: worker
WORKDIR: C:/Users/Charles/Projects/realpha-blog
OBJECTIVE: Phase C 部署前段——GitHub 公開 repo＋giscus 佈線＋本機靜態服務與開機自啟（Cloudflare tunnel 與 DNS 不歸你，orchestrator 親做）。

CONTEXT:
- BLOG_MASTER_SPEC.md §部署形態。gh CLI 已登入帳號 bockybocky。port 8377 已確認空閒。
- git repo 已有完整 commit（Phase A+B）。npm run build 可產 dist/。

DELIVERABLES:
1. `gh repo create bockybocky/realpha-blog --public --source . --push`（或等效：建立遠端＋push main）。repo description：Bilingual (zh-TW/en) tech & market-research blog. Astro, agent-search friendly.
2. Discussions 啟用：`gh api repos/bockybocky/realpha-blog -X PATCH -f has_discussions=true`；用 GraphQL 查 Announcements 分類的 category id。
3. giscus 佈線：把 `src/components/Giscus.astro` 的 repo/repoId/category/categoryId 常數填入真值（repoId 用 GraphQL 查）；rebuild 確認 build 綠。**注意**：giscus GitHub App 安裝需要瀏覽器授權（你做不到）——在回報中明列「待 Charles 一鍵安裝」的網址 https://github.com/apps/giscus 即可，元件先佈好（未安裝前留言區顯示載入失敗是預期行為）。
4. 本機靜態服務：寫 `scripts/serve_dist.mjs`——零依賴 node 靜態伺服器（正確 MIME 含 .xml/.svg/.mjs/.txt/.md、404 fallback、僅綁 127.0.0.1:8377、對 /llms*.txt 與 .md 回 text/plain; charset=utf-8）。單一實例保護（port 占用即退出不堆疊）。
5. 開機自啟：`C:/Users/Charles/scripts/realpha_blog_serve.bat`（CRLF、python 寫 bytes、cd 用正斜線引號）→ schtasks `RealphaBlogServe` ONSTART 註冊＋立即手動 Run 一次。
6. 建置更新流程寫進 README（改文 → npm run build → 服務直接吃新 dist，不用重啟）。

WRITE SCOPE:
- src/components/Giscus.astro
- scripts/
- README.md
- C:/Users/Charles/scripts/realpha_blog_serve.bat

ALLOW DIRTY OVERLAP: true

NON-GOALS:
- 不動 cloudflared/tunnel/config.yml/DNS（orchestrator 親做）
- 不動 settings/hooks/其他排程
- 不裝 giscus App（做不到，列待辦連結即可）

VERIFICATION（必跑並貼輸出）:
- `git remote -v` 顯示 github.com/bockybocky/realpha-blog；`gh repo view bockybocky/realpha-blog --json visibility,hasDiscussionsEnabled` 
- rebuild 綠；`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8377/` 與 `/en/` 與 `/llms.txt` 皆 200（服務由 schtasks Run 拉起）
- `schtasks //query //tn RealphaBlogServe` Ready/Running
- 貼 giscus 填入的 repoId/categoryId 值

STOP CONDITIONS:
- gh push 權限失敗／GraphQL 拿不到 id → 停下回報，不要硬繞
