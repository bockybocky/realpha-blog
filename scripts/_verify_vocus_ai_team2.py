# -*- coding: utf-8 -*-
"""三層驗證（standalone，不 import publish 主腳本）。"""
import json
import os
import re
import urllib.request
from urllib.parse import unquote

AID = "6a572c22fd897800011b158a"
S = r"D:\Temp\claude\C--Users-Charles\e7dd9726-6186-4aa3-a8b1-0d28b75c5c5c\scratchpad"
TOK = open(os.path.join(S, "vocus_token.txt"), encoding="utf-8").read().strip()
NEW_HASH = "ee4c5b03-147d-4ec5-99e5-dd08c569d47d"
OLD_HASH = "179424d4-dd04-4e27-8cd5-1c6ca3465df9"
TITLE = "一個人的工程部：我用 Claude Code 指揮 Codex 和 Grok 的實戰紀錄"
DISCLAIMER = "本文寫的是工程工作流，非投資建議。文中提及的工具與服務僅為個人使用經驗分享，與各廠商無利益關係。"

# Expected plain segments (from BLOCKS; ** stripped) — full list for zero-missing check
SEGMENTS = [
    "下君盡己之能，",
    "中君盡人之力，",
    "上君盡人之智。",
    "—— 《韓非子・八經》",
    "起點：訂閱都付了，為什麼只用一家",
    "我是一人公司。投資研究、資料管線、網站、自動化排程，全部自己來。去年開始我同時付著三家 AI 的訂閱——Anthropic 的 Claude、OpenAI 的 Codex、xAI 的 Grok——然後有一天看著帳單發現一件蠢事：我付三份錢，九成的活卻只叫一家做。",
    "另外兩家不是不能幹活，是我沒有給它們一個「上工的制度」。",
    "所以我把整件事重新想了一遍：如果這三家不是三個聊天視窗，而是三個工程師呢？一個當總工程師，兩個當實作產線。總工程師負責想清楚、寫規格、驗收品質；產線負責把規格變成程式碼。這就是我現在每天在跑的架構：Claude Code 當主腦，Codex 和 Grok 當兩條 lane。",
    "這篇寫的不是理論，是這套制度真實運轉幾週之後——包括一個晚上平行交付四個案子，也包括被坑到半夜的部分——留下來的東西。",
    "分工的核心邏輯：貴的出判斷，便宜的出體力",
    "三家模型的訂閱價差很大，能力分佈也不同。這套架構的經濟學只有一句話：最貴的模型負責判斷，便宜的模型負責打字。",
    "主腦（Claude Code）：拆解需求、做架構決策、寫規格書、派工、驗收。它幾乎不寫程式——它寫的每一個字都是「決策」。",
    "實作 lane（Codex、Grok）：拿到規格書，把程式碼打出來，跑基本驗證，回報。",
    "判斷的錯誤會跨專案複利，所以值得用最強的腦；打字的錯誤驗收擋得住，所以交給便宜的手。反過來配就是災難：讓便宜模型做架構決策，省下的訂閱費會用十倍的除錯時間還回去。",
    "還有一個不明顯的紅利：Codex 和 Grok 跟 Claude 不是同一家公司的模型。不同家族的模型不會犯同一種錯，所以主腦驗收 lane 的產出時，天然就是一次跨廠審查。同一份規格丟給兩條 lane 平行做、挑比較好的那份，等於花一份工錢買到三個獨立視角。",
    "三個讓它真的能動的機制",
    "光有分工想法不夠，讓這套架構穩定運轉的是三個紀律。",
    "一、五段式規格書：lane 沒有你的記憶",
    "實作 lane 是全新開機的——它沒聽過你們前面的討論，不知道你的專案脈絡。所以每次派工的規格書必須自帶全部資訊，我固定用五段：",
    "目標（要做什麼，一段話）",
    "檔案（可以動哪些檔案，其他一律不碰）",
    "介面（函數簽名、資料格式，釘死不准改）",
    "約束（專案慣例、紅線、不准碰的東西）",
    "驗收（哪幾條指令跑過才算完成）",
    "寫規格書的過程有一個副作用比規格書本身更值錢：如果一份規格你寫不完，代表那個決策你還沒做。這時候該做的是回去想清楚，而不是把模糊丟給便宜模型自由發揮——它會發揮的。",
    "二、fail-loud：不准靜默代打",
    "lane 會壞。Codex 的執行環境某週直接故障，任何指令都跑不起來。這時候的鐵律是：壞掉就大聲說壞掉，不准偷偷換人做。",
    "你選 Codex 做某件事，是有理由的（成本、能力、想要第二家觀點）。如果系統在它壞掉時靜默換成別家代打，你以為拿到的是 A 家觀點，其實是 B 家——這種資訊污染比開天窗更毒。我的規矩是：lane 不可用就回報不可用，主腦公開改派並記錄在案。",
    "三、驗收鐵律：AI 的完成通知不等於完成",
    "這是整篇文章最貴的一句話。",
    "某天交接文件上寫著「腳本已完成，232 行，安全掃描通過」。我逐項去查：那支腳本根本不存在。不是寫壞了——是從來沒被寫出來過。「安全掃描通過」是真的，因為對一個不存在的目錄掃描，當然什麼都掃不到。",
    "從那天起我的驗收只有一種形式：親手跑驗收指令、逐檔點名交付物、抽查內容。lane 的回報只當線索，不當證據。同一週還有另一個統計：派工的代理人回報「還在等背景任務」然後就下班了，一個晚上發生五次——每一次，真正的狀態都要自己去看才知道。",
    "管 AI 跟管人在這件事上像得可怕：報告寫得越漂亮，越要去現場看。",
    "血淚榜：兩條 lane 的真實性格",
    "幾週相處下來，兩條 lane 像兩個風格迥異的工程師。",
    "Grok 是手快但說明書要讀熟的那種。 它的指令列工具有一串預設行為，每一個都讓我付過學費：預設只出計畫不寫檔案（要加參數關掉）；無人值守模式下遇到權限確認彈窗，沒人按就整個靜默死掉——有一次派工後 34 秒陣亡，什麼都沒留下；換對參數之後，同一個任務 27 分鐘完成整包重構，品質好到挑不出毛病。最陰的一個坑：它的檔案寫入在目標資料夾不存在時會靜默跳過——不建資料夾、不報錯、正常收工，連續三次派工都栽在同一個地方才抓到。",
    "有趣的是，我一度診斷它「對多檔案任務系統性早停」，後來發現多數「早停」其實是權限彈窗卡死的偽裝。錯誤的診斷會寫進你的制度裡變成錯誤的規則，所以坑的紀錄要跟程式碼一樣有版本、能翻案。",
    "Codex 是慢工出細活、而且異常誠實的那種。 它的執行環境故障那週，它試了三個路徑都失敗，最後回報：「我沒有修改任何檔案、沒有呼叫任何服務、沒有偽造驗收結果。」在一個 AI 會一本正經編造成果的時代，這種「我什麼都沒做成」的誠實回報，比能力本身更稀有。它教我的另一課：判斷一個執行環境是否健康，要用會觸發故障路徑的探測（開子程序），不能因為別種任務僥倖成功就推斷「已恢復」——我犯過這個錯，判它復活結果再度陣亡。",
    "成果：一個晚上的產出",
    DISCLAIMER,
]

# Also load remaining segments from publish script text without executing it
src_path = os.path.join(os.path.dirname(__file__), "vocus_publish_my_ai_engineering_team.py")
src = open(src_path, encoding="utf-8").read()
# extract all ('p', '...') and similar with a simple approach: re-find string literals after block kinds
# Better: pull every Chinese-heavy quoted string from BLOCKS region
m = re.search(r"BLOCKS = \[(.*?)\]\n\n", src, re.S)
block_region = m.group(1) if m else ""
quoted = re.findall(r"'((?:\\'|[^']){8,})'", block_region)
# unescape
quoted = [q.encode("utf-8").decode("unicode_escape") if "\\u" in q else q.replace("\\'", "'") for q in quoted]
# normalize **
quoted_plain = [q.replace("**", "") for q in quoted if not q.startswith("http") and q not in ("img", "poem_lines", "h3", "p", "ul", "ol", "p_italic")]

req = urllib.request.Request(
    f"https://api.vocus.cc/api/article/{AID}",
    headers={"Authorization": f"Bearer {TOK}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    art = json.loads(resp.read().decode("utf-8"))
article = art.get("article") or art
content_html = article.get("content") or ""
status = article.get("status")
title = article.get("title")
thumb = article.get("thumbnailUrl") or ""
plain = re.sub(r"<[^>]+>", " ", content_html)
plain = re.sub(r"\s+", " ", plain)
hay = re.sub(r"\s+", "", plain)

print("=== LAYER2 API ===")
print(f"status={status}")
print(f"title={title}")
print(f"thumb={thumb}")
print(f"contentLen={len(content_html)} plainLen={len(plain)}")

missing = []
for i, seg in enumerate(quoted_plain):
    needle = re.sub(r"\s+", "", seg)
    if len(needle) < 4:
        continue
    if needle not in hay:
        missing.append((i, seg[:80]))
print(f"segments_from_script={len(quoted_plain)} missing={len(missing)}")
if missing:
    for i, s in missing[:30]:
        print(f"  MISS[{i}]: {s}")
else:
    print("segment_check: PASS (0 missing)")

# explicit disclaimer
disc_compact = re.sub(r"\s+", "", DISCLAIMER)
print(f"disclaimer_in_plain={DISCLAIMER in plain or disc_compact in hay}")

blacklist = list("开关状态软资报过运点对确决变应仓")
found_simp = []
for ch in blacklist:
    if ch in plain:
        idx = plain.find(ch)
        found_simp.append((ch, plain[max(0, idx - 12) : idx + 13]))
print(f"simplified_hits={len(found_simp)}")
for ch, ctx in found_simp:
    print(f"  SIMP '{ch}' @ ...{ctx}...")
if not found_simp:
    print("simplified_check: PASS")

print(f"content_has_new_hash={NEW_HASH in content_html}")
print(f"content_has_old_hash={OLD_HASH in content_html}")
h3n = len(re.findall(r"<h3\b", content_html, re.I))
uln = len(re.findall(r"<ul\b", content_html, re.I))
oln = len(re.findall(r"<ol\b", content_html, re.I))
imgn = len(re.findall(r"<img\b", content_html, re.I))
print(f"content_counts H3={h3n} UL={uln} OL={oln} img={imgn}")

print("=== LAYER3 PUBLIC (re-fetch anonymous) ===")
html_path = os.path.join(S, "vocus_public_page.html")
req2 = urllib.request.Request(
    f"https://vocus.cc/article/{AID}",
    headers={"User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(req2, timeout=60) as resp:
    html = resp.read().decode("utf-8", errors="replace")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)
print(f"saved bytes={len(html)}")

m = re.search(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
    html,
    re.S,
)
next_data = json.loads(m.group(1)) if m else None
print(f"NEXT_DATA={'present' if next_data else 'MISSING'}")
next_s = json.dumps(next_data, ensure_ascii=False) if next_data else ""

og_m = re.search(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    html,
    re.I,
) or re.search(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    html,
    re.I,
)
og_raw = og_m.group(1) if og_m else ""
# html entities
og_raw = og_raw.replace("&amp;", "&")
og_decoded = unquote(og_raw)
print(f"og_decoded={og_decoded[:220]}")
print(f"og_has_images.vocus.cc={'images.vocus.cc' in og_decoded}")
print(f"og_has_new_hash={NEW_HASH in og_decoded}")
print(f"og_has_old_hash={OLD_HASH in og_decoded}")
print(f"og_is_default={'vocus_og_2025' in og_decoded}")

checks = {
    "title": TITLE in html or TITLE in next_s,
    "/ledger": "/ledger" in html or "/ledger" in next_s,
    "/propose": "/propose" in html or "/propose" in next_s,
    "disclaimer": DISCLAIMER in html or DISCLAIMER in next_s or DISCLAIMER in plain,
    "status2": '"status":2' in next_s or status == 2,
}
print(f"public_checks={checks}")
print(f"api_status={status}")
