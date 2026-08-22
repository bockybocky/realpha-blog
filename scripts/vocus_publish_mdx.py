# -*- coding: utf-8 -*-
"""把 blog 的 .zh-TW.mdx 直接轉成方格子文章並發佈（lexical JSON + vocus HTML）。

為什麼存在：先前每篇都把內文手抄成 Python 的 BLOCKS DSL（vocus_publish_ep68x.py 那批），
一篇抄一次、三篇抄三次，抄錯了兩邊內容就不一致。改成讀 mdx 當唯一來源。

用法：
    python vocus_publish_mdx.py prep  <slug> [<slug> ...]     # 傳封面 + 開草稿 → vocus_ids.json
    python vocus_publish_mdx.py draft <slug> [...]            # 上稿到草稿（不公開）
    python vocus_publish_mdx.py publish <slug> [...]          # 上稿並公開

slug ＝ blog 的檔名主幹（src/content/blog/<slug>.zh-TW.mdx）。
token 從 scratchpad 的 vocus_token.txt 讀（見 vocus-publish skill §token 取得）。
節點與 API 慣例沿用 vocus_publish_ep682_ep541.py。
"""
import json, math, os, re, struct, sys, uuid, datetime
import urllib.request, urllib.error

ROOT = r'C:\Users\Charles\projects\realpha-blog'
# 2026-08-22 點狀修（合議庭裁決 S2）：預設改指 blog_auto（ids SoT，與每晚排程同源、figures 工具同目錄）。
# 代價：舊預設不設 env 會 401 硬撞牆＝意外保險絲；改後零設定就能對正式帳號開真草稿。
#    保險絲換成 SKILL.md 第 0 步「線上實搜這篇發過沒有」（DEC-0523），不是消失。
SP = os.environ.get('VOCUS_SP') or r'C:\Users\Charles\scripts\blog_auto'
TOK = open(os.path.join(SP, 'vocus_token.txt'), encoding='utf-8').read().strip()
IDS_PATH = os.path.join(SP, 'vocus_ids.json')
CATEGORY = {'_id': '5a978e00fd897800016874cc', 'title': '投資理財', 'score': 0}
BLOG = 'https://blog.getrealpha.com'

# 非投資文 slug（isInvestment 不勾；分類仍沿用沙龍預設）
NON_INVESTMENT = {'local-ai-hardware-worth-it', 'herdr-agent-automation-vocus', 'lunchuizhe-2026-08-11-ai-content-factory', 'hardware-is-hard',
                  'dont-let-ai-say-no-problem'}

# 方格子關鍵字用中文才有搜尋價值，frontmatter 的英文 tag 不直接沿用
TAGS = {
    'local-ai-hardware-worth-it': ['本地AI', '硬體', 'NPU', '決策思考', 'AI工具'],
    'gooaye-ep683-cannot-see-the-mountain': ['股癌', '槓桿', '風險管理', '回測'],
    'gooaye-ep684-liquidity-carries-and-capsizes': ['股癌', '流動性', '風險管理'],
    'macromicro-ep209-the-half-eaten-peach': ['財經M平方', '資本支出', '自由現金流', '聯準會'],
    'serenity-x-reading-method': ['光通訊', '研究方法', '美股', '投資心得'],
    'herdr-agent-automation-vocus': ['AI', '終端機', '自動化', '工程方法', 'coding agent'],
    'lunchuizhe-2026-08-11-ai-content-factory': ['AI', '創作者經濟', 'YouTube', 'AI內容', '自媒體'],
    'sk-hynix-hbm-moat': ['半導體', '記憶體', 'HBM', '護城河', '美股'],
    'central-bank-two-traps': ['央行', '總體經濟', '穩定幣', '通膨'],
    'hardware-is-hard': ['硬體', '供應鏈', '新創', '護城河'],
    'supply-chained-midyear-2026': ['AI', '半導體', '供應鏈', '通膨', '美股'],
}

# 封面檔名不一定等於 slug（早期幾篇用短名），對不上時在這裡指名
COVERS = {
    'local-ai-hardware-worth-it': 'local-ai-hardware-worth-it.png',
    'gooaye-ep683-cannot-see-the-mountain': 'gooaye-ep683-cover.png',
    'gooaye-ep684-liquidity-carries-and-capsizes': 'gooaye-ep684-cover.png',
    'herdr-agent-automation-vocus': 'herdr-agent-automation.png',
    # 2026-08-18：前後編兩篇共用同一張封面（後編的專屬封面當初沒產生成功，
    # mdx 指向的檔案是 404，已一併改指這張）
    'invsunday-2026-08-02-rehacq-interfm': 'invsunday-rehacq-takahashi-media-cover.png',
}


# ---------- mdx → blocks ----------
def parse_frontmatter(text):
    if not text.startswith('---'):
        raise ValueError('mdx 缺 frontmatter')
    end = text.index('\n---', 3)
    fm, body = text[3:end], text[end + 4:]
    out, key, buf = {}, None, []
    for line in fm.splitlines():
        m = re.match(r'^([a-zA-Z]+):\s*(.*)$', line)
        if m:
            if key:
                out[key] = ' '.join(buf).strip()
            key, buf = m.group(1), [m.group(2)]
        elif key:
            buf.append(line.strip())
    if key:
        out[key] = ' '.join(buf).strip()
    for k, v in out.items():
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] == '"':
            v = v[1:-1]
        out[k] = v
    return out, body.lstrip('\n')


def mdx_to_blocks(body):
    """把 mdx 內文轉成 vocus_publish 的 blocks。粗體 **x** 原樣留給 parse_runs 處理。"""
    blocks, lines, i = [], body.split('\n'), 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip():
            i += 1
            continue
        # 圖片 ![alt](/covers/x.png) 或內文圖 ![alt](/figures/x.svg)
        if ln.startswith('!['):
            m_img = re.match(r'!\[.*?\]\((.*?)\)', ln)
            blocks.append(('img', m_img.group(1) if m_img else ''))
            i += 1
            continue
        if ln.startswith('---'):          # 分隔線：方格子不支援，丟掉
            i += 1
            continue
        # 引用區塊：連續 > 開頭
        if ln.startswith('>'):
            quote = []
            while i < len(lines) and lines[i].startswith('>'):
                quote.append(lines[i][1:].strip())
                i += 1
            joined = [q for q in quote if q]
            # 詩引：每行帶 <br/> 或以 —— 收尾
            if any('<br/>' in q or q.startswith('——') for q in joined):
                poem = [re.sub(r'<br/>$', '', q).strip().strip('*') for q in joined]
                blocks.append(('poem_lines', [p for p in poem if p]))
            else:
                blocks.append(('p_italic', ' '.join(joined).replace('**', '')))
            continue
        if ln.startswith('#'):
            blocks.append(('h3', ln.lstrip('#').strip()))
            i += 1
            continue
        if ln.startswith('- '):
            items = []
            while i < len(lines) and lines[i].startswith('- '):
                items.append(lines[i][2:].strip())
                i += 1
            blocks.append(('ul', items))
            continue
        # 一般段落（mdx 是空行分段，段內不折行）
        blocks.append(('p', ln.strip()))
        i += 1
    # 最後一段免責改成斜體
    if blocks and blocks[-1][0] == 'p' and blocks[-1][1].startswith('**免責聲明**'):
        blocks[-1] = ('p_italic', blocks[-1][1].replace('**', ''))
    return blocks


def load_article(slug):
    path = os.path.join(ROOT, 'src', 'content', 'blog', slug + '.zh-TW.mdx')
    fm, body = parse_frontmatter(open(path, encoding='utf-8').read())
    abstract = fm.get('description', '')
    if len(abstract) > 150:
        abstract = abstract[:147].rstrip('，。、') + '…'
    return {'title': fm['title'], 'abstract': abstract,
            'tags': TAGS.get(slug, ['投資', '心得']),
            'blocks': mdx_to_blocks(body)}


# ---------- lexical / html 節點（沿用 ep682 那支） ----------
def parse_runs(text):
    parts = re.split(r'\*\*(.+?)\*\*', text)
    return [(seg, 1 if i % 2 else 0) for i, seg in enumerate(parts) if seg != '']


# 站內相對連結（/projects/、/blog/x/）也要收：方格子上沒有那些路徑，
# 不補成完整網址就會原樣印出 [文字](/路徑) 這串純文字。
LINK_RE = re.compile(r'\[([^\]]+)\]\((https?://[^)]+|/[^)]*)\)')


def split_links(text):
    """把 [文字](網址) 切出來 → [('t', 純文字, None) | ('a', 連結文字, 網址)]。"""
    out, pos = [], 0
    for m in LINK_RE.finditer(text):
        if m.start() > pos:
            out.append(('t', text[pos:m.start()], None))
        url = m.group(2)
        if url.startswith('/'):
            url = BLOG + url          # 相對路徑補成完整網址，方格子才連得回去
        out.append(('a', m.group(1), url))
        pos = m.end()
    if pos < len(text):
        out.append(('t', text[pos:], None))
    return out


def link_node(text, url):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'link', 'version': 1, 'rel': None, 'target': None,
            'title': None, 'url': url}


def inline_nodes(text):
    """段落/清單項的 lexical children：支援 **粗體** 與 [文字](網址)。"""
    kids = []
    for kind, seg, url in split_links(text):
        if kind == 'a':
            kids.append(link_node(seg, url))
        else:
            kids.extend(t_node(s, f) for s, f in parse_runs(seg))
    return kids


def inline_html(text):
    """對應的 HTML：連結出 <a>，其餘沿用 runs_html 的粗體處理。"""
    out = []
    for kind, seg, url in split_links(text):
        if kind == 'a':
            esc = seg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            out.append(f'<a href="{url}" target="_blank" rel="noopener">{esc}</a>')
        else:
            out.append(runs_html(seg))
    return ''.join(out)


def t_node(text, fmt=0):
    return {'detail': 0, 'format': fmt, 'mode': 'normal', 'style': '',
            'text': text, 'type': 'text', 'version': 1}


def para(children):
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'paragraph', 'version': 1, 'textFormat': 0, 'textStyle': ''}


def heading(text):
    return {'children': [t_node(text)], 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'vocus-heading', 'version': 1, 'tag': 'h3'}


def image_node(url, w, h):
    return {'type': 'image', 'version': 1, 'format': '', 'src': url, 'position': 'center',
            'width': w, 'height': h, 'source': None,
            'captionObj': {'root': {'children': [], 'direction': None, 'format': '',
                                    'indent': 0, 'type': 'root', 'version': 1}}}


def list_node(items):
    children = [{'children': inline_nodes(it),
                 'direction': 'ltr', 'format': '', 'indent': 0,
                 'type': 'listitem', 'version': 1, 'value': n + 1}
                for n, it in enumerate(items)]
    return {'children': children, 'direction': 'ltr', 'format': '', 'indent': 0,
            'type': 'list', 'version': 1, 'listType': 'bullet', 'start': 1, 'tag': 'ul'}


def runs_html(text):
    out = []
    for seg, fmt in parse_runs(text):
        esc = seg.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        out.append(f'<strong>{esc}</strong>' if fmt == 1 else esc)
    return ''.join(out)



# ---------- 內文圖（/figures/x.svg）→ 方格子圖床 ----------
# 為什麼要這段：build() 原本把 mdx 裡「每一個」圖片語法都畫成封面圖
# （早期每篇只有封面一張所以看不出來）。2026-08-18 起自動管線會插內文圖，
# 那個假設就壞了——當天那篇的 5 張內文圖全變成同一張封面圖。
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
FIG_PNG_DIR = r'C:\Users\Charles\scripts\blog_auto\figures\png'
FIG_CACHE = os.path.join(SP, 'vocus_fig_ids.json')


def figure_png(name):
    """圖只有 SVG，方格子上傳寫死 image/png，故先用 Edge 無介面截圖轉 PNG。冪等。"""
    png = os.path.join(FIG_PNG_DIR, name + '.png')
    svg = os.path.join(ROOT, 'public', 'figures', name + '.svg')
    if os.path.isfile(png):
        return png
    if not os.path.isfile(svg):
        raise FileNotFoundError('找不到內文圖 ' + svg)
    m = re.search(r'viewBox="0 0 (\d+) (\d+)"', open(svg, encoding='utf-8').read())
    if not m:
        raise ValueError('SVG 讀不到 viewBox：' + svg)
    W, H = int(m.group(1)) * 2, int(m.group(2)) * 2
    os.makedirs(FIG_PNG_DIR, exist_ok=True)
    tmp = os.path.join(FIG_PNG_DIR, '_conv.html')
    with open(tmp, 'w', encoding='utf-8') as fh:
        fh.write('<!doctype html><meta charset="utf-8">'
                 '<style>html,body{margin:0;padding:0;background:#fff}'
                 'img{width:%dpx;display:block}</style><img src="%s">'
                 % (W, 'file:///' + svg.replace('\\', '/')))
    import subprocess
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                    '--window-size=%d,%d' % (W, H), '--screenshot=' + png,
                    'file:///' + tmp.replace('\\', '/')],
                   capture_output=True, timeout=180)
    if not os.path.isfile(png):
        raise RuntimeError('SVG 轉 PNG 失敗：' + name)
    pw, ph = png_size(png)
    if (pw, ph) != (W, H):
        os.remove(png)
        raise RuntimeError('轉出的 PNG 尺寸 %dx%d 不符預期 %dx%d：%s' % (pw, ph, W, H, name))
    return png


def resolve_image(src, meta):
    """封面圖用線上封面；內文圖上傳一次後記在 vocus_fig_ids.json 重用。
    任何一步失敗都不中止發文，退回封面圖並大聲印警告（比整篇不發好）。"""
    if not src or '/figures/' not in src:
        return meta['imgUrl'], meta['w'], meta['h']
    name = os.path.splitext(os.path.basename(src))[0]
    cache = json.load(open(FIG_CACHE, encoding='utf-8')) if os.path.isfile(FIG_CACHE) else {}
    if name in cache:
        c = cache[name]
        return c['url'], c['w'], c['h']
    try:
        url, w, h = upload_img(figure_png(name))
    except Exception as e:
        print('⚠️ 內文圖處理失敗，這張退回封面圖：%s（%s）' % (name, e))
        return meta['imgUrl'], meta['w'], meta['h']
    cache[name] = {'url': url, 'w': w, 'h': h}
    with open(FIG_CACHE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
    return url, w, h


def build(art, meta):
    lex, html, plain = [], [], []
    for b in art['blocks']:
        kind = b[0]
        if kind == 'img':
            url, w, h = resolve_image(b[1] if len(b) > 1 else '', meta)
            lex.append(image_node(url, w, h))
            html.append(f'<figure class="image"><img src="{url}" '
                        f'width="{w}" height="{h}"></figure>')
        elif kind == 'poem_lines':
            kids = []
            for n, line in enumerate(b[1]):
                if n:
                    kids.append({'type': 'linebreak', 'version': 1})
                kids.append(t_node(line, 2))
            lex.append(para(kids))
            html.append('<p>' + '<br>'.join(f'<em>{l}</em>' for l in b[1]) + '</p>')
            plain.extend(b[1])
        elif kind == 'p':
            lex.append(para(inline_nodes(b[1])))
            html.append('<p>' + inline_html(b[1]) + '</p>')
            plain.append(b[1].replace('**', ''))
        elif kind == 'p_italic':
            lex.append(para([t_node(s, 2) for s, _ in parse_runs(b[1])]))
            html.append('<p><em>' + runs_html(b[1]) + '</em></p>')
            plain.append(b[1].replace('**', ''))
        elif kind == 'h3':
            lex.append(heading(b[1]))
            html.append(f'<h3>{b[1]}</h3>')
            plain.append(b[1])
        elif kind == 'ul':
            lex.append(list_node(b[1]))
            html.append('<ul>' + ''.join(f'<li>{inline_html(i)}</li>' for i in b[1]) + '</ul>')
            plain.extend(i.replace('**', '') for i in b[1])
        else:
            raise ValueError('未知 block: ' + kind)
    return lex, ''.join(html), len(''.join(plain))


# ---------- API ----------
def api(method, path, body):
    r = urllib.request.Request('https://api.vocus.cc' + path, method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc',
                 'Referer': 'https://vocus.cc/'})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='replace')


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('not a png: ' + path)
    return struct.unpack('>II', head[16:24])


def upload_img(path):
    w, h = png_size(path)
    boundary = uuid.uuid4().hex
    body = b''
    for field, value in (('width', str(w)), ('height', str(h))):
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"\r\n\r\n{value}\r\n').encode()
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="img"; '
             f'filename="{os.path.basename(path)}"\r\nContent-Type: image/png\r\n\r\n').encode()
    body += open(path, 'rb').read() + b'\r\n' + f'--{boundary}--\r\n'.encode()
    req = urllib.request.Request('https://api.vocus.cc/api/imgs', data=body, method='POST',
        headers={'Authorization': f'Bearer {TOK}',
                 'Content-Type': f'multipart/form-data; boundary={boundary}',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc',
                 'Referer': 'https://vocus.cc/'})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return 'https://images.vocus.cc/' + json.loads(resp.read())['relPath'], w, h


def new_article():
    req = urllib.request.Request('https://api.vocus.cc/api/articles', method='POST',
        data=json.dumps({'draftType': 'pad', 'title': ''}).encode(),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc',
                 'Referer': 'https://vocus.cc/'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())['_id']


def load_ids():
    return json.load(open(IDS_PATH, encoding='utf-8')) if os.path.isfile(IDS_PATH) else {}


def save_ids(ids):
    with open(IDS_PATH, 'w', encoding='utf-8') as f:
        json.dump(ids, f, ensure_ascii=False, indent=2)


def cmd_prep(slugs, reuse=None):
    ids = load_ids()
    for slug in slugs:
        if slug in ids:
            print(f'{slug}: 已有 {ids[slug]["articleId"]}，跳過（冪等）')
            continue
        cover = os.path.join(ROOT, 'public', 'covers', COVERS.get(slug, slug + '-cover.png'))
        if not os.path.isfile(cover):
            raise SystemExit(f'❌ 找不到封面 {cover}')
        url, w, h = upload_img(cover)
        aid = (reuse or {}).pop(slug, None) or new_article()
        ids[slug] = {'articleId': aid, 'imgUrl': url, 'w': w, 'h': h}
        print(f'{slug}: article={aid} img={url} {w}x{h}')
        save_ids(ids)


def cmd_push(slugs, publish):
    ids = load_ids()
    for slug in slugs:
        art, meta = load_article(slug), ids[slug]
        aid = meta['articleId']
        lex, content_html, words = build(art, meta)
        lexical_obj = json.dumps({'root': {'children': lex, 'direction': 'ltr', 'format': '',
                                           'indent': 0, 'type': 'root', 'version': 1}},
                                 ensure_ascii=False)
        now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

        st, body = api('PATCH', f'/api/articles/{aid}/draft', {
            'title': art['title'], 'lexicalObj': lexical_obj, 'articleId': aid,
            'obj': '', 'draftType': 'pad', 'commandLogs': '[]', 'createdAt': now})
        print(f'[{slug}] draft PATCH: {st} {body[:60]}')

        st, body = api('PATCH', f'/api/articles/{aid}', {
            'title': art['title'], 'content': content_html, 'contentConvertedAt': now,
            'catalog': '[]', 'showCatalog': True, 'wordsCount': words,
            'readingTime': max(1, math.ceil(words / 600)), 'abstract': art['abstract'],
            'thumbnailUrl': meta['imgUrl'], 'noThumbnailImage': False,
            'ogImageType': 'thumbnail', 'coverSource': 'upload',
            'tags': [{'title': t} for t in art['tags']], 'newCategory': CATEGORY,
            'isInvestment': slug not in NON_INVESTMENT,
            'setInvestment': slug not in NON_INVESTMENT, 'adult': False,
            'lexicalObj': lexical_obj})
        print(f'[{slug}] metadata PATCH: {st} {body[:60]}')

        r = urllib.request.Request(f'https://api.vocus.cc/api/article/{aid}',
            headers={'Authorization': f'Bearer {TOK}', 'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(r, timeout=30) as resp:
            a = json.loads(resp.read()).get('article', {})
        print(f"[{slug}] readback: status={a.get('status')} 塊數={len(art['blocks'])} "
              f"字數={a.get('wordsCount')} inv={a.get('isInvestment')} "
              f"thumb={'OK' if 'static/og_img' not in str(a.get('thumbnailUrl')) else '預設圖!'}")

        if publish:
            st, body = api('PATCH', f'/api/articles/{aid}/status/2', {'status': 2, 'showCatalog': True})
            print(f'[{slug}] publish: {st} {body[:40] if body else "(204)"}')
            print(f'[{slug}] url: https://vocus.cc/article/{aid}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    mode, slugs = sys.argv[1], sys.argv[2:]
    if mode == 'prep':
        cmd_prep(slugs)
    elif mode in ('draft', 'publish'):
        cmd_push(slugs, mode == 'publish')
    else:
        raise SystemExit('mode 只能是 prep / draft / publish')
