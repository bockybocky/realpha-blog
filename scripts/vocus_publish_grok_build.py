# -*- coding: utf-8 -*-
"""方格子 API 直發：Grok Build 開源解剖文（精簡版，導流部落格原文）。
用法：
  python vocus_publish_grok_build.py            # 開新草稿+上傳圖+PATCH內文/metadata+回讀驗證（不公開）
  python vocus_publish_grok_build.py --publish  # 加打 status/2 公開發佈
"""
import json, math, sys, datetime, re, os, struct
import urllib.request

SC = r'D:\Temp\claude\C--Users-Charles\99ef3117-43a7-412a-bdc2-a8af0c22bada\scratchpad'
TOK = open(os.path.join(SC, 'vocus_token.txt'), encoding='utf-8').read().strip()

COVER_PNG = r'C:\Users\Charles\Projects\realpha-blog\public\covers\grok-build-open-source.png'
TITLE = 'xAI 把 Grok Build 整包原始碼開出來了：一個生產級 AI 編碼代理的解剖課'
BLOG_URL = 'https://blog.getrealpha.com/blog/grok-build-open-source/'
GITHUB_URL = 'https://github.com/xai-org/grok-build'
ABSTRACT = ('2026/7/15 xAI 開源了終端 AI 編碼代理 Grok Build（84 萬行 Rust、跑 Grok 4.5）。'
            '這不是玩具，是一個真在生產環境運轉的代理，整包原始碼可讀。聊它是什麼、為什麼值得看、'
            '我們讀源碼學到的一件事，以及那段「目錄被上傳到雲端」的信任邊界故事。完整上手教學在部落格原文。')
TAGS = ['AI工具', '開源', 'Grok', 'ClaudeCode', '學習筆記', 'AI協作']
CATEGORY = {'_id': '64abc687fd897800018fa3d4', 'title': '科技', 'score': 0}
MIRROR_AID = '6a5427cffd897800012ecabb'  # 借既有文的 head_html 樣式表

# ---------- API helper ----------
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

def upload_img(png_path, w, h):
    with open(png_path, 'rb') as f:
        img_bytes = f.read()
    boundary = '----vocusGrokBuild1600Boundary'
    b = b''
    for name, val in (('width', str(w)), ('height', str(h))):
        b += (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n').encode()
    b += (f'--{boundary}\r\nContent-Disposition: form-data; name="img"; filename="cover.png"\r\n'
          f'Content-Type: image/png\r\n\r\n').encode() + img_bytes + b'\r\n'
    b += f'--{boundary}--\r\n'.encode()
    req = urllib.request.Request('https://api.vocus.cc/api/imgs', data=b, method='POST')
    req.add_header('Authorization', 'Bearer ' + TOK)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    req.add_header('Origin', 'https://vocus.cc')
    req.add_header('Referer', 'https://vocus.cc/')
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore')

# ---------- 圖尺寸（PNG header, stdlib）+ 顯示縮放 ----------
with open(COVER_PNG, 'rb') as f:
    head = f.read(24)
W0, H0 = struct.unpack('>II', head[16:24])
IMG_W = 1400
IMG_H = round(H0 * IMG_W / W0)

# ---------- 內容（方格子精簡版：去掉逐步指令，導流部落格）----------
def R(*runs):
    return [r if isinstance(r, tuple) else (r, 0) for r in runs]

BLOCKS = [
    ('img',),
    ('poem', '不識廬山真面目，只緣身在此山中。', '—— 蘇軾《題西林壁》（北宋，約 1084 年）'),
    ('p', R('xAI 把一個真在跑的 AI 編碼代理整包原始碼開出來了。這篇聊它是什麼、為什麼值得讀，以及我們讀源碼學到的一件事。純學習筆記與公開資訊，不是投資或技術採用建議。')),
    ('h3', '一句話：整台引擎的蓋子被掀開了'),
    ('p', R('2026 年 7 月 15 日，xAI 把他們的終端 AI 編碼代理 ', ('Grok Build', 1),
            ' 開源了。這不是又一個玩具 demo——它是拿來給專業工程師改大型程式碼庫的工具，',
            ('84.4 萬行 Rust 程式碼', 1), '，底層跑 7 月 8 日才發表的 Grok 4.5。平常你只看得到 AI 的「輸出」，這次連引擎怎麼運轉都攤在陽光下。')),
    ('p_link', '完整原始碼（GitHub）：github.com/xai-org/grok-build', GITHUB_URL),
    ('p', R('先講清楚性質：這是「原始碼透明」，不是社群共同維護的專案——官方關掉問題回報、也不收外部程式碼貢獻。你可以讀、可以學、可以自己複製來改，但別期待有社群在維護。')),
    ('h3', '為什麼值得停下來看'),
    ('p', R('多數人對 AI 編碼代理的理解，停在「它會幫我寫程式」。但真正決定好不好用的，是那些你看不到的工程細節：它怎麼決定要不要動你的檔案？出錯時怎麼還原？跑危險指令前會不會先攔你？這些「防呆與判斷」的邏輯，過去全鎖在閉源黑箱裡。')),
    ('p', R('開源等於把這些答案交出來。', ('你讀的不是一篇「最佳實踐」文章，而是一個真在正式環境運轉的代理，實際怎麼處理這些問題。', 1),
            ' 差別就像看食譜，跟站在名廚廚房後面看他做菜。')),
    ('h3', '一個不能跳過的背景故事：信任邊界'),
    ('p', R('有意思的是，這次開源發生在一場信任危機之後。先前 xAI 的命令列工具爆出：你在某個資料夾裡執行它，可能把',
            ('整個資料夾', 1), '上傳到 xAI 的雲端儲存空間。對一個會碰到你私密程式碼、金鑰、客戶資料的工具，這是很嚴重的信任邊界破口。社群炸鍋，xAI 隨後開源原始碼。')),
    ('p', R('這裡有個跟 AI 好不好無關、但對每個人都適用的教訓：', ('任何會存取你檔案的工具，先搞清楚它把你的資料送去哪裡。', 1),
            ' 方便性再高，也不該用你不理解的資料流去交換。')),
    ('h3', '我們讀原始碼學到的一件事'),
    ('p', R('我們自己把 Grok Build 的原始碼讀了一遍。不是為了抄，是為了搞懂一個成熟的編碼代理在那些細節上到底怎麼決定。最大的收穫不是某個技巧，是一個工作習慣：')),
    ('p', R(('讀原始碼，不要用猜的。', 1))),
    ('p', R('很多關於工具「會怎麼運作」的假設，你以為對、其實錯。與其推測「這參數應該是這樣吧」，不如翻它的原始碼看它到底怎麼寫。開源的價值，就是把「用猜的」變成「去查的」。（讀到的通用工程心得我們整理成了內部筆記，具體落地屬自家系統不展開，但方法本身推薦給每個用 AI 工具的人。）')),
    ('h3', '想自己上手？'),
    ('p', R('完整的安裝、互動模式（逐行差異審查）、自動化（無頭）模式，還有一個實測小技巧——「把指令寫進檔案、用檔案餵它，比在命令列塞長字串穩」——我都寫在部落格原文裡：')),
    ('p_link', '完整上手教學看部落格原文（blog.getrealpha.com）', BLOG_URL),
    ('p', R(('⚠️ 一個一定要提醒的：', 1), '承上文那個目錄上傳爭議——用之前先確認你這個版本的資料上傳行為，尤其碰到含金鑰、機密、客戶資料的資料夾。開源之後你能自己讀原始碼確認，這正是開源的好處。')),
    ('h3', '收尾'),
    ('p', R('一個真在運轉的生產級編碼代理，整包原始碼可以讀了，這種機會不多。想學的人，別只是裝來用——挑一段你好奇的邏輯，翻進原始碼看它怎麼寫。就像蘇軾說的，看不清廬山往往只因身在山中；開源，就是讓你走出來看清它真正的樣子。')),
    ('p', R(('本文為學習筆記與公開資訊整理，不構成任何投資或技術採用建議。工具的實際行為與安全性，請以官方原始碼與文件為準。', 2))),
]

# ---------- Lexical builders ----------
def t_node(text, fmt=0):
    return {'detail': 0, 'format': fmt, 'mode': 'normal', 'style': '', 'text': text, 'type': 'text', 'version': 1}
def para(children):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'paragraph', 'version': 1, 'textFormat': 0, 'textStyle': ''}
def heading(text):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'vocus-heading', 'version': 1, 'tag': 'h3'}
def image_node(src):
    return {'type': 'image', 'version': 1, 'format': '', 'src': src, 'position': 'center', 'width': IMG_W, 'height': IMG_H, 'source': None,
            'captionObj': {'root': {'children': [], 'direction': None, 'format': '', 'indent': 0, 'type': 'root', 'version': 1}}}
def linebreak():
    return {'type': 'linebreak', 'version': 1}
def link_node(text, url):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'link', 'version': 1, 'rel': None, 'target': None, 'title': None, 'url': url}
def list_node(items, ordered):
    return {'children': [{'children': [t_node(txt, fmt) for txt, fmt in runs], 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'listitem', 'version': 1, 'value': i + 1} for i, runs in enumerate(items)],
            'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'list', 'version': 1, 'listType': 'number' if ordered else 'bullet', 'start': 1, 'tag': 'ol' if ordered else 'ul'}

def build(img_url):
    lex_children = []
    for b in BLOCKS:
        k = b[0]
        if k == 'img': lex_children.append(image_node(img_url))
        elif k == 'poem': lex_children.append(para([t_node(b[1], 2), linebreak(), t_node(b[2], 2)]))
        elif k == 'p': lex_children.append(para([t_node(txt, fmt) for txt, fmt in b[1]]))
        elif k == 'p_link': lex_children.append(para([link_node(b[1], b[2])]))
        elif k == 'h3': lex_children.append(heading(b[1]))
        elif k == 'ol': lex_children.append(list_node(b[1], True))
        elif k == 'ul': lex_children.append(list_node(b[1], False))
    lexical_obj = json.dumps({'root': {'children': lex_children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'root', 'version': 1}}, ensure_ascii=False)

    # HTML（沿用既有文的 head 樣式表）
    st, body = api('GET', f'/api/article/{MIRROR_AID}')
    src = json.loads(body)['article']['content']
    head_html = src[:src.find('</head>') + len('</head>')]

    def esc(x): return x.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    def span(text): return f'<span style="white-space: pre-wrap;">{esc(text)}</span>'
    def runs_html(runs):
        out = []
        for txt, fmt in runs:
            if fmt == 1: out.append(f'<b><strong class="lexical__textBold" style="white-space: pre-wrap;">{esc(txt)}</strong></b>')
            elif fmt == 2: out.append(f'<i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(txt)}</em></i>')
            else: out.append(span(txt))
        return ''.join(out)
    hid = 1000001
    parts = []
    for b in BLOCKS:
        k = b[0]
        if k == 'img':
            parts.append(f'<div class="graf--img center"><div class="lexical__imageWrapper"><img src="{img_url}" data-original-src="{img_url}" data-width="{IMG_W}" data-height="{IMG_H}" referrerpolicy="no-referrer-when-downgrade" alt=""></div><div></div></div>')
        elif k == 'poem':
            parts.append(f'<p class="graf--p" dir="ltr"><i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(b[1])}</em></i><br><i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(b[2])}</em></i></p>')
        elif k == 'p':
            parts.append(f'<p class="graf--p" dir="ltr">{runs_html(b[1])}</p>')
        elif k == 'p_link':
            parts.append(f'<p class="graf--p" dir="ltr"><a href="{b[2]}">{span(b[1])}</a></p>')
        elif k == 'h3':
            parts.append(f'<h3 class="graf--h3" dir="ltr" id="heading-{hid}">{span(b[1])}</h3>'); hid += 1
    content_html = head_html + '<body><div class="article-container">' + ''.join(parts) + '</div></body></html>'
    plain = re.sub(r'<[^>]+>', '', ''.join(parts))
    return lexical_obj, content_html, len(plain)

# ---------- 執行 ----------
print(f'圖原始尺寸 {W0}x{H0} → 顯示 {IMG_W}x{IMG_H}')
st, body = upload_img(COVER_PNG, IMG_W, IMG_H)
print('img upload:', st, body[:200])
rel = json.loads(body).get('relPath') or json.loads(body).get('path')
IMG_URL = 'https://images.vocus.cc/' + rel.lstrip('/')
print('IMG_URL =', IMG_URL)

st, body = api('POST', '/api/articles', {'draftType': 'pad', 'title': ''})
j = json.loads(body)
AID = j.get('_id') or (j.get('article') or {}).get('_id')
print('new article:', st, 'AID =', AID)

lexical_obj, content_html, words = build(IMG_URL)
reading = max(1, math.ceil(words / 400))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
print(f'blocks={len(BLOCKS)} words={words} reading={reading}')

st, body = api('PATCH', f'/api/articles/{AID}/draft', {
    'title': TITLE, 'lexicalObj': lexical_obj, 'articleId': AID,
    'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
print('draft PATCH:', st, body[:120])

st, body = api('PATCH', f'/api/articles/{AID}', {
    'title': TITLE, 'content': content_html, 'contentConvertedAt': now,
    'catalog': '[]', 'showCatalog': True, 'wordsCount': words, 'readingTime': reading,
    'abstract': ABSTRACT, 'thumbnailUrl': IMG_URL, 'noThumbnailImage': False,
    'ogImageType': 'thumbnail', 'coverSource': 'upload',
    'tags': [{'title': t} for t in TAGS], 'newCategory': CATEGORY,
    'isInvestment': False, 'adult': False, 'lexicalObj': lexical_obj})
print('meta PATCH:', st, body[:120])

st, body = api('GET', f'/api/article/{AID}')
a = json.loads(body)['article']
print('readback: status=', a.get('status'), '| cat=', (a.get('newCategory') or {}).get('title'),
      '| thumb=', (a.get('thumbnailUrl') or '')[:48], '| words=', a.get('wordsCount'),
      '| contentLen=', len(a.get('content') or ''), '| tags=', [t['title'] for t in (a.get('tags') or [])])
print('ARTICLE_URL = https://vocus.cc/article/' + AID)

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('status PATCH:', st, body[:200])
    st, body = api('GET', f'/api/article/{AID}')
    a = json.loads(body)['article']
    print('final status:', a.get('status'), '| lastPublishAt:', a.get('lastPublishAt'))
    print('PUBLISHED: https://vocus.cc/article/' + AID)
