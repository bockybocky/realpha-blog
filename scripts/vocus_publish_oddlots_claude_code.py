# -*- coding: utf-8 -*-
"""Odd Lots 專訪 Claude Code 負責人 — 心得文發方格子。
用法：python vocus_publish_oddlots_claude_code.py [--publish]
模板沿用 vocus_publish_odd_lots_lawyers.py（2026-07-15）。
"""
import json, math, sys, datetime, re, os
import urllib.request

S = r'D:\Temp\claude\C--Users-Charles\f258db6c-4511-42e9-8f65-a39cf0c142c1\scratchpad'
TOK = open(os.path.join(S, 'vocus_token.txt'), encoding='utf-8').read().strip()
CTX = json.load(open(os.path.join(S, 'vocus_ctx.json'), encoding='utf-8'))
AID = CTX['aid']
IMG_URL = CTX['img_url']
IMG_W, IMG_H = CTX['w'], CTX['h']

TITLE = '電腦該擺在辦公室的角落，還是中央？聽 Odd Lots 專訪 Claude Code 之父'
ABSTRACT = ('Bloomberg《Odd Lots》訪問 Anthropic 的 Boris Cherny。整集最戳到我的不是 AI 有多強，'
            '而是他搬出一篇 1990 年代的舊研究：同樣買了電腦，有些公司生產力大增，有些完全沒有。'
            '差別從來不在買了什麼。附我自己的三點延伸與心境。')
TAGS = ['Odd Lots', 'AI', '護城河']
CATEGORY = {'_id': '5a978e00fd897800016874cc', 'title': '投資理財', 'score': 0}
EP_URL = 'https://omny.fm/shows/odd-lots/the-creator-of-claude-code-on-the-hottest-piece-of-software-in-the-world'


def parse_runs(text):
    parts = re.split(r'\*\*(.+?)\*\*', text)
    runs = []
    for i, seg in enumerate(parts):
        if seg == '':
            continue
        runs.append((seg, 1 if i % 2 == 1 else 0))
    return runs


BLOCKS = [
    ('img',),
    ('poem_lines', [
        '有機械者必有機事，',
        '有機事者必有機心。',
        '—— 《莊子・天地》（戰國）',
    ]),

    ('h3', '先說這個節目'),
    ('p', 'Odd Lots 是 Bloomberg 旗下的財經節目，2015 年開播，兩位主持人是 Joe Weisenthal 和 Tracy Alloway，內容涵蓋金融、市場、經濟與商業，在華爾街圈子裡算是必聽的一檔。'),
    ('p', '我自己會固定聽它，是因為它的選題跟一般財經節目不一樣。多數節目追的是「這週漲跌怎麼看」，Odd Lots 追的是市場底層那些沒人想講但其實決定一切的東西——貨櫃運價怎麼形成、電網怎麼定價、某個沒聽過的零件為什麼卡住整條供應鏈。用一句話說，它做的是結構，不是雜音。這也是為什麼它的內容比較耐放，一集兩年後聽還是有用。'),
    ('p', 'Joe Weisenthal 早年自己創了一個財經網站 TheStalwart.com，後來去 Business Insider，再進 Bloomberg，目前是 Bloomberg 數位新聞的執行編輯。他的提問風格是那種會一路追到底的類型，你打太極他會再問一次。'),
    ('p', 'Tracy Alloway 有將近二十年的財經新聞資歷，進 Bloomberg 之前是《金融時報》的美國財經特派，跑銀行與市場線，也當過 FT Alphaville 的副主編；到 Bloomberg 後曾管過亞太新聞中心。她問問題的角度通常比較刁，常常是從「這件事對從業者的日常會怎樣」切進去。'),
    ('p', '兩個人搭配的效果是：一個追邏輯，一個追現場。'),
    ('p_cta', [
        ('原集連結（強烈建議聽原音）：', None),
        ('The Creator of Claude Code on The Hottest Piece of Software in the World', EP_URL),
        ('（約 66 分鐘，2026 年 7 月 20 日）', None),
    ]),

    ('h3', '再說這位來賓'),
    ('p', 'Boris Cherny 是 Anthropic 的 Claude Code 負責人，也是這個產品最初的打造者。'),
    ('p', '他進 Anthropic 之前在 Meta 待了很久，做到主任工程師，在 Instagram 主導過幾次大型程式庫的現代化與遷移，也負責過全公司的程式碼品質。他還寫過一本 O\'Reilly 出版的程式語言書——這件事在訪談裡有呼應，他自己說他是個語言宅，很愛型別系統。'),
    ('p', '訪談裡他還提到一件私事：他外公在蘇聯時代寫過程式，用的是打孔卡；他媽媽小時候會拿外公帶回家的成疊打孔卡塗鴉。這個細節後面會變成他講整段產業史的起點。'),

    ('h3', '這集在講什麼'),
    ('p', '一句話總結我聽到的：**這兩年真正變的不是工具有多強，而是「人跟機器的分工線」被往上推了兩層，而多數組織還沒把自己的流程跟著往上搬。**'),

    ('h3', '我摘的重點'),
    ('ul', [
        '**這個產品是安全研究的副產品**：他說模型沒有身體，作用於世界的方式就是寫程式，所以要研究模型安不安全，就得先讓它很會寫程式、再交到人手上看真實世界怎麼用。',
        '**成長曲線幾乎全是模型給的，不是介面給的**：主持人直接問是殼做得好還是模型變強，他答得很乾脆——幾乎全是模型。',
        '**雕塑家蒙著眼**：我最喜歡的比喻。就算你是世界第一的雕塑家，蒙著眼又不能用手摸，作品也就那樣；能偷瞄一眼會好一點；能完整看見並邊看邊修，才可能雕出驚人的東西。',
        '**五十年只動兩層，這兩年跳了兩次**：他從外公的打孔卡講到作業系統軟體化，說這條線停在原地約五十年；現在先是人不再直接寫程式、改成跟模型講，接著又跳一層。',
        '**護城河裡有一項正在貶值**：他用《七種力量》那套框架講，轉換成本這一種會明顯變弱，因為要換廠商時可以直接叫模型幫你搬。但他馬上補一句——真正的大公司從來不只有一種護城河，其他大部分還跟以前一樣強。',
        '**有一類專案從「算不過來」變成「算得過來」**：他舉了一個程式庫遷移案例，一個人、約十一天、燒掉約五萬美元額度，過去是好幾個工程師做上一年的量，「所以我們以前根本不會做。」重點不是快了幾倍，是一整類過去因為划不來而永遠不會發生的事，現在會發生了。',
        '**1996 年那篇舊研究**：全集我認為最有價值的一段。當年有人問，個人電腦都來了，為什麼企業沒得到生產力提升？答案是有些公司只是在辦公室角落擺一台電腦，指派一個人負責把資料輸進去——流程還是紙筆，那只是多了一個職位。真正受益的公司把電腦搬到中央，把紙本全數位化，然後把文件櫃扔掉，接著一個一個瓶頸拆下去。',
        '**結尾主持人自己的提問比訪談更耐嚼**：人有沒有可能在沒做過基本功的情況下，達到某個領域的最高層次？他用吉他手作比——真正厲害的人會在意用哪種弦、拾音器怎麼排、音箱用哪種真空管，這些都不是樂理，卻構成了手感。',
    ]),

    ('h3', '延伸想法一：「把電腦擺在角落」是現在多數 AI 導入的真實樣貌'),
    ('p', '買很多席次發下去，然後期待生產力自己長出來——這就是 1996 年那些沒得到提升的公司在做的事。差別在於有沒有人願意一個一個把瓶頸拆掉，並且把舊的文件櫃真的扔掉。而扔掉文件櫃從來是政治問題，不是技術問題：那個櫃子通常是某個人的職權範圍。'),
    ('p', '這件事對我自己也成立。這一年做的東西，凡是「工具接上去、流程沒改」的最後都沒留下來；凡是逼自己把某個環節整段拆掉重寫的，才真的省下時間。'),

    ('h3', '延伸想法二：護城河貶值這件事，要分清楚是哪一項在貶'),
    ('p', '市場上關於 AI 殺軟體股的討論，常常是整包喊——不是「軟體業要完了」就是「AI 根本取代不了」。但他那個講法是有結構的：貶值的是轉換成本這一項，其他項不動。'),
    ('p', '這對判讀一家公司有用得多。你可以去問：這家公司的護城河是什麼組成的？如果它的定價權主要靠「客戶搬不走」，那風險是真的；如果它同時有網路效應、或卡在某個沒人繞得過去的環節上，那市場一起殺的時候，反而是分辨得出好壞的時候。'),
    ('p', '順著這個講，我一直比較在意的是卡點——某個環節有沒有替代品、繞不繞得過去。轉換成本是一種人造的卡點，可以被工具溶掉；物理上、產能上、規格上的卡點不行。這兩種東西在財報上看起來都叫「議價能力」，但在這一波裡的命運完全不同。'),

    ('h3', '延伸想法三：回饋迴路比指令重要，這件事被嚴重低估'),
    ('p', '遇到模型做不好，多數人第一反應是把指令寫得更詳盡。但照他的說法，指令再好也只是讓第一刀更準，成品高度取決於它能不能看見自己做了什麼。所以更該問的是：這件事有沒有一個機器自己能驗證對錯的訊號？沒有的話，先把那個訊號做出來，比多寫五百字指令有用。'),
    ('p', '這跟投資是同一件事。一個沒有到期日、沒有驗證方式的判斷，講得再漂亮也不會進步，因為它從來不會被打臉。'),

    ('h3', '我這陣子的心境'),
    ('p', '老實說，聽到「他自己 100% 的程式碼都由模型寫」那段時，我第一個反應不是興奮，是有點悶。'),
    ('p', '莊子那個抱著甕去澆水的老人，子貢勸他用省力的機械，老人回說有機械就有機巧的事，有機巧的事就有機巧的心。我以前讀這段覺得是酸腐。現在覺得他不是不懂那台機器，是懂了之後才決定不用。'),
    ('p', '我沒有要學那位老人，工具我照用，而且用得比多數人凶。但主持人最後那個問題我沒法輕鬆放過：當基本功可以外包，判斷力還長得出來嗎？'),
    ('p', '我暫時的答案是：**判斷力長在你被打臉的次數上，不長在你敲了多少鍵盤。所以基本功可以外包，對答案不行。**'),

    ('h3', '可以參考的資料'),
    ('ul', [
        '原集：Odd Lots — The Creator of Claude Code on The Hottest Piece of Software in the World（連結見上方，各大 podcast 平台搜 Odd Lots 都有）',
        '我推薦聽原音，不要只看摘要（包括我這篇）。他講話很收斂，講到不確定的地方會直說不確定；兩位主持人問得很兇，而且不接受打太極；結尾那十分鐘是主持人自己的思考，價值不輸訪談本體。',
        '有影片版，中段有一小段實機示範，那部分建議看畫面。',
    ]),

    ('p_italic', '本文是聽後心得與個人延伸想法，不是節目內容的完整轉述，也不是投資建議。文中提及之公司僅為轉述節目談話，不構成任何買賣建議。引用內容版權屬原節目所有，鼓勵收聽原文。'),
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
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'list', 'version': 1, 'listType': 'number' if ordered else 'bullet',
            'start': 1, 'tag': 'ol' if ordered else 'ul'}


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
        lex_children.append(para([t_node(seg, 2) for seg, _f in parse_runs(b[1])]))
    elif kind == 'p_cta':
        kids = []
        for text, url in b[1]:
            kids.append(t_node(text) if url is None else link_node(text, url))
        lex_children.append(para(kids))
    elif kind == 'h3':
        lex_children.append(heading(b[1]))
    elif kind == 'ul':
        lex_children.append(list_node(b[1], False))
    elif kind == 'ol':
        lex_children.append(list_node(b[1], True))

lexical_obj = json.dumps({'root': {'children': lex_children, 'direction': 'ltr', 'format': '',
                                   'indent': 0, 'type': 'root', 'version': 1}}, ensure_ascii=False)


# ---------- HTML ----------
def runs_html(text):
    out = []
    for seg, fmt in parse_runs(text):
        e = seg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        out.append(f'<strong>{e}</strong>' if fmt == 1 else e)
    return ''.join(out)


html_parts, plain_text = [], []
for b in BLOCKS:
    kind = b[0]
    if kind == 'img':
        html_parts.append(f'<figure class="image"><img src="{IMG_URL}" width="{IMG_W}" height="{IMG_H}"></figure>')
    elif kind == 'poem_lines':
        html_parts.append('<p>' + '<br>'.join(f'<em>{l}</em>' for l in b[1]) + '</p>')
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
            kids.append(runs_html(text) if url is None else f'<a href="{url}" target="_blank" rel="noopener">{text}</a>')
            plain_text.append(text)
        html_parts.append('<p>' + ''.join(kids) + '</p>')
    elif kind == 'h3':
        html_parts.append(f'<h3>{b[1]}</h3>')
        plain_text.append(b[1])
    elif kind in ('ul', 'ol'):
        lis = ''.join(f'<li>{runs_html(i)}</li>' for i in b[1])
        html_parts.append(f'<{kind}>{lis}</{kind}>')
        plain_text.extend(re.sub(r'\*\*', '', i) for i in b[1])

content_html = ''.join(html_parts)
words = len(''.join(plain_text))
reading = max(1, math.ceil(words / 600))


def api(method, path, body):
    r = urllib.request.Request('https://api.vocus.cc' + path, method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc', 'Referer': 'https://vocus.cc/'})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='replace')


now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

st, body = api('PATCH', f'/api/articles/{AID}/draft', {
    'title': TITLE, 'lexicalObj': lexical_obj, 'articleId': AID,
    'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
print('draft PATCH:', st, body[:100])

st, body = api('PATCH', f'/api/articles/{AID}', {
    'title': TITLE, 'content': content_html, 'contentConvertedAt': now,
    'catalog': '[]', 'showCatalog': True, 'wordsCount': words, 'readingTime': reading,
    'abstract': ABSTRACT, 'thumbnailUrl': IMG_URL, 'noThumbnailImage': False,
    'ogImageType': 'thumbnail', 'coverSource': 'upload',
    'tags': [{'title': t} for t in TAGS], 'newCategory': CATEGORY,
    'isInvestment': True, 'setInvestment': True, 'adult': False, 'lexicalObj': lexical_obj})
print('metadata PATCH:', st, body[:100])

r = urllib.request.Request(f'https://api.vocus.cc/api/article/{AID}',
    headers={'Authorization': f'Bearer {TOK}', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(r, timeout=20) as resp:
    a = json.loads(resp.read()).get('article', {})
print(f"readback: status={a.get('status')} | cat={a.get('newCategory',{}).get('title')} | "
      f"inv={a.get('isInvestment')} | thumb={str(a.get('thumbnailUrl'))[:60]} | words={a.get('wordsCount')}")
print(f"區塊數 lexical={len(lex_children)} html={len(html_parts)}")

if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('publish:', st, body[:80] if body else '(204)')
    print(f'網址: https://vocus.cc/article/{AID}')
