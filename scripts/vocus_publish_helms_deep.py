# -*- coding: utf-8 -*-
"""聖盔谷的城牆 — lexical JSON + vocus HTML，PATCH 草稿與 metadata。
用法：python vocus_publish_helms_deep.py [--publish]
"""
import json, math, sys, datetime, re, os
import urllib.request

SP = r'D:\Temp\claude\C--Users-Charles\91f46585-b557-4852-a837-7983608294fd\scratchpad'
TOK = open(os.path.join(SP, 'vocus_token.txt'), encoding='utf-8').read().strip()
AID = '6a5d8692fd897800013eee1f'
_img = open(os.path.join(SP, 'vocus_img.txt'), encoding='utf-8').read().strip().split('|')
IMG_URL, IMG_W, IMG_H = _img[0], int(_img[1]), int(_img[2])
BLOG_URL = 'https://blog.getrealpha.com/blog/helms-deep-no-safe-fortress/'
TITLE = '聖盔谷的城牆：崩盤時，最安全的避難所是紀律，不是台積電'
ABSTRACT = ('崩盤時人人想退到最穩的股票避難，像魔戒退守聖盔谷。但聖盔谷的城牆被炸開了，'
            '台積電交出好財報卻照跌 6%。一則關於「沒有絕對避難所」的思考：'
            '真正的防守是一個動作，不是一個地點。')
TAGS = ['風險控管', '防守紀律', '市場心理']
CATEGORY = {'_id': '5a978e00fd897800016874cc', 'title': '投資理財', 'score': 0}

BLOCKS = [
    ('img',),
    ('poem_lines', ['國破山河在，', '城春草木深。', '—— 杜甫《春望》（唐，約 757 年）']),

    ('h3', '崩盤時，我們都在找一座聖盔谷'),
    ('p', '看過《魔戒》的人都記得聖盔谷——洛汗人最後的堡壘。大軍壓境，打不贏了，所有人就往那道高牆後面退，把最脆弱的老弱婦孺塞進最深的山洞，賭這道牆守得住。'),
    ('p', '崩盤時的市場，人心是一模一樣的。盤勢一壞，資金會本能地往「最安全的那一檔」退——在台股，那就是台積電。股癌把這種標的叫「聖杯股」：大家充滿母愛、覺得最穩、最安全、又相對便宜的東西。恐慌一來，中小型股的錢被抽出來，一股腦往聖杯股裡堆。'),
    ('p', '這是很合理的直覺。問題是，這個直覺藏著一個致命的漏洞。'),

    ('h3', '城牆會破'),
    ('p', '聖盔谷的結局，很多人忘了：**那道牆最後被炸開了。** 薩魯曼在牆根埋了火藥，轟出一個缺口，敵軍長驅直入。守軍不是靠城牆贏的——他們是棄守城牆、退到內堡，最後靠外援天亮反攻才活下來。城牆本身，破了。'),
    ('p', '近期的市場給了一個幾乎同構的畫面。台積電交出一份好到很難挑剔的第二季財報：不只獲利漂亮，連資本支出都往上大幅上修——這在半導體是強訊號，代表對未來需求的信心。照理說是大利多。結果呢？**隔天股價直接跌了 6%。**'),
    ('p', '好財報配上重挫，市場總會急著找理由。但重點不在那天跌多少，而在於：**當所有人退守的那座堡壘，自己都守不住的時候，「退到最安全的地方」這個策略，本身就出了問題。** 你以為躲進了聖盔谷，結果城牆在你眼前爆開一個洞。'),

    ('h3', '防守是一個動作，不是一個地點'),
    ('p', '這裡藏著一個很多人沒想通的分野。'),
    ('p', '「退到最安全的股票」是一種**空間思維**——把防守想成「找一個地方躲進去」。但市場沒有絕對安全的地方。你以為的避風港（聖杯股、權值股、甚至現金），在不同的風暴裡各有各的破口：聖杯股會被外資提款、現金會被通膨和踏空慢慢磨掉。找地方躲，永遠躲不乾淨。'),
    ('p', '真正的防守是一種**時間與紀律思維**——防守不是「躲到哪裡」，而是「什麼條件成立，我就降低風險」這個**動作**。它跟你躲在哪一檔無關，跟你有沒有一條事先畫好、到了就執行的線有關。'),
    ('p', '有意思的是，連最會找聖杯股的人，實際做法也是後者。近期股癌自己就說了：當他的淨值從高點回檔到某個幅度、大盤又跌破季線，他就切換成防守模式——不是死抱某一檔堡壘，而是縮小部位、改用指數工具（台指期／0050）、暫停積極進攻。**防守被他執行成一個動作（降風險），不是一個地點（躲進台積電）。** 事實上他也承認，那次「不知道買什麼、先趴進台積電」，結果台積電就給他炸了 6%——連他退守的堡壘都破口了。救他的不是那道牆，是他自己那條「回檔到線就轉守」的紀律。'),

    ('h3', '避難所迷思的三個陷阱'),
    ('p', '我們把這個「找堡壘」的直覺，拆成三個常見的陷阱：'),
    ('p', '**一、把「相對安全」誤讀成「絕對安全」。** 聖杯股在崩盤裡通常跌得比別人少——這是真的，但「跌比較少」不等於「不會跌」。當你因為它「最安全」而重壓、甚至加槓桿進去，你其實是在最不該集中的時候集中。安全感最強的地方，往往是部位失控的起點。'),
    ('p', '**二、用一個決定取代一套機制。** 「退到台積電」是一個一次性的決定，做完就沒事了，很省心。但市場不會因為你做了決定就停止變化。防守如果只是「換一檔股票」，那你根本沒有防守，你只是換了個位置繼續滿倉。真正的防守是一套會持續運作的規則：什麼時候減、減多少、什麼條件才加回來。'),
    ('p', '**三、把「不動」當成防守。** 崩盤時最誘人的另一個選項是「全部換現金、收手不玩」。看起來最安全，但這是另一種形式的賭——賭你有本事在對的時間點切回去。多數人切不回去：從一萬點抱現金抱到四萬點的人，短期看很聰明，長期輸最大。防守不是離場，是降檔——把油門收小，但手還在方向盤上。'),

    ('h3', '國破山河在'),
    ('p', '杜甫寫「國破山河在」的時候，長安已經淪陷。城破了，但山河還在，草木照樣春天發芽。這句話一千兩百年後放在市場上，意外地精準：**堡壘會失守，但市場這片山河會繼續向前。**'),
    ('p', '所以真正的防守，從來不是找一座打不破的城牆——那座牆不存在。而是接受城牆會破這個前提，然後把力氣放在你真正能控制的事上：畫好那條線、部位不失控、訊號到了就執行那個降風險的動作，然後留在場內，等山河的春天。'),
    ('p', '這也是我們一直在做的事——與其猜哪座堡壘最堅固，不如把每一個判斷的進場理由和失效條件事先寫下來、公開對答案。防守不是一個你可以躲進去的地方，是一件你每天都要重新做一次的事。'),

    ('p_cta', [
        ('完整版（含英文）在我們的部落格：', None),
        ('聖盔谷的城牆', BLOG_URL),
        ('。', None),
    ]),
    ('p_italic', '本文為教育性討論與投資思考，非投資建議；文中個股（含台積電）僅為說明市場心理與風險概念的例子，不構成任何買賣推薦，亦無目標價，持有與否請自行研究。「聖杯股」為股癌節目常用的公開說法，聖盔谷的比喻與延伸推論為本文觀點；引用之節目概念版權屬原節目所有，鼓勵收聽原文。'),
    ('p_cta', [
        ('AI 時代觀點氾濫、驗證稀缺——我把自己的市場判讀公開公證、到期對答案：', None),
        ('驗證簿', 'https://blog.getrealpha.com/ledger'),
        ('。也歡迎', None),
        ('出題', 'https://blog.getrealpha.com/propose'),
        ('，一起篩真實資訊。', None),
    ]),
]

def parse_runs(text):
    parts = re.split(r'\*\*(.+?)\*\*', text)
    runs = []
    for i, seg in enumerate(parts):
        if seg == '':
            continue
        runs.append((seg, 1 if i % 2 == 1 else 0))
    return runs

def t_node(text, fmt=0):
    return {'detail': 0, 'format': fmt, 'mode': 'normal', 'style': '', 'text': text, 'type': 'text', 'version': 1}
def para(children):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'paragraph', 'version': 1, 'textFormat': 0, 'textStyle': ''}
def heading(text):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'vocus-heading', 'version': 1, 'tag': 'h3'}
def image_node():
    return {'type': 'image', 'version': 1, 'format': '', 'src': IMG_URL, 'position': 'center', 'width': IMG_W, 'height': IMG_H, 'source': None,
            'captionObj': {'root': {'children': [], 'direction': None, 'format': '', 'indent': 0, 'type': 'root', 'version': 1}}}
def linebreak():
    return {'type': 'linebreak', 'version': 1}
def link_node(text, url):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'link', 'version': 1, 'rel': None, 'target': None, 'title': None, 'url': url}
def listitem(children, value):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'listitem', 'version': 1, 'value': value}

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
        lex_children.append(para([t_node(seg, 2) for seg, _ in parse_runs(b[1])]))
    elif kind == 'p_cta':
        kids = []
        for text, url in b[1]:
            kids.append(link_node(text, url) if url else t_node(text))
        lex_children.append(para(kids))
    elif kind == 'h3':
        lex_children.append(heading(b[1]))

lexical_obj = json.dumps({'root': {'children': lex_children, 'direction': 'ltr', 'format': '', 'indent': 0, 'type': 'root', 'version': 1}}, ensure_ascii=False)

def runs_html(text):
    out = []
    for seg, fmt in parse_runs(text):
        e = seg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        out.append(f'<strong>{e}</strong>' if fmt == 1 else e)
    return ''.join(out)

html_parts, plain = [], []
for b in BLOCKS:
    kind = b[0]
    if kind == 'img':
        html_parts.append(f'<figure class="image"><img src="{IMG_URL}" width="{IMG_W}" height="{IMG_H}"></figure>')
    elif kind == 'poem_lines':
        html_parts.append('<p>' + '<br>'.join(f'<em>{l}</em>' for l in b[1]) + '</p>'); plain.extend(b[1])
    elif kind == 'p':
        html_parts.append(f'<p>{runs_html(b[1])}</p>'); plain.append(re.sub(r'\*\*', '', b[1]))
    elif kind == 'p_italic':
        html_parts.append(f'<p><em>{runs_html(b[1])}</em></p>'); plain.append(re.sub(r'\*\*', '', b[1]))
    elif kind == 'p_cta':
        kids = []
        for text, url in b[1]:
            kids.append(f'<a href="{url}" target="_blank" rel="noopener">{text}</a>' if url else runs_html(text)); plain.append(text)
        html_parts.append('<p>' + ''.join(kids) + '</p>')
    elif kind == 'h3':
        html_parts.append(f'<h3>{b[1]}</h3>'); plain.append(b[1])

content_html = ''.join(html_parts)
words = len(''.join(plain))
reading = max(1, math.ceil(words / 600))

def api(method, path, body):
    r = urllib.request.Request('https://api.vocus.cc' + path, method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc', 'Referer': 'https://vocus.cc/'})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
st, body = api('PATCH', f'/api/articles/{AID}/draft', {'title': TITLE, 'lexicalObj': lexical_obj, 'articleId': AID, 'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
print('draft PATCH:', st, body[:100])
st, body = api('PATCH', f'/api/articles/{AID}', {'title': TITLE, 'content': content_html, 'contentConvertedAt': now, 'catalog': '[]', 'showCatalog': True,
    'wordsCount': words, 'readingTime': reading, 'abstract': ABSTRACT, 'thumbnailUrl': IMG_URL, 'noThumbnailImage': False, 'ogImageType': 'thumbnail',
    'coverSource': 'upload', 'tags': [{'title': t} for t in TAGS], 'newCategory': CATEGORY, 'isInvestment': True, 'setInvestment': True, 'adult': False, 'lexicalObj': lexical_obj})
print('metadata PATCH:', st, body[:100])
r = urllib.request.Request(f'https://api.vocus.cc/api/article/{AID}', headers={'Authorization': f'Bearer {TOK}', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(r, timeout=20) as resp:
    a = json.loads(resp.read()).get('article', {})
print(f"readback: status={a.get('status')} cat={a.get('newCategory',{}).get('title')} inv={a.get('isInvestment')} thumb={str(a.get('thumbnailUrl'))[:60]} words={a.get('wordsCount')}")
if '--publish' in sys.argv:
    st, body = api('PATCH', f'/api/articles/{AID}/status/2', {'status': 2, 'showCatalog': True})
    print('publish:', st, body[:80] if body else '(204)')
    print('URL: https://vocus.cc/article/' + AID)
