# -*- coding: utf-8 -*-
"""方格子 API 直發：生成式AI認證考前重點總整理（完整版）。
解析自家 zh-TW mdx 自動轉 BLOCKS（保證與部落格一致）。
用法：python vocus_publish_genai_cheatsheet.py [--publish]
"""
import json, math, sys, datetime, re, os, struct
import urllib.request, urllib.error

SC = r'D:\Temp\claude\C--Users-Charles\2b22774f-a730-4ed5-bc4e-7f1abb541d23\scratchpad'
TOK = open(os.path.join(SC, 'vocus_token.txt'), encoding='utf-8').read().strip()

REPO = r'C:\Users\Charles\Projects\realpha-blog'
MDX = os.path.join(REPO, 'src', 'content', 'blog', 'genai-cert-exam-cheatsheet.zh-TW.mdx')
COVER_PNG = os.path.join(REPO, 'public', 'covers', 'genai-cert-exam-cheatsheet.png')
TITLE = '生成式 AI 認證 考前重點總整理（完整版）：21 個關鍵名詞 ＋ 四大面向逐章考點速查'
BLOG_URL = 'https://blog.getrealpha.com/blog/genai-cert-exam-cheatsheet/'
ABSTRACT = ('資策會生成式 AI 能力認證的考前速查工具（完整版）：21 個最易漏的關鍵名詞（分五組）＋'
            '基礎知識／Prompt／應用技能／倫理法律四大面向逐章高頻考點，每組附「看到 X 選 Y」辨析。全概念層、不含真題。')
TAGS = ['生成式AI', 'AI證照', '資策會', '考試準備', '學習筆記', 'AI速查']
CATEGORY = {'_id': '64abc687fd897800018fa3d4', 'title': '科技', 'score': 0}
IS_INVESTMENT = False
MIRROR_AID = '6a5427cffd897800012ecabb'


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
    boundary = '----vocusCheatsheetBoundary'
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


def expand_link(text, url):
    if url.startswith('/'):
        url = 'https://blog.getrealpha.com' + url
    return f'{text}（{url}）'


def inline_runs(text):
    # 先把 [text](url) 換成純文字＋展開網址
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: expand_link(m.group(1), m.group(2)), text)
    # 依 **bold** 切 runs
    parts = text.split('**')
    runs = []
    for i, seg in enumerate(parts):
        if seg == '':
            continue
        runs.append((seg, 1 if i % 2 == 1 else 0))
    return runs if runs else [(text, 0)]


def parse_mdx(path):
    raw = open(path, encoding='utf-8').read()
    # 去 frontmatter
    m = re.match(r'^---\n.*?\n---\n(.*)$', raw, re.S)
    body = m.group(1) if m else raw
    lines = body.split('\n')
    blocks = []
    i = 0
    ul = []
    poem_done = False

    def flush_ul():
        nonlocal ul
        if ul:
            blocks.append(('ul', ul))
            ul = []

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if s == '' or s == '---':
            flush_ul(); i += 1; continue
        # 圖片：跳過（封面另插）
        if s.startswith('!['):
            flush_ul(); i += 1; continue
        # 詩（blockquote，只取第一段）
        if s.startswith('>') and not poem_done:
            flush_ul()
            quote = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                q = lines[i].strip().lstrip('>').strip()
                q = q.replace('<br/>', '').replace('*', '').strip()
                if q:
                    quote.append(q)
                i += 1
            if quote:
                attr = quote[-1]
                poem_line = '　'.join(quote[:-1]) if len(quote) > 1 else quote[0]
                blocks.append(('poem', poem_line, attr))
            poem_done = True
            continue
        if s.startswith('>'):
            i += 1; continue
        # 標題（# ## ### ####）全轉 h3
        hm = re.match(r'^(#{1,6})\s+(.*)$', s)
        if hm:
            flush_ul()
            blocks.append(('h3', re.sub(r'\*\*', '', hm.group(2)).strip()))
            i += 1; continue
        # 項目（含縮排子項，flatten）
        bm = re.match(r'^-\s+(.*)$', s)
        if bm:
            ul.append(inline_runs(bm.group(1)))
            i += 1; continue
        # 一般段落
        flush_ul()
        blocks.append(('p', inline_runs(s)))
        i += 1
    flush_ul()
    return blocks


BLOCKS = [('img',)] + parse_mdx(MDX)


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


print(f'圖 {W0}x{H0} → {IMG_W}x{IMG_H}｜blocks={len(BLOCKS)}')
st, body = upload_img(COVER_PNG, IMG_W, IMG_H)
print('img upload:', st, body[:110])
rel = json.loads(body).get('relPath') or json.loads(body).get('path')
IMG_URL = 'https://images.vocus.cc/' + rel.lstrip('/')

if '--aid' in sys.argv:
    AID = sys.argv[sys.argv.index('--aid') + 1]
    print('reuse existing AID =', AID, '(原地更新，不開新文)')
else:
    st, body = api('POST', '/api/articles', {'draftType': 'pad', 'title': ''})
    AID = json.loads(body).get('_id')
    print('new article:', st, 'AID =', AID)

lexical_obj, content_html, words = build(IMG_URL)
reading = max(1, math.ceil(words / 400))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
print(f'words={words} reading={reading}')

st, body = api('PATCH', f'/api/articles/{AID}/draft', {
    'title': TITLE, 'lexicalObj': lexical_obj, 'articleId': AID,
    'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
print('draft PATCH:', st)

st, body = api('PATCH', f'/api/articles/{AID}', {
    'title': TITLE, 'content': content_html, 'contentConvertedAt': now,
    'catalog': '[]', 'showCatalog': True, 'wordsCount': words, 'readingTime': reading,
    'abstract': ABSTRACT, 'thumbnailUrl': IMG_URL, 'noThumbnailImage': False,
    'ogImageType': 'thumbnail', 'coverSource': 'upload',
    'tags': [{'title': t} for t in TAGS], 'newCategory': CATEGORY,
    'isInvestment': IS_INVESTMENT, 'adult': False, 'lexicalObj': lexical_obj})
print('meta PATCH:', st)
print('ARTICLE_ID', AID)
print('EDIT https://vocus.cc/new-editor/' + str(AID))
print('VIEW https://vocus.cc/article/' + str(AID))

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('PUBLISH status/2:', st, body[:60])
