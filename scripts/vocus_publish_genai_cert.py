# -*- coding: utf-8 -*-
"""方格子 API 直發：資策會生成式AI認證準備法（全文版，無程式碼故全文照發）。
用法：
  python vocus_publish_genai_cert.py            # 開新草稿+上傳圖+PATCH內文/metadata+回讀（不公開）
  python vocus_publish_genai_cert.py --publish  # 加打 status/2 公開發佈
token：讀 scratchpad/vocus_token.txt（browse connect 真 Chrome 抓的 id_token）。
"""
import json, math, sys, datetime, re, os, struct
import urllib.request, urllib.error

SC = r'D:\Temp\claude\C--Users-Charles\2b22774f-a730-4ed5-bc4e-7f1abb541d23\scratchpad'
TOK = open(os.path.join(SC, 'vocus_token.txt'), encoding='utf-8').read().strip()

COVER_PNG = r'C:\Users\Charles\Projects\realpha-blog\public\covers\genai-cert-exam-prep.png'
TITLE = '兩個月考兩張 AI 證照：我怎麼用 AI 協作，把資策會生成式 AI 認證的考試重點快速壓出來'
BLOG_URL = 'https://blog.getrealpha.com/blog/genai-cert-exam-prep/'
ABSTRACT = ('六月 AI-900、七月資策會生成式 AI 能力認證，兩個月兩張。分享我的準備法：真題優先、'
            '用 AI 把做過的幾百題壓成一張「只剩沒看過的」複習卡、臨場判斷哪章該跳，附這張證照真正的高頻考點。')
TAGS = ['AI證照', '生成式AI', '資策會', '學習筆記', 'AI協作', '考試準備']
CATEGORY = {'_id': '64abc687fd897800018fa3d4', 'title': '科技', 'score': 0}
MIRROR_AID = '6a5427cffd897800012ecabb'  # 借既有文的 head_html 樣式表

def api(method, path, payload=None):
    url = 'https://api.vocus.cc' + path
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + TOK)
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    req.add_header('Origin', 'https://vocus.cc'); req.add_header('Referer', 'https://vocus.cc/')
    if data: req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore')

def upload_img(png_path, w, h):
    with open(png_path, 'rb') as f: img_bytes = f.read()
    boundary = '----vocusGenaiCert1400Boundary'
    b = b''
    for name, val in (('width', str(w)), ('height', str(h))):
        b += (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n').encode()
    b += (f'--{boundary}\r\nContent-Disposition: form-data; name="img"; filename="cover.png"\r\n'
          f'Content-Type: image/png\r\n\r\n').encode() + img_bytes + b'\r\n'
    b += f'--{boundary}--\r\n'.encode()
    req = urllib.request.Request('https://api.vocus.cc/api/imgs', data=b, method='POST')
    req.add_header('Authorization', 'Bearer ' + TOK)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    req.add_header('Origin', 'https://vocus.cc'); req.add_header('Referer', 'https://vocus.cc/')
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore')

with open(COVER_PNG, 'rb') as f: head = f.read(24)
W0, H0 = struct.unpack('>II', head[16:24])
IMG_W = 1400
IMG_H = round(H0 * IMG_W / W0)

def R(*runs):
    return [r if isinstance(r, tuple) else (r, 0) for r in runs]

BLOCKS = [
    ('img',),
    ('poem', '欲窮千里目，更上一層樓。', '—— 王之渙《登鸛雀樓》（唐，約 704 年）'),
    ('p', R('六月拿了 AI-900，七月又拿下資策會的生成式 AI 能力認證。兩個月兩張，說真的節奏有點猛——但我不是靠硬啃，是靠一套 ',
            ('「AI 協作 × 真題優先 × 臨場取捨」', 1), ' 的準備法。這篇把方法完整分享出來，不藏。')),
    ('h3', '先認識這張證照'),
    ('p', R('資策會的生成式 AI 能力認證，規格很清楚：')),
    ('ul', [
        R('電腦應試、單選 80 題、90 分鐘、', ('70 分及格', 1), '（滿分 100）'),
        R('範圍四大面向：基礎知識 / 能力強化（Prompt）/ 應用技能（各種生成工具）/ 倫理法律'),
    ]),
    ('p', R('它是「素養／能力」等級，', ('不用寫程式、不用部署雲端', 1),
            '，考的是你懂不懂觀念、分不分得清名詞。所以準備策略跟工程師考照完全不同——重點在「廣度」和「辨析」，不是「深度」。')),
    ('h3', '原則一：真題優先，別被自己做的「仿真題」騙了'),
    ('p', R('這是我考 AI-900 時學到最痛的一課：', ('先把真題全部做完，行有餘力才碰模擬題。', 1))),
    ('p', R('很多人一上來就叫 AI「幫我出 50 題模擬題」——這其實是陷阱。AI 生的仿真題常常抓不到真正的出題口味，你做得很爽、分數很高，結果是',
            ('流暢度的錯覺', 1), '。真題才是最貼近考場的訊號源。')),
    ('h3', '原則二：用 AI 協作，把題庫「壓縮」成只剩你不會的'),
    ('p', R('這是我這次最想分享的一招，也是 AI 真正幫上忙的地方。')),
    ('p', R('做過幾百題之後，你會遇到一個問題：', ('再從頭刷一遍太浪費時間，但又怕漏掉沒看過的。', 1), ' 我的做法是——')),
    ('p', R(('把「我已經做過的所有題目內文」當成一個比對庫，讓 AI 幫我把出現過的名詞、考點全部刪掉，只留下我「一次都沒碰過」的。', 1))),
    ('p', R('結果很驚人：特殊名詞從 71 個壓到 21 個、章節考點也砍掉一大半熟的。等於把厚厚一疊講義，濃縮成一張「只補漏」的複習卡。考前那幾小時，我只讀這張——CP 值最高。')),
    ('p', R('這件事人工做會做到瘋掉（要交叉比對幾百題），交給 AI 就是幾分鐘的事。',
            ('這才是 AI 協作的正確用法：不是叫它幫你想，是叫它幫你做「人力做不動的整理」。', 1))),
    ('h3', '原則三：臨場取捨，不是每個考點都同權重'),
    ('p', R('準備到最後，我還做了一件事——', ('判斷哪些能跳。', 1))),
    ('p', R('複習卡裡有一整章「最新發展」，塞滿了前沿架構名詞（各種挑戰 Transformer 的新模型、極限量化技術⋯）。這些',
            ('在我做過的幾百題裡一次都沒出現過', 1), '——這就是強烈訊號：低頻。素養級考試不會考這種工程細節，頂多一兩題認名詞。')),
    ('p', R('所以我的決定是：', ('這章「混個臉熟」就好，把腦力留給真正高頻的地方。', 1),
            ' 這種取捨判斷，是 AI 給不了你的——它能整理，但「賭哪裡會考」要靠你自己。')),
    ('h3', '乾貨：這張證照真正高頻的考點'),
    ('p', R('如果你也要考，把火力集中在這幾塊（都是概念層，我不貼真題）：')),
    ('ul', [
        R(('功能名詞辨析', 1), '：摘要 / 改寫 / 擴寫 / 翻譯 / 情感分析，給你一個情境要你選對名字——最高頻題型。'),
        R(('語音三分法', 1), '：TTS（文字→語音）、STT（語音→文字）、S2S（語音→語音翻譯），一定要分清。'),
        R(('倫理與法律', 1), '：責任歸屬（AI 出錯不是「AI 自己負責」，而是歸設計者／部署者／使用者）、AI 生成內容著作權、隱私增強技術（差分隱私／同態加密／聯邦學習／安全多方計算）——CP 值最高，務必讀熟。'),
        R(('Prompt 攻防', 1), '：Prompt Injection（廣義）包含 Jailbreak（越獄，如祖母漏洞）；防禦有三明治防禦、分隔符。'),
        R(('反覆出現的大原則', 1), '：AI 是「增強與協作」不是「全面取代」；「雙面刃」——每個應用都同時帶來效率和新風險。'),
    ]),
    ('h3', '最後，一句誠實話'),
    ('p', R('這篇文章的資料整理、複習卡濃縮，是 AI 幫我做的；但', ('「怎麼準備、賭哪裡會考、什麼能跳」的判斷，是我自己的。', 1),
            ' AI 是加速器，不是替身——這也是我覺得未來最值錢的能力：', ('你會不會用 AI 把自己的判斷放大。', 1))),
    ('p', R('六月一張、七月一張，八月我打算再約一張把進階級補滿。',
            ('如果你也在考照路上——方法對了，速度會超乎你想像。一起加油。', 1))),
]

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
        elif k == 'h3': lex_children.append(heading(b[1]))
        elif k == 'ul': lex_children.append(list_node(b[1], False))
        elif k == 'ol': lex_children.append(list_node(b[1], True))
    lexical_obj = json.dumps({'root': {'children': lex_children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'root', 'version': 1}}, ensure_ascii=False)

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
        elif k == 'h3':
            parts.append(f'<h3 class="graf--h3" dir="ltr" id="heading-{hid}">{span(b[1])}</h3>'); hid += 1
        elif k in ('ul', 'ol'):
            tag = 'ul' if k == 'ul' else 'ol'
            cls = 'lexical__ul' if k == 'ul' else 'lexical__ol1'
            lis = ''.join(f'<li value="{i+1}" class="graf--li">{runs_html(runs)}</li>' for i, runs in enumerate(b[1]))
            parts.append(f'<{tag} class="{cls}">{lis}</{tag}>')
    content_html = head_html + '<body><div class="article-container">' + ''.join(parts) + '</div></body></html>'
    plain = re.sub(r'<[^>]+>', '', ''.join(parts))
    return lexical_obj, content_html, len(plain)

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

print('ARTICLE_ID', AID)
print('EDIT https://vocus.cc/new-editor/' + str(AID))
print('VIEW https://vocus.cc/article/' + str(AID))

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('PUBLISH status/2:', st, body[:120])
