# -*- coding: utf-8 -*-
"""發「零基礎安裝 AI CLI」重點文到方格子（API 直發）。科技類、非投資、無封面。
用法：python vocus_publish_install_guide.py            # draft+meta+回讀（不發佈）
      python vocus_publish_install_guide.py --publish  # 打 status/2 公開
"""
import json, math, sys, datetime, re, os, urllib.request, urllib.error

S = r'D:\Temp\claude\C--Users-Charles\b929440c-98d1-46a0-87eb-5b38f41a08a4\scratchpad'
TOK = open(os.path.join(S, 'vocus_token.txt'), encoding='utf-8').read().strip()
AID_FILE = os.path.join(S, 'vocus_install_aid.txt')
HEAD_SRC_AID = '6a5427cffd897800012ecabb'  # 借現有文的 <head> 樣式
BLOG_URL = 'https://blog.getrealpha.com/blog/install-ai-cli-beginners/'
TITLE = '訂了 AI 卻不會裝電腦版？零基礎安裝 Claude Code / Codex / Grok / Antigravity'
ABSTRACT = ('訂了 AI 工具卻不會裝電腦版（命令列版）？這篇零基礎手把手：四個工具（Claude Code／Codex／Grok／agy）'
            '挑你訂的那個，在 Mac 或 Windows 一步一步裝好、登入、開始用，完整可複製指令在部落格。')
TAGS = ['Claude Code', 'Codex', 'Grok', 'AI工具', '命令列', '教學']
CATEGORY = {'_id': '64abc687fd897800018fa3d4', 'title': '科技', 'score': 0}


def R(*runs):
    return [r if isinstance(r, tuple) else (r, 0) for r in runs]


BLOCKS = [
    ('p', R('很多人訂了 AI 工具，卻卡在同一關：', ('不知道怎麼把「電腦版（命令列版）」裝起來', 1), '。看到那個黑色視窗就手軟。')),
    ('p', R('這篇就是寫給你的——', ('完全沒碰過終端機也能跟著裝', 1), '。我把四個目前最好用的 AI 命令列工具，在 Mac 和 Windows 上怎麼裝、怎麼登入、怎麼用，一步一步拆開講清楚。')),
    ('h3', '重點先講'),
    ('ul', [
        R(('四個挑一個裝就好，不用全裝', 1), '：你訂了哪個就裝哪個（Claude → Claude Code、ChatGPT → Codex、Grok → Grok Build、Google → agy），用法幾乎一樣，會一個就會全部。'),
        R(('不用會寫程式', 1), '：你只要會「複製一行指令、貼進視窗、按 Enter」。'),
        R(('Windows 新手特別照顧', 1), '：光是「哪一種終端機、怎麼打開 PowerShell」就手把手教到會。'),
        R(('裝完之後', 1), '：怎麼登入、怎麼用中文直接叫它做事，也都有。'),
        R(('新手最常卡的坑全整理好', 1), '：找不到指令（PATH）、Windows 藍色攔截畫面（SmartScreen）、執行原則、防毒擋下載、怎麼確認到底裝好了沒。'),
    ]),
    ('h3', '為什麼完整步驟放在部落格'),
    ('p', R('安裝要一行一行', ('精準複製貼上', 1), '的指令，放在這裡容易被改壞、也不好複製。所以我把', ('完整、可直接複製的一步一步指令', 1), '放在自家部落格，這篇負責幫你判斷「該裝哪個、大概怎麼進行」。')),
    ('p', R(('完整安裝教學（含所有指令、Mac＋Windows、常見卡關）看這裡：', 1))),
    ('p_link', '零基礎安裝 Claude Code / Codex / Grok / Antigravity（blog.getrealpha.com）', BLOG_URL),
    ('p', R('（這些工具版本更新很快，指令以官方頁與部落格最新版為準。）')),
]


def t_node(text, fmt=0):
    return {'detail': 0, 'format': fmt, 'mode': 'normal', 'style': '', 'text': text, 'type': 'text', 'version': 1}
def para(children):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'paragraph', 'version': 1, 'textFormat': 0, 'textStyle': ''}
def heading(text):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'vocus-heading', 'version': 1, 'tag': 'h3'}
def link_node(text, url):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'link', 'version': 1, 'rel': None, 'target': None, 'title': None, 'url': url}
def listitem(children, value):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'listitem', 'version': 1, 'value': value}
def list_node(items, ordered):
    return {'children': [listitem([t_node(txt, fmt) for txt, fmt in runs], i + 1) for i, runs in enumerate(items)],
            'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'list', 'version': 1,
            'listType': 'number' if ordered else 'bullet', 'start': 1, 'tag': 'ol' if ordered else 'ul'}


def api(method, path, payload=None):
    url = 'https://api.vocus.cc' + path
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + TOK)
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    req.add_header('Origin', 'https://vocus.cc'); req.add_header('Referer', 'https://vocus.cc/')
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'ignore')


# 取或建 AID
if os.path.exists(AID_FILE):
    AID = open(AID_FILE, encoding='utf-8').read().strip()
    print('reuse AID', AID)
else:
    st, body = api('POST', '/api/articles', {'draftType': 'pad', 'title': ''})
    print('create:', st, body[:120])
    AID = json.loads(body).get('_id') or json.loads(body).get('article', {}).get('_id')
    open(AID_FILE, 'w', encoding='utf-8').write(AID)
    print('new AID', AID)

# 借 head 樣式
st, body = api('GET', f'/api/article/{HEAD_SRC_AID}')
src_content = json.loads(body)['article']['content']
head_html = src_content[:src_content.find('</head>') + len('</head>')]

# lexical
lex_children = []
for b in BLOCKS:
    k = b[0]
    if k == 'p': lex_children.append(para([t_node(txt, fmt) for txt, fmt in b[1]]))
    elif k == 'p_link': lex_children.append(para([link_node(b[1], b[2])]))
    elif k == 'h3': lex_children.append(heading(b[1]))
    elif k == 'ul': lex_children.append(list_node(b[1], False))
    elif k == 'ol': lex_children.append(list_node(b[1], True))
lexical_obj = json.dumps({'root': {'children': lex_children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'root', 'version': 1}}, ensure_ascii=False)

# html
def esc(x): return x.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def span(text): return f'<span style="white-space: pre-wrap;">{esc(text)}</span>'
def runs_html(runs):
    out = []
    for txt, fmt in runs:
        if fmt == 1: out.append(f'<b><strong class="lexical__textBold" style="white-space: pre-wrap;">{esc(txt)}</strong></b>')
        elif fmt == 2: out.append(f'<i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(txt)}</em></i>')
        else: out.append(span(txt))
    return ''.join(out)
hid = 1000001; body_parts = []
for b in BLOCKS:
    k = b[0]
    if k == 'p': body_parts.append(f'<p class="graf--p" dir="ltr">{runs_html(b[1])}</p>')
    elif k == 'p_link': body_parts.append(f'<p class="graf--p" dir="ltr"><a href="{b[2]}">{span(b[1])}</a></p>')
    elif k == 'h3': body_parts.append(f'<h3 class="graf--h3" dir="ltr" id="heading-{hid}">{span(b[1])}</h3>'); hid += 1
    elif k in ('ol', 'ul'):
        tag = 'ol' if k == 'ol' else 'ul'; cls = 'lexical__ol1' if k == 'ol' else 'lexical__ul'
        lis = ''.join(f'<li value="{i+1}" class="graf--li">{runs_html(runs)}</li>' for i, runs in enumerate(b[1]))
        body_parts.append(f'<{tag} class="{cls}">{lis}</{tag}>')
content_html = head_html + '<body><div class="article-container">' + ''.join(body_parts) + '</div></body></html>'
words = len(re.sub(r'<[^>]+>', '', ''.join(body_parts))); reading = max(1, math.ceil(words / 400))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
print(f'AID={AID} blocks={len(BLOCKS)} words={words}')

st, body = api('PATCH', f'/api/articles/{AID}/draft', {'title': TITLE, 'lexicalObj': lexical_obj, 'articleId': AID, 'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
print('draft PATCH:', st, body[:120])
st, body = api('PATCH', f'/api/articles/{AID}', {'title': TITLE, 'content': content_html, 'contentConvertedAt': now, 'catalog': '[]', 'showCatalog': True, 'wordsCount': words, 'readingTime': reading, 'abstract': ABSTRACT, 'noThumbnailImage': True, 'tags': [{'title': t} for t in TAGS], 'newCategory': CATEGORY, 'isInvestment': False, 'adult': False, 'lexicalObj': lexical_obj})
print('meta PATCH:', st, body[:120])
st, body = api('GET', f'/api/article/{AID}')
a = json.loads(body)['article']
print('readback: status=', a.get('status'), '| cat=', (a.get('newCategory') or {}).get('title'), '| words=', a.get('wordsCount'), '| contentLen=', len(a.get('content') or ''), '| tags=', [t['title'] for t in (a.get('tags') or [])])
print('PUBLIC URL: https://vocus.cc/article/' + AID)

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('status PATCH:', st, body[:150])
    st, body = api('GET', f'/api/article/{AID}')
    a = json.loads(body)['article']
    print('final status:', a.get('status'), '| lastPublishAt:', a.get('lastPublishAt'))
