# SPEC：substack_publish_mdx.py — 把部落格英文稿推上 Substack（草稿／發布，含付費牆）

日期：2026-09-03。決策：Charles 拍板「英文版文章放 Substack，收會員費，乙案＝前半免費、後半付費」。
刊物已建好：**Realpha Reads the World**，`https://realphareads.substack.com`（publication id 10864387，user id 304521538）。
全部註解、log、回報用**繁體中文**（禁簡體字）。

## objective

建 `C:/Users/Charles/Projects/realpha-blog/scripts/substack_publish_mdx.py`，介面仿同目錄的 `vocus_publish_mdx.py`（先讀它，照它的結構與台帳寫法）：

```
python substack_publish_mdx.py draft   <slug> [<slug>...]   # 建／更新草稿（不公開）→ 寫 substack_ids.json
python substack_publish_mdx.py publish <slug> [<slug>...]   # 公開（只在 Charles 說「發」之後由主 session 呼叫）
python substack_publish_mdx.py check   <slug>               # 讀回線上草稿，印驗證行
```

來源＝`src/content/blog/<slug>.en.mdx`（唯一來源，不另抄一份）。

## 內容轉換規則

1. **標題**＝frontmatter `title`；**副標**＝frontmatter `tldr`（沒有就用 `description`）。
2. **封面**＝`public/covers/<slug>-cover.png`（找不到就找 `<slug>.png`，再找不到就沿用 `COVERS` 表的寫法留一個對照表；沒封面不擋）。上傳用 `Api.get_image()`，設為草稿 `cover_image`。
3. **正文**＝mdx 內文（去 frontmatter）。**第一個 `![...]()` 封面圖行跳過**（封面已另設）；其他圖片依 DEC-0496 英文版不配圖，遇到就跳過並印 ⚠️。
   支援：H2/H3、段落、`**粗體**`／`*斜體*`、`[連結](url)`、`> 引言`（含 `<br/>` 換行的詩引：每行一段、斜體）、`- ` 清單、`---` 分隔線。用 `substack.post.Post` 的 `heading/paragraph/blockquote/horizontal_rule/add` 組；`from_markdown` 若能吃就用它，但要驗它處理得了 `<br/>` 與粗斜體，不行就自己拆。
4. **付費牆位置（乙案）**：在「延伸想法」那一節的 H2 **前面**插 paywall 節點（`post.add({"type": "paywall"})`）。
   怎麼找那一節：讀 `<slug>.zh-TW.mdx`，找 H2 列表裡第一個標題含「延伸想法」的序號 k（從 0 數），en 檔的第 k 個 H2 前插牆。zh 找不到「延伸想法」→ 退而求其次用 en 檔標題含 `Where I took it`／`Extended`／`What it means`；都沒有 → 不插牆、印 ⚠️、草稿 audience 設 `everyone`。
   插了牆的草稿 `audience` 設 `everyone`（Substack 語意：全體可見、牆下只給付費），**不要**設 `only_paid`。
5. **免責一段**（只對 frontmatter `category: "investing"` 的稿）：在正文最末加一段斜體：
   `This is personal research and educational commentary, not investment advice. Positions may be held in securities mentioned.`
   放在牆的**下面**（付費區內），不算入牆上內容。非投資文不加。
6. **禁**任何字串洩露自家管線（「transcript」「ASR」「pipeline」等自家製程詞若出現在 mdx 本文就原樣保留——那是作者寫的；但工具自己**不要新增**任何說明文字）。

## files

- 新建 `scripts/substack_publish_mdx.py`。
- 台帳 `C:/Users/Charles/scripts/blog_auto/substack_ids.json`：`{slug: {"draft_id": N, "post_id": N|null, "url": ..., "published_at": ...}}`，寫前先讀，已存在 slug 就 **PATCH 同一個 draft_id**（`Api.put_draft`），禁重開。
- 登入：cookie 檔 `C:/Users/Charles/scripts/blog_auto/substack_cookies.json`（陣列，每筆 name/value/domain），組成 `cookies_string` 傳給 `substack.Api(cookies_string=..., publication_url="https://realphareads.substack.com")`。cookie 由 `C:/Users/Charles/scripts/substack_cookies_from_profile.py` 產生（已存在，不要改它）；API 回 401/403 時印「cookie 失效，跑 `python C:/Users/Charles/scripts/substack_cookies_from_profile.py`」並以非零碼結束。
- `.gitignore` 已擋 `blog_auto/substack_cookies.json`；台帳 `substack_ids.json` 可進 git（同 vocus_ids.json 慣例，它在 `~/scripts` 那個 repo）。

## interfaces

- python-substack 已裝（`pip show python-substack`）。先 `inspect.getsource` 讀 `substack.api.Api` 與 `substack.post.Post`，用它們既有的方法；**不要自己打未知端點**，除非 `Post` 缺 paywall 型別——那就用 `post.add({"type": "paywall"})` 並在 `check` 讀回驗證節點真的存在。
- 每次 `draft`／`publish` 後**讀回**（`Api.get_draft(draft_id)`），印一行：
  `[substack] slug=<slug>｜draft_id=N｜標題=<title>｜H2=N｜paywall=<位置序號|無>｜封面=<有|無>｜audience=<everyone|...>｜狀態=<draft|published>｜url=<...>`
- 主 session 呼叫時只看這一行與結束碼。

## constraints

- 禁 `qmd`、禁 git 指令、禁改 `vocus_publish_mdx.py` 與任何既有檔；只建新檔＋台帳。
- 不要 heredoc 內嵌 Python；不加新依賴（python-substack、requests 已有）。
- `publish` 子指令**沒有 Charles 授權不會被呼叫**，但程式本身要能跑；`publish` 前先確認草稿存在且 paywall 位置正確，否則拒發。
- 冪等：同 slug 重跑 `draft` 只更新內容。

## verification

1. `compile()` 過。
2. `python substack_publish_mdx.py draft lunchuizhe-2026-09-01-can-you-still-buy-it` 真跑一次（這篇 en 檔有 `## Where I took it`，zh 檔有 `## 延伸想法`）→ 貼出讀回那一行；paywall 應在第 3 個 H2 之前（H2 序：What the episode is about／The main points／Where I took it…）。
3. `python substack_publish_mdx.py check <同 slug>` 印同一行且與上一步一致。
4. 用 `Api.get_drafts()` 確認台帳裡的 draft_id 存在；**不要 publish**。
5. 回報：新建檔路徑、真跑輸出原文、python-substack 缺什麼能力（如 paywall 型別是否被接受）、不確定處。
