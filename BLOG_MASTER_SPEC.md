# Realpha Blog 總規格 v1.0（blog.getrealpha.com）

> 2026-07-06 Iris（Fable 5）裁決定案。Charles 授權全自動執行。分四階段（A 建站／B 內容／C 部署／D 管理工具），每階段獨立 codex 派工過 quota gate。

## 目標

個人＋公司的技術與投資研究分享站：繁中/英雙語、SEO＋agent 搜尋雙優化、動畫與資料視覺化展示、開源氛圍（好讀好抄的程式碼）、貼文與留言好管理。

## 架構裁決（已定，不再重議）

| 項 | 裁決 | 理由 |
|---|---|---|
| 框架 | **Astro**（MDX＋content collections＋islands） | 內容站首選：靜態輸出對 SEO/agent 最友善；islands 讓 canvas/D3 demo 只在需要處載入 JS；i18n 官方支援 |
| 雙語 | zh-TW 預設＋ /en/ 前綴；每篇文成對（hreflang 互指），翻譯 AI 輔助＋人審 | SEO 正規做法 |
| 託管 | **本機靜態服務＋既有 Cloudflare Tunnel**（同 seller/patent 模式） | 無 CF API token→GitHub Pages 自訂網域需人工動 DNS（違反全自動）；隧道憑證在手可全自動。原始碼放 GitHub 公開 repo（開源感＋giscus 前提），未來要遷 Pages 隨時可搬 |
| 留言 | **giscus**（GitHub Discussions） | 零伺服器、開源調性、gh CLI 可管理（Iris 也能管）、訪客用 GitHub 帳號＝技術圈受眾天然過濾 |
| 署名 | Realpha 品牌＋固定 handle **Bocky**（連 github.com/bockybocky）＋「AI 研究團隊」協作透明 | Charles 拍板丙案 |
| 管理 | 文章＝git+markdown（CC 原生管理）；`blog-admin` skill（新文/翻譯/建置/發布/留言審核） | 不裝 CMS（YAGNI） |

## 站點結構

```
/            首頁（最新文＋精選 lab）
/blog/       文章（分類 tag：tech / investing / systems）
/lab/        展示頁（canvas、D3、資料視覺化，每個 demo 一頁，島式載入，附原始碼）
/projects/   開源作品集（連 GitHub repo 卡片）
/about/      關於（丙人設：Realpha＋Bocky＋AI 團隊透明說明）
/en/...      以上全部的英文對應
```

## SEO＋Agent 搜尋優化（驗收硬指標）

1. 語意 HTML（article/nav/main、正確 heading 階層）、每頁 title/description、canonical
2. **hreflang 成對互指**（zh-TW/en）＋ x-default
3. JSON-LD：Article（每文）＋ Person（Bocky）＋ Organization（Realpha）＋ BreadcrumbList
4. sitemap.xml、robots.txt（開放 GPTBot/ClaudeBot/PerplexityBot 等 AI 爬蟲，明確 Allow）
5. **llms.txt ＋ llms-full.txt**（agent 搜尋核心：站點導覽＋全文純文字版，建置時自動生成）
6. RSS/Atom 雙語各一
7. OG image（每文自動生成或預設模板）
8. 每篇文提供「純 markdown 原文連結」（`/blog/xxx.md` 可直接 GET——agent 最友善的形式）
9. 效能：Lighthouse ≥95、無阻塞 JS、字型子集化

## 內容與合規

- 投資內容沿用方格子紅線：免費、教育、方法論；不喊單、不給目標價、不做當期個股建議；每篇投資文附免責。
- 程式碼區塊：shiki 高亮＋一鍵複製＋（可行時）連到 GitHub 原始檔。
- 授權：文章 CC BY-NC-SA 4.0；程式碼 MIT（頁尾標示）。

## 部署形態（Phase C）

- 公開 repo：github.com/bockybocky/realpha-blog（gh CLI 建）
- 建置：`npm run build` → dist/ → 本機靜態伺服器（單一實例、開機自啟、掛 overwatch 常駐白名單）
- Tunnel：既有 config.yml 加 ingress `blog.getrealpha.com → http://localhost:<port>`（**此步 Iris 親自做**——動生產隧道，codex 不碰）＋ `cloudflared tunnel route dns`
- 驗收：https://blog.getrealpha.com 200、hreflang/llms.txt/RSS/sitemap 全通、giscus 可留言、Lighthouse 分數

## 風險與緩解

- 本機託管 uptime 依賴這台 PC（有當機史）→ 靜態服務掛開機自啟＋overwatch 白名單；未來可無痛遷 Cloudflare Pages（靜態站零改動）
- 雙語維護成本 → blog-admin skill 把翻譯做成一鍵流程
