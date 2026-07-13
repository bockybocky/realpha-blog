# -*- coding: utf-8 -*-
"""組鏡子計畫文的 lexical JSON + vocus HTML，PATCH 草稿與 metadata。
用法：python vocus_build_publish.py [--publish]
不帶 --publish 只做：上稿(draft PATCH)＋metadata PATCH＋回讀驗證（status 仍為草稿）。
帶 --publish 才打 status/2 公開。
"""
import json, math, sys, datetime, re, os
import urllib.request

S = r'D:\Temp\claude\C--Users-Charles\107fe65d-f20c-4197-b284-8179aa2a48f2\scratchpad'
TOK = open(os.path.join(S, 'vocus_token.txt'), encoding='utf-8').read().strip()
AID = '6a5427cffd897800012ecabb'
IMG_URL = 'https://images.vocus.cc/5ea4fbac-ee89-4311-9e75-69f6b3fb6298.jpg'
IMG_W, IMG_H = 1400, 788
TITLE = '鏡子計畫：我讓 AI 讀完自己 6,139 條指令，它照出一個我不認識的人'
BLOG_URL = 'https://blog.getrealpha.com/blog/ai-mirror-protocol/'
ABSTRACT = ('一段在 AI 社群流傳的提示詞：讓 AI 讀完你電腦裡所有 agent session 紀錄，'
            '用你自己的時間戳回答「你是誰」。這是我跑完 134 天、6,139 條指令之後的紀錄——'
            '包括被自己的紀錄打臉的部分。全程本機，附完整提示詞。')
TAGS = ['AI協作', 'Claude Code', '自我分析', '工作流', '生產力', 'AI工具']
CATEGORY = {'_id': '64abc687fd897800018fa3d4', 'title': '科技', 'score': 0}

# ---------- 文章內容定義 ----------
def R(*runs):
    out = []
    for r in runs:
        out.append(r if isinstance(r, tuple) else (r, 0))
    return out

BLOCKS = [
    ('img',),
    ('poem', '宿昔青雲志，蹉跎白髮年。誰知明鏡裡，形影自相憐。', '—— 張九齡《照鏡見白髮》（唐）'),
    ('p', R('「人會在日記裡說謊，會在諮商室裡表演。但沒有人會對著一個編碼 agent 表演。」')),
    ('p', R('這是那段提示詞開頭的第一句話。我在深夜看到它，貼給了我自己的系統。四個小時後，我對著螢幕說出「我錯了」三個字。')),
    ('p', R('這篇文章記錄整個過程。文末有提示詞完整原文的取得方式，你可以直接複製，貼給你自己的 Claude Code（或任何能讀本機檔案的 AI agent）。')),
    ('h3', '它在做什麼'),
    ('p', R('如果你用 AI agent 工作了一段時間，你的電腦裡躺著一份特別的紀錄：每一條你打給 AI 的指令，帶著時間戳。你蓋了什麼、放棄了什麼、同一件事重打了幾次、凌晨幾點還在修 bug——全部都在。')),
    ('p', R('這份紀錄比日記誠實。因為你打這些字的時候，只想把事情做完，沒想過有一天會有人拿它來分析你。')),
    ('p', R('提示詞讓 AI 分六個階段處理這份紀錄：')),
    ('ol', [
        R(('挖掘', 1), '：找出機器上所有 agent session 檔案，先報清單、等你批准才開始讀'),
        R(('蒸餾', 1), '：用模式掃描（不是整篇讀）萃取證據——重複主題、爛尾墳場、修正模式、重複稅、作息節奏、盲區——每條結論都要附日期收據，出現三次以上才算數'),
        R(('訪談', 1), '：AI 從證據形成假設，但不說出口，改用問題讓你自己撞上答案。你的回答跟紀錄矛盾時，它把收據拿出來'),
        R(('鏡子', 1), '：告訴你你是誰。信念看時數不看宣言，最重的那句話放最後，只說一次'),
        R(('槓桿', 1), '：你的時間死在哪、該外包什麼、只有你能做的是什麼'),
        R(('殘留', 1), '：寫成檔案、改造你的工具，讓明天的系統長得跟「紀錄裡的你」匹配'),
    ]),
    ('h3', '我被照出了什麼'),
    ('p', R('我的資料底：134 天、6,139 條親手打的指令、829 個 session 檔案。以下是讓我坐在螢幕前很久的幾個數字。')),
    ('p', R(('「好了嗎」我打了 37 次。', 1), '加上變體超過 120 次。我當了四個半月的人肉進度條，最誇張的一條是某天凌晨一點：「好好了沒好了沒好了沒，我要睡覺了」。')),
    ('p', R(('23% 的指令打在凌晨 0 點到 5 點。', 1), '分布在 103 個不同的日子。134 天裡只有 3 天完全沒碰系統。')),
    ('p', R(('「依你建議」53 次。', 1), '我以為我在指揮系統，紀錄顯示很多時候是系統在指揮我。')),
    ('p', R(('蓋系統 546 次，真實下單回報 9 次。', 1), '我蓋了一間自動化投研公司——然後最誠實的統計是：我花在「蓋」的力氣，是花在「用」的 60 倍。')),
    ('p', R('然後是訪談階段。它問我：「這 6,139 條指令裡，你問過『我們賺錢了嗎』幾次？」')),
    ('p', R('我秒答：0 次。我自己知道。')),
    ('p', R('它接著問為什麼。再往下兩題，我給了一個「系統提醒我停損、所以我出場了」的例子——它直接把收據攤開：那檔股票還在我的持股裡，紀錄裡沒有任何賣出痕跡。', ('我記得的是一個我希望發生過的版本。', 1), '被自己的時間戳打臉，跟被人說教是完全不同的體感。')),
    ('p', R('最後它只說了一次的那句話，我抄在這裡：')),
    ('p', R(('「你蓋了一間審計一切的公司——唯一豁免審計的標的，是按下每一筆買賣的那個人。」', 2))),
    ('h3', '跑完之後改了什麼'),
    ('p', R('這個提示詞最好的設計是：它不停在「洞察」，強制走到「改造」。我的系統當晚多了幾條新規則：背景任務完成必須主動推播（戒掉「好了嗎」）、凌晨 00:30 之後只准讀不准蓋、每月最後一個週日跑一次「老闆考核」——把我上個月每一筆真實進出，對著自己蓋的那些驗證閘門對帳。')),
    ('p', R('全公司唯一沒被審計過的員工，終於有了考核。')),
    ('h3', '你要準備什麼'),
    ('ul', [
        R('一個能讀本機檔案的 AI agent（我用 Claude Code，Codex CLI 或其他同類工具也行）'),
        R('一段夠長的使用史（提示詞自己有寫：少於 20 個 session 它會降低信心、照實講）'),
        R(('心理準備', 1), '：它的規則是「你反駁時，用證據回擊，不為了讓你舒服而退讓」。它是認真的'),
        R('資料全程不出你的機器——提示詞裡有明文約束，你也應該盯著這條'),
    ]),
    ('p', R('一個提醒：AI 的分析只到「描述紀錄裡的模式」為止，模式的意義由你自己決定。這不是心理諮商，也取代不了。')),
    ('h3', '提示詞完整原文'),
    ('p', R('提示詞是英文原文（約 130 行，含六個階段的規則、證據門檻與「資料全程不出本機」的安全約束），我原文照貼在部落格版文章的文末，開一個 agent 直接複製貼上即可：')),
    ('p_link', '鏡子計畫完整提示詞（blog.getrealpha.com）', BLOG_URL),
    ('p', R('它會用你平常的語言跟你對話（有明文規則：使用者慣用中文就用繁體中文回應）。')),
    ('h3', '最後'),
    ('p', R('那晚訪談的最後一題，它問我：如果系統連同備份全部消失，你失去的是什麼？')),
    ('p', R('我想了很久，最後打出來的是：「不是少了工具，是少了一個放大我們本身能力的東西。我不太會表達，但感覺就像是少了幾百個我自己。」')),
    ('p', R('你電腦裡也躺著一份最誠實的你。要不要看，你自己決定。')),
    ('p', R(('本文為個人工作流與 AI 使用經驗分享，屬教育性質，文中提及的任何交易行為皆為個人紀錄，不構成投資建議。', 2))),
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
    return {'children': [listitem([t_node(txt, fmt) for txt, fmt in runs], i + 1) for i, runs in enumerate(items)],
            'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'list', 'version': 1,
            'listType': 'number' if ordered else 'bullet', 'start': 1, 'tag': 'ol' if ordered else 'ul'}

lex_children = []
for b in BLOCKS:
    kind = b[0]
    if kind == 'img':
        lex_children.append(image_node())
    elif kind == 'poem':
        lex_children.append(para([t_node(b[1], 2), linebreak(), t_node(b[2], 2)]))
    elif kind == 'p':
        lex_children.append(para([t_node(txt, fmt) for txt, fmt in b[1]]))
    elif kind == 'p_link':
        lex_children.append(para([link_node(b[1], b[2])]))
    elif kind == 'h3':
        lex_children.append(heading(b[1]))
    elif kind == 'ol':
        lex_children.append(list_node(b[1], True))
    elif kind == 'ul':
        lex_children.append(list_node(b[1], False))

lexical_obj = json.dumps({'root': {'children': lex_children, 'direction': 'ltr', 'format': '',
                                   'indent': 0, 'type': 'root', 'version': 1}}, ensure_ascii=False)

# ---------- HTML builder ----------
farewell = json.load(open(os.path.join(S, 'farewell.json'), encoding='utf-8'))['article']['content']
head_html = farewell[:farewell.find('</head>') + len('</head>')]  # 沿用同一份樣式表

def esc(x):
    return x.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def span(text):
    return f'<span style="white-space: pre-wrap;">{esc(text)}</span>'

def runs_html(runs):
    out = []
    for txt, fmt in runs:
        if fmt == 1:
            out.append(f'<b><strong class="lexical__textBold" style="white-space: pre-wrap;">{esc(txt)}</strong></b>')
        elif fmt == 2:
            out.append(f'<i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(txt)}</em></i>')
        else:
            out.append(span(txt))
    return ''.join(out)

hid = 1000001
body_parts = []
for b in BLOCKS:
    kind = b[0]
    if kind == 'img':
        body_parts.append(
            f'<div class="graf--img center"><div class="lexical__imageWrapper">'
            f'<img src="{IMG_URL}" data-original-src="{IMG_URL}" data-width="{IMG_W}" data-height="{IMG_H}" '
            f'referrerpolicy="no-referrer-when-downgrade" alt=""></div><div></div></div>')
    elif kind == 'poem':
        body_parts.append(f'<p class="graf--p" dir="ltr">'
                          f'<i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(b[1])}</em></i><br>'
                          f'<i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(b[2])}</em></i></p>')
    elif kind == 'p':
        body_parts.append(f'<p class="graf--p" dir="ltr">{runs_html(b[1])}</p>')
    elif kind == 'p_link':
        body_parts.append(f'<p class="graf--p" dir="ltr"><a href="{b[2]}">{span(b[1])}</a></p>')
    elif kind == 'h3':
        body_parts.append(f'<h3 class="graf--h3" dir="ltr" id="heading-{hid}">{span(b[1])}</h3>')
        hid += 1
    elif kind in ('ol', 'ul'):
        tag = 'ol' if kind == 'ol' else 'ul'
        cls = 'lexical__ol1' if kind == 'ol' else 'lexical__ul'
        lis = ''.join(f'<li value="{i+1}" class="graf--li">{runs_html(runs)}</li>' for i, runs in enumerate(b[1]))
        body_parts.append(f'<{tag} class="{cls}">{lis}</{tag}>')

content_html = head_html + '<body><div class="article-container">' + ''.join(body_parts) + '</div></body></html>'

plain = re.sub(r'<[^>]+>', '', ''.join(body_parts))
words = len(plain)
reading = max(1, math.ceil(words / 400))

json.dump({'lexicalObj': lexical_obj, 'content': content_html, 'words': words},
          open(os.path.join(S, 'built_payload.json'), 'w', encoding='utf-8'), ensure_ascii=False)

# ---------- API helpers ----------
def api(method, path, payload=None):
    url = 'https://api.vocus.cc' + path
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + TOK)
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    req.add_header('Origin', 'https://vocus.cc')
    req.add_header('Referer', 'https://vocus.cc/')
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore')

now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()

print(f'blocks={len(BLOCKS)} words={words} reading={reading}')

# 1) draft PATCH
st, body = api('PATCH', f'/api/articles/{AID}/draft', {
    'title': TITLE, 'lexicalObj': lexical_obj, 'articleId': AID,
    'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
print('draft PATCH:', st, body[:150])

# 2) metadata PATCH
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
    'isInvestment': False,
    'adult': False,
    'lexicalObj': lexical_obj,
})
print('meta PATCH:', st, body[:150])

# 3) 回讀驗證
st, body = api('GET', f'/api/article/{AID}')
a = json.loads(body)['article']
print('readback: status=', a.get('status'), '| cat=', (a.get('newCategory') or {}).get('title'),
      '| thumb=', a.get('thumbnailUrl'), '| words=', a.get('wordsCount'),
      '| contentLen=', len(a.get('content') or ''), '| tags=', [t['title'] for t in (a.get('tags') or [])])

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('status PATCH:', st, body[:200])
    st, body = api('GET', f'/api/article/{AID}')
    a = json.loads(body)['article']
    print('final status:', a.get('status'), '| lastPublishAt:', a.get('lastPublishAt'))
