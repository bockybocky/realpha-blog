# -*- coding: utf-8 -*-
"""股癌 EP679 心得 — lexical JSON + vocus HTML，PATCH 草稿與 metadata。
用法：python vocus_publish_gooaye_ep679.py [--publish]
草稿由 POST /api/articles 建立。AID/IMG 由發佈流程填入。
"""
import json, math, sys, datetime, re, os
import urllib.request

S = r'D:\Temp\claude\C--Users-Charles\e7dd9726-6186-4aa3-a8b1-0d28b75c5c5c\scratchpad'
TOK = open(os.path.join(S, 'vocus_token.txt'), encoding='utf-8').read().strip()
AID = '6a575e45fd8978000127eda5'
IMG_URL = 'https://images.vocus.cc/f2a85bba-f8a9-40e4-bd88-917ed208c68a.png'
IMG_W, IMG_H = 2048, 1152
TITLE = '聽股癌 EP679：這波下殺不是基本面，是槓桿在斷頭'
ABSTRACT = ('股癌最新一集把近期全球震盪的病根講得很白：韓國高槓桿散戶爆倉引發的連鎖去槓桿，'
            '不是中東、不是通膨。加上動能策略暫時失效、載板封測的實質缺貨、'
            'AI 工具的幻覺成本——摘要重點與我們的應用心得。')
TAGS = ['股癌', '去槓桿', '風險控管']
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
        '飄風不終朝，',
        '驟雨不終日。',
        '—— 《老子・二十三章》',
    ]),
    ('h3', '這集在講什麼'),
    ('p', '股癌 EP679（2026-07-15）。一句話：**近期這波全球下殺的病根不是中東戰爭、不是通膨，是韓國高槓桿散戶爆倉引發的連鎖去槓桿**；在動能策略暫時失效、資金輪動極快的盤整期，主委的建議是縮小部位、控管下檔，把目光放到有實質業績支撐的載板與封測族群。'),
    ('p', '前半段還有一段很有意思的 AI 使用心得：通用型 AI 工具在專業領域的幻覺與成本陷阱——這段跟投資無關，跟每個在用 AI 工作的人都有關。'),
    ('p', '**原節目**：各大 podcast 平台搜「股癌」EP679（約一小時），強烈建議聽原文，本文只是我的聽後整理與心得。'),
    ('h3', '摘要重點'),
    ('ul', [
        '**下殺的真兇是「誰在賣」不是「發生什麼事」**：韓國投資圈慣用極高槓桿（信貸疊加可達十倍以上），盤勢一回檔就觸發爆倉斷頭 → 流動性踩踏 → 全球連鎖。搞清楚賣壓的來源是槓桿清算而非基本面惡化，對「該恐慌還是該撿」的判斷完全不同。',
        '**台灣券商同步收緊風控**：劇烈波動加上零星違約交割，讓券商開始限縮中小型股融資與不限用途借貸——市場的資金動能被行政手段再收一層。',
        '**動能策略暫時失效**：過去半年「追強勢股」的打法在震盪盤被雙巴。資金從功率、被動元件流出，快速切到矽晶圓、設備、載板，強勢股越來越少、輪動越來越快。',
        '**真缺貨的地方還是真缺貨**：載板與 CCL 從去年缺到現在、報價持續上漲還有轉單效應；封測（含 MOSFET 封裝與台積電後段外包）稼動率滿載、漲價可期。被動元件的重挫是估值修正不是基本面反轉——交期還在拉長。',
        '**個股層面**：台積電是動盪期的資金避風港，法說展望是突破區間的關鍵；力積電法說揭露功率封裝產線滿載已久；精材在封測輪動中瘋狂表態；華新科的下跌屬漲多修正，MLCC 供給仍緊。',
        '**AI 段落**：主委實測通用 AI 在專業領域（他舉辨識高價酒款）容易幻覺、錯誤定價，反覆驗證還會狂燒 token；把 AI 盲目用在合約、法規這類嚴謹工作上「可能帶來巨大危險」。',
        '**操作啟示兩條**：一是別再無腦滿倉，跌破重要均線且反彈無力就果斷減碼、拉高現金，別重演 2022 年凹單回吐；二是研究一檔股票太深會「暈船」（看什麼都像利多），唯一能踩煞車的是市場走勢——買進後毫無起色甚至破底，就謙卑接受市場的態度矯正。',
    ]),
    ('h3', '延伸想法'),
    ('p', '**一、「辨識賣壓來源」是被低估的基本功。** 同樣是跌 5%，「基本面壞了」和「別人的槓桿在斷頭」是兩種完全不同的事件。前者該重估持股邏輯，後者反而是檢驗你部位大小合不合理的壓力測試——如果別人的斷頭就能把你嚇出場，那是你的倉位錯了，不是市場錯了。'),
    ('p', '**二、動能失效期就是紀律的考期。** 順風期人人都是股神，這種快輪動、雙巴盤才看得出誰有風控。主委說的「縮小部位、控下檔」跟我們一直寫的停損哲學是同一件事：保住本金等於保住翻身能力。'),
    ('p', '**三、「暈船」的解藥是把打臉制度化。** 研究越深越容易愛上標的，這是人性不是缺陷——所以解法不是「不要暈」，而是設計一個你賴不掉的對答案機制：寫下進場理由和失效條件，到期公開對答案。我們做驗證簿就是為了這個。'),
    ('h3', '對我們的應用'),
    ('ol', [
        '**波動歸因先於反應**：看到持股大跌，第一個問題不是「要不要跑」，是「這是誰在賣、為什麼賣」。槓桿清算型的下殺，重點檢查自己的倉位承受度；基本面型的下殺，重點重跑投資邏輯。兩套完全不同的 SOP，混用會在錯的時間做錯的事。',
        '**輪動快的時候，「故事」和「缺貨」要分開記帳**：光通訊在找新故事、載板封測是真缺貨——一個是資金行為，一個是產業事實。把兩者記在同一本帳上，就會在故事退潮時錯殺事實，或在事實兌現前誤信故事。',
        '**AI 幻覺不是趣聞，是成本項**：主委辨酒的例子跟我們天天遇到的一模一樣——AI 給的答案要驗證，驗證要花時間和運算成本，而「看起來很對」的錯誤最貴。任何把 AI 接進嚴謹流程的人，驗收機制的成本要一開始就算進去，不能事後補。',
    ]),
    ('h3', '可以參考的資料'),
    ('ul', [
        '原節目：《股癌 Gooaye》EP679，各大 podcast 平台（Spotify／Apple Podcasts／SoundOn）',
        '想系統性理解「去槓桿連鎖」：可回顧 2021 年 Archegos 事件的事後分析，機制同構、規模不同',
    ]),
    ('p_cta', [
        ('我們的舊文互參：', None),
        ('兩種停損哲學', 'https://blog.getrealpha.com/blog/two-stop-loss-philosophies'),
        ('（部位上限那一派，正是這集的處方）。', None),
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
