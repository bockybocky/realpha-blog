# -*- coding: utf-8 -*-
"""方格子 API 直發：Meb Faber Show EP640 Carson Block 聽後筆記（全文版）。
用法：
  python vocus_publish_meb640_carson.py            # 建草稿+上傳圖+PATCH（不公開）
  python vocus_publish_meb640_carson.py --publish  # 加打 status/2 公開發佈
token：scratchpad/vocus_token.txt。投資類→CATEGORY 投資理財、isInvestment True。
"""
import json, math, sys, datetime, re, os, struct
import urllib.request, urllib.error

SC = r'D:\Temp\claude\C--Users-Charles\2b22774f-a730-4ed5-bc4e-7f1abb541d23\scratchpad'
TOK = open(os.path.join(SC, 'vocus_token.txt'), encoding='utf-8').read().strip()

COVER_PNG = r'C:\Users\Charles\Projects\realpha-blog\public\covers\meb-faber-640-carson-block-ai-sp500.png'
TITLE = '最後一個做空者 Carson Block：AI 會怎麼「拆掉」S&P 500？｜Meb Faber Show EP640 聽後筆記'
BLOG_URL = 'https://blog.getrealpha.com/blog/meb-faber-640-carson-block-ai-sp500/'
ABSTRACT = ('Muddy Waters 創辦人、人稱「最後一個做空者」的 Carson Block 在 Meb Faber Show EP640 的核心推論：'
            'AI 取代高薪知識工作者→401(k) 資金流反轉→權重最大那幾檔把 S&P 500 往下拉。含完整重點、五句金句與六個啟示。非投資建議。')
TAGS = ['Podcast', 'MebFaber', 'CarsonBlock', 'MuddyWaters', 'AI', '美股', '做空', '投資筆記']
CATEGORY = {'_id': '5a978e00fd897800016874cc', 'title': '投資理財', 'score': 0}
IS_INVESTMENT = True
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
    boundary = '----vocusMeb640Boundary'
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
    ('poem', '舉世皆濁我獨清，眾人皆醉我獨醒。', '—— 屈原《漁父》（戰國，約公元前 3 世紀）'),
    ('p', R('如果你只有 30 秒：',
            ('一位靠「揭穿騙局」維生、被主持人稱為「世界上最後一個做空者」的人，講了一個關於 AI 的推論——不是「AI 泡沫會不會破」，而是「AI 真的成功之後，會怎麼從資金流的底層，把 S&P 500 那幾檔巨頭往下拉」。', 1),
            ' 這集值得每個持有指數的人聽一遍。以下是完整筆記。')),

    ('h3', '頻道介紹：The Meb Faber Show'),
    ('p', R('主持人 ', ('Meb Faber', 1),
            ' 是 Cambria Investment Management 的共同創辦人暨投資長，量化資產配置圈的知名人物（提出過 Shareholder Yield、Trinity Portfolio、GTAA 全球戰術資產配置等）。他的播客 The Meb Faber Show 聚焦「幫你把財富做大、也守得住」，長期訪談各路投資大師與另類資產玩家，是英文投資播客裡訊號密度很高的一檔。依規定，他在節目上不談自家 Cambria 基金。')),

    ('h3', '來賓介紹：Carson Block / Muddy Waters'),
    ('p', R('Carson Block 是 ', ('Muddy Waters Research（渾水研究）', 1),
            ' 與 Muddy Waters Capital 的創辦人，當代最有名的「積極型做空者」。他成名於揭穿一連串中概股財務造假，戰場遍及歐洲（法國 Casino 量販集團）、日本（Nidec 日本電產）。近期公開做空的標的包括 SoFi、Sport Radar 等。')),
    ('p', R('主持人給他的稱號很傳神——', ('世界上最後一個做空者', 1),
            '。這行業在金融海嘯後幾乎凋零：Meb 把做空者稱為「金融市場的免疫系統」，因為揭穿詐騙的往往不是監管機關，而是這群人。')),

    ('h3', '完整重點摘要'),
    ('p', R(('① 核心推論：AI 如何從「資金流」拆掉 S&P 500。', 1), ' Carson 特別強調「我其實真心希望自己是錯的」：')),
    ('ul', [
        R(('AI 取代高薪知識工作者', 1), '：三年內可能取代約 15% 美國知識工作者——律師、會計師、工程師這種最高薪的一層。'),
        R(('跟金融海嘯不同，這次沒有「復甦的嫩芽」', 1), '：工作消失後不會以相近薪水回來，新職位也補不回失去的所得。'),
        R(('關鍵連結是 401(k)', 1), '：這群高薪族正是退休金 401(k) 的繳款主力，而 401(k) 資金流長期是推動 S&P 500（尤其權重最大那幾檔）的引擎；再疊上嬰兒潮世代開始贖回。'),
        R(('飛輪反轉', 1), '：他們失去收入→401(k) 淨流入歸零再轉負→先賣應稅資產、最後贖回退休金。於是被資金灌得最飽的巨頭「會很硬地鬆開」，S&P 500 與 Nasdaq 100 首當其衝。'),
        R(('終局是通縮與社會重構', 1), '：需求端崩掉，AI 到那時會相當通縮，走向「新的社會契約」。'),
    ]),
    ('p', R('他點出這波跟歷史科技衝擊的兩個關鍵差異：一是',
            ('過去被取代的多半本來就在走下坡，這次 AI 對準的是原本還在上升的白領行業', 1), '；二是',
            ('AI 模型開始「寫自己的接班人」', 1), '，能力指數上升，人類跟不上。')),

    ('p', R(('② 他怎麼下注：風險封頂，不裸空。', 1))),
    ('ul', [
        R(('股票端用價差選擇權（put spreads）', 1), '：市場有結構性買盤壓著波動率，裸空會被軋。'),
        R(('信用端做多利差（透過 swaption）', 1), '：公司債與垃圾債利差在史上最緊的百分位（約 1 個百分位）卻幾乎沒人擔心；衝擊到來、需求出問題時利差會炸開。'),
        R(('二階、三階效應才有趣', 1), '：債券 ETF（LQD、HYG）放二階；三階放市政債指數 MUB——加州、紐約等財政難看的州是主成分，真出事時 ETF 遇流動性錯配無法應付贖回。但他提醒央行終會解凍，所以「別當貪心的豬」。'),
    ]),
    ('p', R(('③ 做空這門生意的「骯髒祕密」：不可規模化。', 1),
            ' 一年頂多找到約 6 次值得寫報告的標的；品牌是命脈，天天喊空會把品牌商品化；不寫報告的純空單，海嘯後是很糟的商業模式。')),
    ('p', R(('④ 他自己怎麼「校準濾鏡」。', 1),
            ' 做空者長期看什麼都像釘子。他幾年前問自己「我是不是透過過度負面的濾鏡在看世界？」於是團隊開發了只在 S&P 500 裡跑的系統性動能策略（2024/10 起，累積毛報酬超過 70%），也在初級礦業做多。一句話：「你是要活在真實世界，還是要在推特上死一場火光四射的死？」')),
    ('p', R(('⑤ 順帶兩個案例。', 1),
            ' SoFi：一套「公允價值選擇權」會計把貸款當天 mark 到 108–109，再用自家融資的「假賣出」支撐，抽掉這根支柱恐逼出約 10 億美元 EBITDA 重編——「刀鋒上的財務工程」。中國：不是預測指數跌，而是「資訊質量太差」＋政策反覆＋VIE 結構下「你其實什麼都沒擁有」，所以 uninvestable。')),

    ('h3', '五句金句（中英對照）'),
    ('p', R(("“Cynics always sound smarter. Optimists live in bigger houses.”", 2))),
    ('p', R('犬儒總是聽起來比較聰明，但樂觀的人住比較大的房子。（全集點題句）')),
    ('p', R(("“We're not gonna be able to keep up with the pace of change... because these things are coding and testing their successors.”", 2))),
    ('p', R('我們人類跟不上這波變化速度——因為這些模型正在編寫、測試自己的接班人。')),
    ('p', R(("“The dirty secret of the activist short selling model is that it's not scalable.”", 2))),
    ('p', R('積極型做空的骯髒祕密是：它無法規模化。')),
    ('p', R(("“Are you living in the real world, or are you going to die that fiery death on Twitter?”", 2))),
    ('p', R('你是要活在真實世界，還是要在推特上死一場火光四射的死？（別困在自己的立場裡）')),
    ('p', R(("“What is risk? It's a BTFD.”", 2))),
    ('p', R('對海嘯後入場的兩代投資人，「風險」就是「逢低買進」——因為他們相信聯準會終究會救市。')),

    ('h3', '我們能學到什麼：六個啟示'),
    ('ol', [
        R(('被動資金是一把「雙面刃飛輪」。', 1), '把巨頭灌上去的 401(k) 資金流，也能反向抽走。指數集中度不只是「估值貴」，更是資金結構的脆弱性。'),
        R(('對了方向 ≠ 賺到錢。', 1), 'Carson 再確信也用 put spread／swaption 封頂而非裸空。你怎麼「表達」和「控制部位」，比判斷對錯更決定生死。'),
        R(('利差在史上最緊卻沒人擔心＝被忽略的尾部。', 1), '所有人都「逢低買、聯準會會救」時，不對稱反而站在懷疑者這邊——沒人要的保險最便宜。'),
        R(('想二階、三階效應，別停在一階。', 1), '有趣的交易不是「做空輝達」，而是資金流的二三階（債券 ETF、市政債、總需求、通縮）。標題只是起點。'),
        R(('讀附註、找那根「關鍵支柱交易」。', 1), 'SoFi 案的重點是一筆小交易撐起整座估值金字塔。灰色地帶財務工程常剛好踩在合法邊緣。'),
        R(('別讓立場變成身分。', 1), 'Carson 最強的不是看空，是對自己偏見誠實、主動加動能與礦業做多。Adam Grant：「開放心態的標誌，是不讓你的想法變成你的身分。」'),
    ]),

    ('h3', '推薦你去聽原文'),
    ('p', R('我的筆記再詳細，也濃縮不了 Carson 講 Wirecard（前 COO 竟是俄羅斯 GRU 特工）、中國做生意「關係」迷思的第一手臨場感。強烈建議直接聽整集 50 分鐘：')),
    ('p_link', '官方頁（含完整逐字稿）：themebfabershow.com/episodes/0hoNFbxmuTg', 'https://www.themebfabershow.com/episodes/0hoNFbxmuTg'),
    ('p_link', '部落格完整中英版：blog.getrealpha.com', BLOG_URL),
    ('p', R(('本文為公開播客的聽後筆記與教育性整理，內容為節目來賓與主持人的個人觀點，不代表本站立場，也不構成任何個股買賣建議、目標價或投資勸誘。文中提及的做空、選擇權、swaption 等操作風險極高、多為一般投資人難以執行的機構工具，切勿模仿。投資有風險，任何決策請自行判斷或諮詢合格的專業人士。', 2))),
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
        elif k == 'p_link':
            parts.append(f'<p class="graf--p" dir="ltr"><a href="{b[2]}">{span(b[1])}</a></p>')
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

print(f'圖 {W0}x{H0} → {IMG_W}x{IMG_H}')
st, body = upload_img(COVER_PNG, IMG_W, IMG_H)
print('img upload:', st, body[:120])
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
print('draft PATCH:', st, body[:80])

st, body = api('PATCH', f'/api/articles/{AID}', {
    'title': TITLE, 'content': content_html, 'contentConvertedAt': now,
    'catalog': '[]', 'showCatalog': True, 'wordsCount': words, 'readingTime': reading,
    'abstract': ABSTRACT, 'thumbnailUrl': IMG_URL, 'noThumbnailImage': False,
    'ogImageType': 'thumbnail', 'coverSource': 'upload',
    'tags': [{'title': t} for t in TAGS], 'newCategory': CATEGORY,
    'isInvestment': IS_INVESTMENT, 'adult': False, 'lexicalObj': lexical_obj})
print('meta PATCH:', st, body[:80])

print('ARTICLE_ID', AID)
print('EDIT https://vocus.cc/new-editor/' + str(AID))
print('VIEW https://vocus.cc/article/' + str(AID))

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('PUBLISH status/2:', st, body[:80])
