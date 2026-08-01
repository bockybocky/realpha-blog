# -*- coding: utf-8 -*-
"""股癌 EP681 心得 — lexical JSON + vocus HTML，PATCH 草稿與 metadata。
用法：python vocus_publish_gooaye_ep681.py [--publish]
草稿由 vocus_prep_ep681.py（POST /api/articles）建立。
"""
import json, math, sys, datetime, re, os
import urllib.request

S = r'D:\Temp\claude\C--Users-Charles\f8ebc1e4-ccaa-4c72-abfd-b7bff7eec81c\scratchpad'
TOK = open(os.path.join(S, 'vocus_token.txt'), encoding='utf-8').read().strip()
AID = '6a62eb0efd8978000121482b'
IMG_URL = 'https://images.vocus.cc/d5da0707-671b-4760-ae7e-a576174dde80.png'
IMG_W, IMG_H = 1672, 941
TITLE = '聽股癌 EP681：業績全對了，股價卻不一定會漲'
ABSTRACT = ('股癌最新一集的矛盾：AI 供應鏈的基本面幾乎全部 on track、甚至優於預期，'
            '股價卻很難講。主委的處方是規劃多重劇本、躲進便宜有防守的老 AI 與指數。'
            '附摘要重點、Q&A 精華，與一句誠實邊界：點名不是買訊。')
TAGS = ['股癌', '估值', 'AI供應鏈']
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
        '眾人皆醉我獨醒，',
        '舉世皆濁我獨清。',
        '—— 屈原《漁父》（戰國）',
    ]),
    ('h3', '這集在講什麼'),
    ('p', '股癌 EP681（2026-07-22）。整集繞著一個矛盾轉：**AI 供應鏈的基本面幾乎全部 on track，甚至優於預期，但股價就是很難講**。Vera Rubin 要放量、AMD 要發表 Venice、CPU 缺到不行、被動元件月營收年增漂亮——按理該漲的一堆，可是很多形態已經跌壞了。'),
    ('p', '主委的處理方式不是預測，是**規劃多重劇本**：區間盤怎麼打、噴出去怎麼追，都先想好對應標的，等市場之神選邊才上車。中間穿插一段我覺得比行情更值錢的內容——市場回檔時別讓投資綁架生活，還有把槓桿開太大的老教訓。'),
    ('p', '**原節目**：各大 podcast 平台搜「股癌」EP681（約一小時），強烈建議聽原文，本文只是我的聽後整理與心得。'),
    ('h3', '摘要重點'),
    ('ul', [
        '**這波下殺是「大盤沒動、中小型爛掉」**：台指還在四萬多點附近，但櫃買和美國小型科技很多跌了三到五成。主委把它定位成一次「預演」——真正的大回檔還在後面，現在扛不住小壓力測試的人，之後更該擔心。',
        '**「全職投資」指標又應驗**：每次多頭高峰就有人來問槓桿、問要不要全職投資，這次也是，問完直接爆炸。這是很經典的散戶情緒反指標，比任何技術指標都準。',
        '**槓桿的世代通膨**：主委自嘲以前覺得自己開 2.5 倍是玩命之徒，現在的新股民「2.5 倍叫幼幼班」，大家都開超大。這波爆倉斷頭的追繳令，就是壓力測試的結果。',
        '**人道走廊，但別急著慶祝**：反彈上來會撞到一堆均線的套牢賣壓，主流股形態多半跌壞。判準很簡單——彈上來洗一洗還能再攻的才是續強，彈不動又往下掉的就是落隊。',
        '**聰明錢的共識：躲進便宜、有業績、有防守的地方**：老 AI／ODM 的 forward P/E 掉到十倍左右，高本益比的東西被殺最兇（下去三到五成），資金先閃進「就算再跌也只跌一兩成」的便宜貨，也順手閃進台積電和指數當避風港。',
        '**AI 供應鏈的業績牌接連要開**：Vera Rubin 放量、AMD 的 Advancing AI（Helios 機櫃、微軟大單、可能公布 Anthropic 合作）、正式發表 Venice（SP7 CPU）。營收會好幾乎可以確定，會不會漲不確定。',
        '**CPU 才是這一波被低估的瓶頸**：Agentic AI 讓 CPU 對 GPU 的配比從 1:8 一路往 1:4、1:2、甚至有人講 1:1 靠攏，用量暴增。CPU 卡在晶圓產能和記憶體，出貨會慢慢認列。連帶 Socket 這種一對一綁定的零件，每次換代針腳變多、ASP 就往上跳一階。',
        '**Google Frozen v2 晶片**：市場在猜是不是 Marvell 做的 TPU 推論加速晶片（TIA）。主委的態度很清楚——重點不是 Google（自用晶片，營收佔比可忽略），是「誰做這顆」；但這種法人圈早就知道的老梗，能不能催化要打問號。',
        '**Kimi K3 打臉「低算力」敘事**：上一集才說「算力夠用、會被打臉」，一兩天後月之暗面就公告算力要留給老客戶、不夠用。「模型變便宜所以不需要伺服器」的聯想，這次自己破功。',
    ]),
    ('h3', 'Q&A 裡的幾顆真珠'),
    ('ul', [
        '**forward P/E 到底怎麼用**：主委說估值指標「會參考，但不太重要」。關鍵是兩件事——第一，這個故事你到底 buy 不 buy in；第二，有沒有「你知道、但報告裡沒人寫到」的東西，那才是真 alpha，等大家後知後覺地上修，那段落差就是你的純利。至於法人的「恨天高目標價」，他直接當話題行銷看。',
        '**國巨這種「減資慣犯」怎麼看**：主委的答案很成熟——資本市場的好處就是你可以選擇不玩。看不懂就別買，看得懂公司要顧股票、要搞事的，反而有人專門上車。與其事後罵割韭菜，不如一開始就知道自己在買什麼。',
        '**凹單、停損的紀律**：他坦承自己這幾年反而變得不愛硬性停損，因為對研究掌握度有信心。但他特別強調：新手一定要有硬性防呆機制，像磁片放反就插不進去那樣，防止自己被行情牽著走；等有經驗了，才改用「部位上限」來風控。',
        '**800V 機櫃、CDU 題材**：問到 Navitas、Wolfspeed、STM 這些。主委的建議是把相關族群「拉一包」觀察，等哪天它們集體表態（單日 5%、8%、10% 那種），再考慮介入——現在題材太多、資金在縮手，純用蹲的不知道要蹲到什麼時候。',
    ]),
    ('h3', '延伸想法'),
    ('p', '**一、「業績好」和「會漲」是兩本帳。** 這集最核心的一句話，其實是估值錨的白話版：基本面決定的是**下檔**（跌到便宜就有人撿），資金和形態決定的是**上檔的時點**（誰、什麼時候把它拉起來）。把兩者混為一談，就會在「明明業績很好怎麼不漲」的情緒裡浪費時間。好業績不會遲到，但可以缺席一整季。'),
    ('p', '**二、forward P/E 的 alpha 藏在「別人沒寫到的那一段」。** 主委講的其實就是「共識前推論」——當報告裡人人都給四十倍，你要小心自己是最後一隻老鼠；但當你手上有一塊拼圖是所有報告都漏掉的，那才是能賺到的錢。估值倍數本身不是 edge，資訊差才是。'),
    ('p', '**三、回檔期的真正決策是「機會成本」，不是「要不要跑」。** 躲進便宜有防守的東西，本質是拿「上檔的肉」換「下檔的安全」。這筆交易划不划算，取決於你相不相信市場還會再往下捅一刀。沒有標準答案，但至少要意識到自己正在做這筆交換，而不是無意識地追高殺低。'),
    ('h3', '對我們的應用'),
    ('ol', [
        '**估值錨只在便宜端有效，這集又補了一個註腳**：老 AI 掉到十倍才變成聰明錢的避風港，貴的東西業績再好也先被殺。我們的估值錨紀律本來就限定「便宜端才進場」，這集是活生生的市場驗證。',
        '**多劇本規劃 > 單點預測**：主委不賭方向，先把區間盤、噴出盤兩套劇本和對應標的都備好。這跟我們用情境機率、而不是單一目標價做決策是同一套思路——先認清自己無法預測轉折，再設計「不管哪個劇本來都不會太狼狽」的部位。',
        '**部位上限，而不是硬停損**：他從硬性停損轉向部位上限風控，前提是「研究掌握度夠」。這對我們是提醒——風控工具要配得上自己的能力圈，新手用硬防呆、老手用部位管理，用錯了反而傷。',
    ]),
    ('h3', '一句誠實邊界'),
    ('p', '必須講清楚：**podcast 點名一檔股票，不等於買進訊號**。我們自己回測過「被知名 podcast 提及」這個因子，點名後二十日的平均超額報酬只有約 +1%、勝率不到五成——沒有可交易的 alpha。股癌的價值是**敘事情報**：它是台股散戶圈主流情緒的高品質代理人，幫你知道「大家在想什麼」，而不是幫你決定「買什麼」。這集所有個股都只是節目脈絡的轉述，不是推薦。'),
    ('h3', '可以參考的資料'),
    ('ul', [
        '原節目：《股癌 Gooaye》EP681，各大 podcast 平台（Spotify／Apple Podcasts／SoundOn）',
        '想理解「業績好卻不漲」的估值邏輯：可搜尋估值錨（valuation anchor）與資訊不對稱（information asymmetry）兩個關鍵字',
    ]),
    ('p_cta', [
        ('舊文互參：', None),
        ('聽股癌 EP679：這波下殺不是基本面，是槓桿在斷頭', 'https://blog.getrealpha.com/blog/gooaye-ep679-deleveraging-storm'),
        ('（同一波回檔的上半場）。', None),
    ]),
    ('p_italic', '本文為聽後心得與教育性討論，非投資建議；文中個股僅為節目內容轉述脈絡，不構成任何買賣推薦，持有與否請自行研究。引用內容版權屬原節目所有，鼓勵收聽原文。'),
    ('p_cta', [
        ('AI 時代觀點氾濫、驗證稀缺——我把自己的市場判讀公開公證、到期對答案：', None),
        ('驗證簿', 'https://blog.getrealpha.com/ledger'),
        ('。也歡迎', None),
        ('出題', 'https://blog.getrealpha.com/propose'),
        ('，一起篩真實資訊。', None),
    ]),
]

# ---------- Lexical builders ----------
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
