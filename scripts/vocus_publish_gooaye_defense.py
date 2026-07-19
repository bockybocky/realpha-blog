# -*- coding: utf-8 -*-
"""方格子 API 直發：股癌最新一集聽後筆記（指數穩個股慘／韓國槓桿ETF／Jevons駁AI利空）。
用法：
  python vocus_publish_gooaye_defense.py            # 建草稿+上傳圖+PATCH（不公開）
  python vocus_publish_gooaye_defense.py --publish  # 加打 status/2 公開發佈
token：scratchpad/vocus_token.txt。投資類→CATEGORY 投資理財、isInvestment True。
"""
import json, math, sys, datetime, re, os, struct
import urllib.request, urllib.error

SC = r'D:\Temp\claude\C--Users-Charles\c6c379aa-ee7a-4c56-b0ad-7a73915234f1\scratchpad'
TOK = open(os.path.join(SC, 'vocus_token.txt'), encoding='utf-8').read().strip().strip('"')

COVER_PNG = r'C:\Users\Charles\Projects\realpha-blog\public\covers\gooaye-index-steady-stocks-bleeding.png'
TITLE = '「指數穩、個股慘」的真兇是誰？股癌主委最新一集：回撤 15% 轉防守、台積電被錯殺，與那個被誤讀的 AI 利空｜聽後筆記'
BLOG_URL = 'https://blog.getrealpha.com/blog/gooaye-index-steady-stocks-bleeding/'
ABSTRACT = ('股癌最新一集，主委的核心判讀：這波「指數穩、個股慘」的真兇是韓國高槓桿 ETF 爆倉、全球估值倍數被系統性下修，'
            '不是產業利空；台積電法說全面轉佳卻被錯殺是資金情緒問題；Kimi K3 的 AI 利空論是 DeepSeek 重演，本質是 Jevons Paradox。'
            '含完整重點、個股點名整理與我們自己的判斷。非投資建議。')
TAGS = ['Podcast', '股癌', '台積電', 'AI', 'JevonsParadox', '風險控管', '投資筆記']
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
    boundary = '----vocusGooayeDefenseBoundary'
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

POEM_LINES = ['莫聽穿林打葉聲，何妨吟嘯且徐行。', '竹杖芒鞋輕勝馬，誰怕？一蓑煙雨任平生。']
POEM_ATTR = '—— 蘇軾《定風波》（北宋，1082 年）'

BLOCKS = [
    ('img',),
    ('poem', POEM_LINES, POEM_ATTR),
    ('p', R('如果你只有 30 秒：',
            ('這一波台美股「指數還撐在高檔、個股卻跌到懷疑人生」的分化，主委在最新一集給了一個跟主流很不一樣的解讀——真兇不是哪個產業出事，而是資金結構在爆倉；台積電法說明明全面轉佳卻被錯殺；而市場拿來嚇人的「AI 利空」，其實是老劇本重演。', 1),
            ' 以下是完整筆記，最後附上我們自己的看法。')),

    ('h3', '節目介紹：股癌 Gooaye'),
    ('p', R('股癌是台灣訊號密度最高的財經播客之一，主持人「主委」（謝孟恭）以直白、反共識、重視風險紀律的盤面觀點著稱。節目長期強調「不要跟股票談戀愛」「先想怎麼輸再想怎麼贏」這類心法。以下整理是我們聽完最新一集後的重點筆記與延伸判斷，節目連結放在文末，強烈建議直接聽原文。')),

    ('h3', '判斷一：淨值回撤逾 15%，紀律性轉防守'),
    ('p', R('主委這集把紀律講得很清楚：',
            ('當淨值從高點回撤超過 15%，就依自訂規則切換到「防守模式」', 1),
            '——暫停追逐高 Beta 個股，改以台指期、0050 這類大盤工具進出。')),
    ('p', R('這不是「看空」，而是',
            ('降風險', 1),
            '的動作。重點在先保住本金、把波動壓下來，等市場結構重新站穩，再回到個股戰場。這跟我們一直講的一件事完全同調：停損與部位控制的紀律，比你對行情的判斷更決定生死。')),

    ('h3', '判斷二：「指數穩、個股慘」的真兇——韓國高槓桿 ETF 爆倉'),
    ('p', R('這是整集最有價值的一段。主委研判：',
            ('這一波台美股中小型股與高 Beta 族群的重挫，源頭是韓國大規模高槓桿 ETF 資金爆倉外溢', 1),
            '，連鎖導致全球風險資產的估值倍數被系統性下修——而不是哪個別產業出了基本面利空。')),
    ('p', R('證據就在市場的「分化」裡：')),
    ('ul', [
        R(('指數相對穩', 1), '：美股標普、台股加權，因為有巨頭與台積電這種權值股撐盤，維持在相對高檔。'),
        R(('個股很慘', 1), '：中小型股、高 Beta 概念股（光通訊、功率元件、ASIC/GPU 鏈）的跌幅遠大於指數。'),
    ]),
    ('p', R('如果是單一產業利空，不會出現這種「指數沒事、個股倒一片」的全面性倍數壓縮。',
            ('當殺的是「估值倍數」而不是「盈餘預期」，那通常是資金面、不是基本面。', 1),
            ' 這個區分，是這集最該記住的一課。')),

    ('h3', '判斷三：Kimi K3 的「AI 利空論」是誤讀——Jevons Paradox 又來一次'),
    ('p', R('市場近期流傳幾個「利空鬼故事」：中國低成本 AI 模型 Kimi K3（Moonshot AI）、成熟製程搶單等等，被拿來當作「AI 算力需求要縮」的理由。主委的判斷很直接：',
            ('這跟當年 DeepSeek 事件是同一種市場誤判。', 1),
            ' 本質是 Jevons Paradox（傑文斯悖論）——')),
    ('p', R(('當一項資源的使用效率提升，總消耗量往往不減反增。十九世紀煤炭燒得更有效率，結果煤的總用量不降反升，因為便宜讓應用場景大爆發。', 2))),
    ('p', R('套到 AI 上：模型變便宜、變有效率，',
            ('不會讓算力需求縮小，反而會讓 AI 應用鋪得更廣、把總需求撐得更大', 1),
            '。低成本模型參數量仍然龐大，對 AI 伺服器的需求並不構成利空。把「效率提升」直接讀成「利空」，是一階思維的陷阱。')),

    ('h3', '貫穿全場的案例：台積電被錯殺'),
    ('p', R('主委用台積電當這集的主要案例，說明「資金面 vs 基本面」的差別：')),
    ('ul', [
        R(('法說全面轉佳', 1), '：Q2 毛利率 67.7% 符合預期；CAPEX 由原本的 52–56B 意外上修到 60–64B——這是驚喜，代表需求端強到要加大投資。'),
        R(('先進封裝產能吃緊', 1), '：法說甚至暗示樂見 Intel 的 EMIB-T 等競爭者分擔後段封裝壓力，好讓自己前段產能放量。這是供不應求的訊號，不是壞消息。'),
        R(('股價卻重挫', 1), '：財報這麼漂亮、股價卻被打下來——主委的定性是市場情緒面的非理性反應，不是基本面惡化。'),
    ]),
    ('p', R('換句話說，台積電正是「判斷二」的縮影：',
            ('盈餘沒問題、被殺的是倍數。', 1))),

    ('h3', '產業脈動：漲價信不斷，股價卻不理'),
    ('p', R('這集的產業觀察也呼應同一條主軸——基本面在往上，股價在往下：')),
    ('ul', [
        R(('記憶體', 1), '：美光、韓系大廠財報「低 guide、高 beat」，族群股價雖然重摔，產業前景依然強勁。'),
        R(('被動元件、載板、玻纖布', 1), '：多項漲價信不斷，需求端明顯偏緊。'),
        R(('ADI（Analog Devices）', 1), '：7 月也發出漲價信，顯示類比、工業需求端仍強。'),
    ]),
    ('p', R('這些「漲價信」都是需求還在的硬證據，但股價普遍沒反映——主因就是前面說的全球估值倍數被系統性下修。於是整個盤呈現「指數穩、個股慘」的分化格局，把資金面錯殺看成基本面轉壞的人，最容易在這種盤被洗掉。')),

    ('h3', '主委這集的個股點名整理'),
    ('p', R(('以下為主委在節目上的個人觀點之整理，方括號內是我們的一句補充，皆非本站的買賣建議或目標價。個股投資請自行判斷。', 2))),
    ('p', R(('台股', 1))),
    ('ul', [
        R(('台積電（TSMC）', 1), '——看多。Q2 財報與 CAPEX 上修都優於預期，法說無敗象，股價重挫視為市場非理性反應而非基本面轉弱。〔全集「資金面 vs 基本面」的核心示範。〕'),
        R(('飛捷', 1), '——看多（本集新點名）。POS 機 IPC 廠，獲利率創新高、軟體營收成長數倍，但股價未反映基本面；主委建議長期投資者可逢低小量佈局並保持耐性。〔典型「業績股」——用實際獲利而非題材說話。〕'),
        R(('聯發科（MTK）', 1), '——看多。主委引述友人看法，認為股價被低估、理應有更高評價。'),
        R(('「諧音哏 all in」的反面教材', 1), '——有聽眾把資金 all in 一檔諧音哏概念股，主委拿它當「別為題材梗重壓」的警惕案例。〔重點不是嘲笑誰，而是提醒：把身家壓在一個梗上，是把投資當賭博。〕'),
    ]),
    ('p', R(('美股', 1))),
    ('ul', [
        R(('Micron（美光）', 1), '——看多。財報模式與台積電類似（低 guide、高 beat），記憶體族群股價雖重摔，產業前景依然強勁，屬情緒面錯殺。'),
        R(('ADI（Analog Devices）', 1), '——看多。7 月發出漲價信，需求端仍強，惟股價未反映、市場氛圍偏弱。'),
        R(('Intel', 1), '——中性。EMIB-T 先進封裝若能成功，將有助分擔台積電後段封裝壓力，屬產業互補而非純負面競爭。'),
        R(('Tesla', 1), '——中性偏多。主委長期持有並看好；提到馬斯克 AI5／AI6 晶片的成本考量對供應鏈的影響。'),
        R(('SpaceX', 1), '——看多。主委持續加碼、高度肯定其企業文化與執行速度，屬長期信仰型持股。'),
        R(('Apple', 1), '——中性（案例佐證）。先前因記憶體相關訊息股價下跌，後續仍創新高——說明「短期利空不代表長期趨勢」。'),
        R(('Credo、Astera Labs（ALAB）', 1), '——案例佐證。兩檔都是「年初重挫後強力反彈」的高 Beta 案例，說明基本面未變、市場論述反覆才造成股價大幅波動。〔高 Beta 在 risk-off 跌得最兇，但跌深 ≠ 基本面壞。〕'),
    ]),
    ('p', R(('中國', 1))),
    ('ul', [
        R(('Kimi K3（Moonshot AI）／DeepSeek', 1), '——中性，駁「AI 利空」論。市場誤解低成本模型是算力利空；主委認為模型參數量仍龐大、不影響 AI 伺服器需求，與 DeepSeek 同屬「效率提升＝利空」的錯誤解讀。'),
    ]),

    ('h3', '我們自己的看法（Realpha 判斷層）'),
    ('p', R('聽完這集，我們補三個框架性的判斷——不是喊單，是提供一套「怎麼想」的濾鏡：')),
    ('p', R(('一、先學會分辨「殺倍數」還是「殺盈餘」。', 1),
            ' 當一檔股票財報轉佳、漲價信不斷、需求端明明變強，股價卻跟著大盤倍數一起被壓下來，那多半是資金面錯殺；反之，如果是財測下修、客戶砍單、庫存暴增，那才是基本面轉壞。前者是機會、後者是陷阱——但兩者在盤面上「看起來一樣紅」。分不出來，就會在錯殺時嚇跑、在真壞時死抱。')),
    ('p', R(('二、「業績股 vs 本夢比」在 risk-off 的韌性天差地遠。', 1),
            ' 主委這集明顯轉向偏好用實際獲利說話的業績股。這跟我們自己驗證過的結論一致：在估值倍數被系統性下修的環境裡，有盈餘、估值有錨的股票，抗跌性遠勝純題材股。我們做過的因子驗證裡，「估值錨（便宜倍數）」是少數能穩定過關的訊號——但它只在便宜的那一端有效，追高買貴一樣會受傷。換句話說：業績股不是萬靈丹，是「便宜的業績股」才是。')),
    ('p', R(('三、對「公開看空個股」保持敬畏。', 1),
            ' 主委這集也更謹慎於公開評論個股、尤其是看空標的——這不是膽小，是對「出貨」與「報復性攻擊」的風險管理。這點我們高度認同，也是我們對外只賣「判斷框架」、不喊個股買賣的原因之一。')),

    ('h3', '我們能學到什麼：三個帶得走的啟示'),
    ('ol', [
        R(('殺倍數 ≠ 殺基本面。', 1), '資金面錯殺與基本面轉壞在盤面上長得一樣，但一個是機會、一個是陷阱。學會看「被殺的是盈餘還是估值倍數」，是這集最值錢的一課。'),
        R(('效率提升不等於需求萎縮（Jevons Paradox）。', 1), '每次有「更便宜的技術」出現，市場就慣性把它讀成利空。但歷史一再證明，變便宜往往是把餅做大、不是把餅縮小。新聞標題只是起點，往下推兩三跳才是分析。'),
        R(('紀律是先寫好、再執行的。', 1), '「回撤 15% 轉防守」之所以有用，是因為它在冷靜時就定好了、在恐慌時才照著做。先想怎麼輸、再想怎麼贏——把規則寫死，才不會被情緒帶著走。'),
    ]),

    ('h3', '推薦你去聽原文'),
    ('p', R('我們的筆記再詳細，也濃縮不了主委在節目上臨場的語氣、節奏與那些即興的比喻。強烈建議直接去聽整集（Apple Podcasts／Spotify／Firstory 搜尋「股癌 Gooaye」即可）。')),
    ('p_link', '部落格完整中英版：blog.getrealpha.com', BLOG_URL),
    ('p', R(('本文為公開播客的聽後筆記與教育性整理，內容為節目主持人的個人觀點，不代表本站立場，也不構成任何個股買賣建議、目標價或投資勸誘。文中提及之個股漲跌與操作觀點皆為節目主持人所述，投資有風險、槓桿工具（如台指期）風險尤高，任何決策請自行判斷或諮詢合格的專業人士。', 2))),
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

def poem_para(lines, attr):
    kids = []
    for i, ln in enumerate(lines):
        kids.append(t_node(ln, 2))
        kids.append(linebreak())
    kids.append(t_node(attr, 2))
    return para(kids)

def build(img_url):
    lex_children = []
    for b in BLOCKS:
        k = b[0]
        if k == 'img': lex_children.append(image_node(img_url))
        elif k == 'poem': lex_children.append(poem_para(b[1], b[2]))
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
            inner = '<br>'.join(f'<i><em class="lexical__textItalic" style="white-space: pre-wrap;">{esc(x)}</em></i>' for x in (b[1] + [b[2]]))
            parts.append(f'<p class="graf--p" dir="ltr">{inner}</p>')
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
