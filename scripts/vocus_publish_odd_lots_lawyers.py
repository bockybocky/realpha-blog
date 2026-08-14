# -*- coding: utf-8 -*-
"""Odd Lots 律師集心得 — lexical JSON + vocus HTML，PATCH 草稿與 metadata。
用法：python vocus_publish_odd_lots_lawyers.py [--publish]
草稿由 POST /api/articles 建立（2026-07-15 首次探通的端點）。
"""
import json, math, sys, datetime, re, os
import urllib.request

S = os.environ.get('VOCUS_SP') or r'C:\Users\Charles\scripts\blog_auto'
TOK = open(os.path.join(S, 'vocus_token.txt'), encoding='utf-8').read().strip()
AID = '6a574ad2fd8978000123aacc'
IMG_URL = 'https://images.vocus.cc/9adace1f-a8b5-4484-9762-5a67e411614c.png'
IMG_W, IMG_H = 2048, 1152
TITLE = 'AI 讓律師更忙：聽 Odd Lots 這集的傑文斯悖論現場直播'
ABSTRACT = ('Bloomberg 財經 podcast《Odd Lots》請來大型律所主席 Gary Wingens：'
            '盡職調查成本砍七成、案子反而變多；時薪年漲 10%、客戶總價卻下降。'
            '一集把「AI 到底搶不搶工作」講成了經濟學現場——加上我自己一人公司的印證心得。')
TAGS = ['Odd Lots', 'AI', '傑文斯悖論']
CATEGORY = {'_id': '5a978e00fd897800016874cc', 'title': '投資理財', 'score': 0}

# ---------- helpers ----------
def parse_runs(text):
    parts = re.split(r'\*\*(.+?)\*\*', text)
    runs = []
    for i, seg in enumerate(parts):
        if seg == '':
            continue
        fmt = 1 if i % 2 == 1 else 0
        runs.append((seg, fmt))
    return runs

# ---------- 文章內容定義 ----------
BLOCKS = [
    ('img',),
    ('poem_lines', [
        '北冥有魚，其名為鯤。',
        '化而為鳥，其名為鵬。',
        '—— 《莊子・逍遙遊》',
    ]),
    ('h3', '先推坑：Odd Lots 是什麼'),
    ('p', '先花一分鐘介紹這個節目，因為它值得。'),
    ('p', '《Odd Lots》是 Bloomberg 的旗艦財經 podcast，主持人是 Joe Weisenthal 和 Tracy Alloway——兩位彭博老將，風格是「對世界運作的細節有無窮的好奇心」。別的財經節目在聊漲跌，他們在聊迴紋針供應鏈、電網變壓器交期、鈾濃縮產能這種「市場真正的水管工程」。一週數集、集集一小時上下，來賓從央行官員、對沖基金經理到碼頭工會主席都有。'),
    ('p', '我自己固定在追這個節目，這一集聽完，覺得必須寫一篇。'),
    ('p_cta', [
        ('原集連結（強烈建議聽原文）：', None),
        ('Why AI Might Actually Create More Work for Lawyers', 'https://omny.fm/shows/odd-lots/why-ai-might-actually-create-more-work-for-lawyers'),
        ('（55 分鐘）', None),
    ]),
    ('h3', '這集在講什麼'),
    ('p', '來賓是 **Gary Wingens，Lowenstein Sandler 的主席（chair）**——一家美國大型律師事務所的最高管理者。律師業是「按小時賣時間」的行業原型，理論上是 AI 最該摧毀的商業模式。結果他上節目講的卻是：AI 讓他們更忙、更賺。'),
    ('p', '一集聽下來，就是一堂傑文斯悖論（Jevons Paradox）的現場直播。'),
    ('h3', '摘要重點'),
    ('ul', [
        '**成本砍七成，案子從「不做」變「做」**：一個要審閱數千份信託協議的案子，三年前報價約一千萬美元，客戶嫌風險報酬不划算而拒絕；AI 把成本壓到約三百萬後，客戶立刻點頭。工作不是消失了，是**原本因太貴而不存在的需求被解鎖了**——這就是傑文斯悖論：效率提升反而放大總消耗。',
        '**專利業務翻四倍**：客戶的工程師自己也在用 AI，發明產出暴增，內部專利申請需求翻了四倍。AI 在供給端降成本的同時，也在需求端造需求——兩頭一起燒。',
        '**時薪不跌反漲**：2025 年美國大型律所平均時薪年增 10.1%（同期通膨約 3%）。但注意另一半：完成同一個案子所需的「小時數」大幅下降，所以**客戶付的總價在跌、律師每小時的價值在漲**。「時間」貶值、「判斷」增值——這個剪刀差我認為會出現在所有專業服務業。',
        '**兩年內的態度大反轉**：兩年前，執業過失保險的承保人問「你們有沒有讓律師用 AI（風險）」；現在問「你們有沒有**確保**律師用 AI」。客戶從「不准用 AI 碰我的案子」變成「你們必須用 AI 幫我省錢」。合規紅線只剩一條：在法庭引用 AI 幻覺出來的假判例，非常丟臉。',
        '**自建大模型不划算**：同業有律所宣布五年砸五億美元建 AI 基礎設施，Wingens 算給你聽：從零訓練一個前沿模型要十五億起跳，追不上的；他們選擇在現成模型上疊自己的領域層（自家的條款庫、歷史訴狀檢索）。**護城河不在模型，在你餵給模型的獨家語料。**',
        '**定價模式的預告**：目前法律 AI 工具多是吃到飽訂閱，即將轉向按用量計費——他坦承整個行業「還不知道 AI 服務的真實成本」。這句話我聽到的是：AI 的成本發現（price discovery）才剛開始。',
    ]),
    ('h3', '延伸想法'),
    ('p', '**一、我自己就是傑文斯悖論的樣本。** 我一人公司，AI 沒有讓我的工作變少——它讓我把「一個人不可能做」的事全部排上了日程：自建市場資料庫、研究素材庫、多模型工程團隊。效率提升 → 野心變大 → 總工作量上升。律師如此，個人如此，我猜企業的 IT 預算也將如此。'),
    ('p', '**二、對投資人的觀察框架（教育性，非建議）**：這集提供了一個很乾淨的檢驗問題——看一家公司談 AI 時，它講的是「省了多少成本」還是「解鎖了多少原本不划算的需求」？前者是防守，會被競爭馬上抹平（Wingens 那個案子省下的七成，最後大多會變成客戶的價格談判籌碼）；後者才是成長故事。傑文斯悖論成立的地方，算力和 token 的消耗只會越燒越多——這也是我持續關注 AI 基礎設施鏈的原因。'),
    ('p', '**三、「時間貶值、判斷增值」是每個專業工作者的個人課題。** 律師的計費小時如此，投資研究也如此：AI 把找資料、整理、比對的時間成本打到趨近於零之後，剩下值錢的只有兩件事——問對問題，和為結論負責。這半年我把自己的工作重心從「做」搬到「規格與驗收」，體感和 Wingens 講的完全同構。'),
    ('h3', '可以參考的資料'),
    ('ul', [
        '原集：Odd Lots — Why AI Might Actually Create More Work for Lawyers（各大 podcast 平台搜 Odd Lots 都有；連結見上方）',
        '想入坑 Odd Lots：從你有領域知識的那集開始聽，體驗「原來這行的水管長這樣」的快感',
        '傑文斯悖論的出處：William Stanley Jevons《The Coal Question》(1865)——蒸汽機效率提升，煤的總消耗反而暴增',
    ]),
    ('p_italic', '本文為聽後心得與教育性討論，非投資建議。文中提及之公司與產品僅為節目內容脈絡，未持有相關未上市公司權益；上市公司部分請自行研究。引用內容版權屬原節目所有，鼓勵收聽原文。'),
    ('p_cta', [
        ('AI 時代觀點氾濫、驗證稀缺——我把自己的市場判讀公開公證、到期對答案：', None),
        ('驗證簿', 'https://blog.getrealpha.com/ledger'),
        ('。也歡迎', None),
        ('出題', 'https://blog.getrealpha.com/propose'),
        ('，一起篩真實資訊。', None),
    ]),
]

# ---------- Lexical builders（照抄 my_ai_engineering_team 模板）----------
def t_node(text, fmt=0):
    return {'detail': 0, 'format': fmt, 'mode': 'normal', 'style': '', 'text': text, 'type': 'text', 'version': 1}

def para(children):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'paragraph', 'version': 1, 'textFormat': 0, 'textStyle': ''}

def heading(text):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'vocus-heading', 'version': 1, 'tag': 'h3'}

def image_node():
    return {'type': 'image', 'version': 1, 'format': '', 'src': IMG_URL, 'position': 'center',
            'width': IMG_W, 'height': IMG_H, 'source': None,
            'captionObj': {'root': {'children': [], 'direction': None, 'format': '', 'indent': 0, 'type': 'root', 'version': 1}}}

def linebreak():
    return {'type': 'linebreak', 'version': 1}

def link_node(text, url):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'link', 'version': 1, 'rel': None, 'target': None, 'title': None, 'url': url}

def listitem(children, value):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'listitem', 'version': 1, 'value': value}

def list_node(items, ordered):
    children = []
    for i, item in enumerate(items):
        runs = parse_runs(item) if isinstance(item, str) else item
        children.append(listitem([t_node(txt, fmt) for txt, fmt in runs], i + 1))
    return {'children': children,
            'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'list', 'version': 1,
            'listType': 'number' if ordered else 'bullet', 'start': 1, 'tag': 'ol' if ordered else 'ul'}

lex_children = []
for b in BLOCKS:
    kind = b[0]
    if kind == 'img':
        lex_children.append(image_node())
    elif kind == 'poem_lines':
        kids = []
        for i, line in enumerate(b[1]):
            if i:
                kids.append(linebreak())
            kids.append(t_node(line, 2))
        lex_children.append(para(kids))
    elif kind == 'p':
        lex_children.append(para([t_node(seg, fmt) for seg, fmt in parse_runs(b[1])]))
    elif kind == 'p_italic':
        lex_children.append(para([t_node(seg, 2) for seg, _fmt in parse_runs(b[1])]))
    elif kind == 'p_cta':
        kids = []
        for text, url in b[1]:
            if url is None:
                kids.append(t_node(text))
            else:
                kids.append(link_node(text, url))
        lex_children.append(para(kids))
    elif kind == 'h3':
        lex_children.append(heading(b[1]))
    elif kind == 'ol':
        lex_children.append(list_node(b[1], True))
    elif kind == 'ul':
        lex_children.append(list_node(b[1], False))

lexical_obj = json.dumps({'root': {'children': lex_children, 'direction': 'ltr', 'format': '',
                                   'indent': 0, 'type': 'root', 'version': 1}}, ensure_ascii=False)

# ---------- HTML builder ----------
def runs_html(text):
    out = []
    for seg, fmt in parse_runs(text):
        seg_esc = seg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        out.append(f'<strong>{seg_esc}</strong>' if fmt == 1 else seg_esc)
    return ''.join(out)

html_parts = []
plain_text = []
for b in BLOCKS:
    kind = b[0]
    if kind == 'img':
        html_parts.append(f'<figure class="image"><img src="{IMG_URL}" width="{IMG_W}" height="{IMG_H}"></figure>')
    elif kind == 'poem_lines':
        inner = '<br>'.join(f'<em>{l}</em>' for l in b[1])
        html_parts.append(f'<p>{inner}</p>')
        plain_text.extend(b[1])
    elif kind == 'p':
        html_parts.append(f'<p>{runs_html(b[1])}</p>')
        plain_text.append(re.sub(r'\*\*', '', b[1]))
    elif kind == 'p_italic':
        html_parts.append(f'<p><em>{runs_html(b[1])}</em></p>')
        plain_text.append(re.sub(r'\*\*', '', b[1]))
    elif kind == 'p_cta':
        kids = []
        for text, url in b[1]:
            if url is None:
                kids.append(runs_html(text))
            else:
                kids.append(f'<a href="{url}" target="_blank" rel="noopener">{text}</a>')
            plain_text.append(text)
        html_parts.append('<p>' + ''.join(kids) + '</p>')
    elif kind == 'h3':
        html_parts.append(f'<h3>{b[1]}</h3>')
        plain_text.append(b[1])
    elif kind in ('ul', 'ol'):
        tag = b[0]
        lis = ''.join(f'<li>{runs_html(item)}</li>' for item in b[1])
        html_parts.append(f'<{tag}>{lis}</{tag}>')
        plain_text.extend(re.sub(r'\*\*', '', i) for i in b[1])

content_html = ''.join(html_parts)
words = len(''.join(plain_text))
reading = max(1, math.ceil(words / 600))

# ---------- API ----------
def api(method, path, body):
    r = urllib.request.Request('https://api.vocus.cc' + path, method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc', 'Referer': 'https://vocus.cc/'})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='replace')

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

st, body = api('PATCH', f'/api/articles/{AID}/draft', {
    'title': TITLE, 'lexicalObj': lexical_obj, 'articleId': AID,
    'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
print('draft PATCH:', st, body[:120])

st, body = api('PATCH', f'/api/articles/{AID}', {
    'title': TITLE,
    'content': content_html,
    'contentConvertedAt': now,
    'catalog': '[]',
    'showCatalog': True,
    'wordsCount': words,
    'readingTime': reading,
    'abstract': ABSTRACT,
    'thumbnailUrl': IMG_URL,
    'noThumbnailImage': False,
    'ogImageType': 'thumbnail',
    'coverSource': 'upload',
    'tags': [{'title': t} for t in TAGS],
    'newCategory': CATEGORY,
    'isInvestment': True,
    'setInvestment': True,
    'adult': False,
    'lexicalObj': lexical_obj,
})
print('metadata PATCH:', st, body[:120])

# readback
r = urllib.request.Request(f'https://api.vocus.cc/api/article/{AID}',
    headers={'Authorization': f'Bearer {TOK}', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(r, timeout=20) as resp:
    a = json.loads(resp.read()).get('article', {})
print(f"readback: status={a.get('status')} | cat={a.get('newCategory',{}).get('title')} | inv={a.get('isInvestment')} | thumb={str(a.get('thumbnailUrl'))[:70]} | words={a.get('wordsCount')}")

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('publish:', st, body[:80] if body else '(204)')
