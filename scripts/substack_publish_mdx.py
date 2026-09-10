# -*- coding: utf-8 -*-
"""把 blog 的 .en.mdx 直接轉成 Substack 草稿／發布（乙案：前半免費、後半付費牆）。

為什麼存在：英文版要上 Realpha Reads the World 收會員費，來源仍是
src/content/blog/<slug>.en.mdx，不另抄一份。介面仿 vocus_publish_mdx.py。

用法：
    python substack_publish_mdx.py draft   <slug> [<slug>...]   # 建／更新草稿（不公開）
    python substack_publish_mdx.py publish <slug> [<slug>...]   # 公開（只在 Charles 說「發」之後呼叫）
    python substack_publish_mdx.py check   <slug>               # 讀回線上草稿，印驗證行
    python substack_publish_mdx.py cover   <slug>...            # 補封面（讀 frontmatter cover，上傳後更新發布）
    python substack_publish_mdx.py unwall  <slug>... | @清單檔  # 拆掉線上稿的付費牆並開放給所有人（不重傳圖）
    python substack_publish_mdx.py backfill <slug>... | @清單檔  # 回填舊文：建草稿→日期設回 pubDate→發布不寄信；已發過跳過

from_markdown 處理得了 **粗體**／*斜體*／連結，但 <br/> 會被丟掉、詩引黏成一段，
所以正文自己拆，用 Post.heading/paragraph/horizontal_rule/add 與 substack.nodes。
"""
import json, os, re, sys, time

from substack.api import Api
from substack.exceptions import SubstackAPIException, SubstackRequestException
from substack.nodes import blockquote as node_blockquote
from substack.nodes import bullet_list as node_bullet_list
from substack.nodes import code_block as node_code_block
from substack.nodes import list_item as node_list_item
from substack.post import Post, parse_inline, tokens_to_text_nodes

ROOT = r'C:\Users\Charles\projects\realpha-blog'
SP = os.environ.get('SUBSTACK_SP') or r'C:\Users\Charles\scripts\blog_auto'
COOKIES_PATH = os.path.join(SP, 'substack_cookies.json')
IDS_PATH = os.path.join(SP, 'substack_ids.json')
PUB_URL = 'https://realphareads.substack.com'

# 訂閱 CTA（2026-09-10 Charles「英文版的就請讀者訂 substack」）：
# 每篇照內容現寫一句幽默邀請（claude -p），失敗退固定句；連結由程式另附，發文不因此卡住。
CTA_EN_FALLBACK = ('If this piece saved you an hour of reading, the next one is already '
                   'on its way — subscribing is free.')
CTA_EN_LINK = f'👉 [Subscribe to Realpha Reads the World — free]({PUB_URL}/subscribe)'


def cta_witty_en(title, subtitle, body_head, timeout=180):
    """照這篇的內容寫一句幽默的英文訂閱邀請。回 None＝生成失敗，呼叫端用固定句。"""
    import subprocess, tempfile
    cli = os.path.expanduser(r'~\AppData\Roaming\npm\claude.cmd')
    prompt = (
        'You are writing the one-line sign-off of an already-finished article, inviting '
        'readers to subscribe to the newsletter. Rules:\n'
        '- One sentence, 15-30 words, in English.\n'
        '- Make it witty, and grow the joke out of THIS article (reuse its metaphor, '
        'example or theme) — not a generic subscribe slogan.\n'
        '- No emoji, no hashtags, no promises of profit, no "you should" lecturing.\n'
        '- Do not include any link or "click here"; the link is appended by the program.\n'
        '- Output only that sentence, no quotes, nothing else.\n\n'
        f'Title: {title}\nSubtitle: {subtitle}\nOpening: {body_head}\n')
    fd, tmp = tempfile.mkstemp(suffix='.txt', prefix='_ctaen_', dir=os.path.dirname(__file__))
    os.close(fd)
    try:
        open(tmp, 'w', encoding='utf-8').write(prompt)
        with open(tmp, encoding='utf-8') as fh:
            r = subprocess.run([cli, '-p', '--model', 'claude-opus-5', '--effort', 'low'],
                               stdin=fh, capture_output=True, text=True,
                               encoding='utf-8', errors='replace', timeout=timeout)
        lines = (r.stdout or '').strip().splitlines()
        line = next((l.strip().strip('"') for l in lines if l.strip()), '')
        words = len(line.split())
        if 8 <= words <= 40 and 'http' not in line:
            return line
    except Exception:
        pass
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass
    return None
COOKIE_HINT = 'cookie 失效，跑 `python C:/Users/Charles/scripts/substack_cookies_from_profile.py`'
DISCLAIMER = ('This is personal research and educational commentary, not investment advice. '
              'Positions may be held in securities mentioned.')
EN_PAYWALL_H2 = re.compile(r'Where I took it|Extended|What it means', re.I)
# 2026-09-08 Charles「先把付費牆拿掉」：台灣開不了 Stripe，Substack 付費訂閱收不到錢，鎖了等於白鎖。
# 收款帳戶弄好後改回 True，牆的位置規則（substackPaywallAfter／延伸想法）都還在。
PAYWALL_ENABLED = False
# Substack 副標上限（API 回 400 Subtitle is too long）；公開文件寫 250
SUBTITLE_MAX = 250


def clip_subtitle(text, limit=SUBTITLE_MAX):
    text = (text or '').strip()
    if len(text) <= limit:
        return text
    cut = text[:limit - 1].rsplit(' ', 1)[0].rstrip('.,;:')
    if not cut:
        cut = text[:limit - 1]
    return cut + '…'

# 封面檔名不一定等於 slug（早期幾篇用短名），對不上時在這裡指名
COVERS = {
    'local-ai-hardware-worth-it': 'local-ai-hardware-worth-it.png',
    'gooaye-ep683-cannot-see-the-mountain': 'gooaye-ep683-cover.png',
    'gooaye-ep684-liquidity-carries-and-capsizes': 'gooaye-ep684-cover.png',
    'herdr-agent-automation-vocus': 'herdr-agent-automation.png',
    'invsunday-2026-08-02-rehacq-interfm': 'invsunday-rehacq-takahashi-media-cover.png',
    'video-memory-without-the-cloud': 'video-memory-without-the-cloud.png',
    'aice-ai-engineering-cert-prep': 'aice-ai-engineering-cert-prep.png',
    'aice-must-know-concepts': 'aice-must-know-concepts.png',
}


def cookie_fail(extra=''):
    msg = COOKIE_HINT
    if extra:
        msg = extra + '\n' + msg
    raise SystemExit(msg)


def parse_frontmatter(text):
    if not text.startswith('---'):
        raise ValueError('mdx 缺 frontmatter')
    end = text.index('\n---', 3)
    fm, body = text[3:end], text[end + 4:]
    out, key, buf = {}, None, []
    for line in fm.splitlines():
        m = re.match(r'^([a-zA-Z_]+):\s*(.*)$', line)  # 允許底線鍵（paywall_after_insight）
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


def list_h2(body):
    return [m.group(1).strip() for ln in body.splitlines()
            if (m := re.match(r'^##\s+(.*)$', ln))]


def find_paywall_k(slug, en_body):
    """回 0-based H2 序號（牆插在這個 H2 前面）。找不到則 (None, 原因)。"""
    zh_path = os.path.join(ROOT, 'src', 'content', 'blog', slug + '.zh-TW.mdx')
    if os.path.isfile(zh_path):
        _, zh_body = parse_frontmatter(open(zh_path, encoding='utf-8').read())
        for i, title in enumerate(list_h2(zh_body)):
            if '延伸想法' in title:
                return i, 'zh'
    for i, title in enumerate(list_h2(en_body)):
        if EN_PAYWALL_H2.search(title):
            return i, 'en'
    return None, None


def italic_para(text):
    """一段斜體。已有 em 的 runs 不重複加。"""
    nodes = tokens_to_text_nodes(parse_inline(text))
    for n in nodes:
        marks = list(n.get('marks') or [])
        if not any(m.get('type') == 'em' for m in marks):
            marks.append({'type': 'em'})
        n['marks'] = marks
    return {'type': 'paragraph', 'content': nodes}


def append_quote(post, lines, poem):
    cleaned = [re.sub(r'<br\s*/?>', '', ln).strip() for ln in lines]
    cleaned = [ln for ln in cleaned if ln]
    if not cleaned:
        return
    if poem:
        paras = [italic_para(ln) for ln in cleaned]
    else:
        paras = [{'type': 'paragraph',
                  'content': tokens_to_text_nodes(parse_inline(' '.join(cleaned)))}]
    post.draft_body.setdefault('content', []).append(node_blockquote(paras))


def split_table_row(line):
    """拆一列 pipe table；支援反斜線跳脫的 pipe。"""
    row = line.strip()
    if row.startswith('|'):
        row = row[1:]
    if row.endswith('|') and not row.endswith('\\|'):
        row = row[:-1]
    cells, buf, escaped = [], [], False
    for char in row:
        if char == '|' and not escaped:
            cells.append(''.join(buf).strip().replace('\\|', '|'))
            buf = []
        else:
            buf.append(char)
        escaped = char == '\\' and not escaped
        if char != '\\':
            escaped = False
    cells.append(''.join(buf).strip().replace('\\|', '|'))
    return cells


def is_table_separator(line):
    cells = split_table_row(line)
    return bool(cells) and all(re.fullmatch(r':?-{3,}:?', cell.replace(' ', ''))
                               for cell in cells)


def append_table(post, rows):
    """以穩定的純文字列呈現表格，避免使用 Substack 未公開的 table schema。"""
    for row_number, cells in enumerate(rows):
        rendered = ' | '.join(cells)
        if row_number == 0:
            rendered = '**' + rendered.replace(' | ', '** | **') + '**'
        post.paragraph(parse_inline(rendered))



def add_image_block(post, url, alt='', size=None):
    """獨立的圖片區塊（Substack 編輯器的 captionedImage 節點），公開頁才會畫出來。
    size=(寬, 高) 用實際 PNG 尺寸；2026-09-07 前寫死 1456×819，內文圖實際 1456×789 被拉伸、底部被切（Charles 抓到）。"""
    w, h = size if size else (1456, 819)
    post.draft_body.setdefault('content', []).append({'type': 'captionedImage', 'content': [{
        'type': 'image2',
        'attrs': {'src': url, 'fullscreen': False, 'imageSize': 'normal',
                  'height': int(h), 'width': int(w), 'resizeWidth': 728,
                  'bytes': None, 'alt': alt or None, 'title': None, 'type': None,
                  'href': None, 'belowTheFold': False, 'internalRedirect': None}}]})


def fill_post(post, body, paywall_k, upload_image=None):
    """把 mdx 正文填進 Post。回傳實際插入的 paywall H2 序號（沒插則 None）。"""
    lines, i = body.split('\n'), 0
    first_img_done = False
    h2_seen = 0
    inserted = None
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip():
            i += 1
            continue
        if ln.startswith('!['):
            m_img = re.match(r'!\[(.*?)\]\((.*?)\)', ln)
            src = m_img.group(2) if m_img else ln
            if not first_img_done:
                first_img_done = True
                # 第一張＝封面。cover_image 只出現在列表與信件標頭，文章頁本文不會顯示；
                # 而兩張概念圖都在付費牆下，免費讀者整頁一張圖都看不到（2026-09-03 Charles：「裡面沒有圖」）
                # → 封面也插進本文最上方，免費讀者至少看得到它。
                if upload_image is not None:
                    alt = m_img.group(1) if m_img else ''
                    url = upload_image(src)
                    if url:
                        # 套件的 captioned_image 是把圖塞進「前一個節點」的 content；本文開頭沒有前一個節點，
                        # 直接放一個獨立的 captionedImage 區塊（Substack 編輯器自己的節點型別）
                        add_image_block(post, url, alt, getattr(upload_image, 'last_size', None))
            elif upload_image is None:
                print('⚠️ 跳過內文圖（未提供上傳函式）：' + src)
            else:
                # 2026-09-03：DEC-0535 已推翻「英文版不配圖」，英文稿掛 -en.svg；Substack 只吃點陣圖 → SVG 先轉 PNG 再上傳
                alt = m_img.group(1) if m_img else ''
                url = upload_image(src)
                if url:
                    # 2026-09-03 實測：套件的 captioned_image 會把 image2 塞進「前一個段落」裡，
                    # 編輯器看得到、公開頁卻不畫（文章頁只剩空白）。正確結構＝獨立的 captionedImage 區塊，
                    # 跟封面同一種寫法。
                    add_image_block(post, url, alt, getattr(upload_image, 'last_size', None))
                else:
                    print('⚠️ 內文圖上傳失敗，略過：' + src)
            i += 1
            continue
        if re.match(r'^---+$', ln.strip()):
            post.horizontal_rule()
            i += 1
            continue
        if ln.startswith('>'):
            quote = []
            while i < len(lines) and lines[i].startswith('>'):
                quote.append(lines[i][1:].strip())
                i += 1
            poem = any('<br' in q or q.startswith('——') or q.startswith('—') for q in quote)
            append_quote(post, quote, poem)
            continue
        hm = re.match(r'^(#{2,3})\s+(.*)$', ln)
        if hm:
            level = len(hm.group(1))
            title = hm.group(2).strip()
            if level == 2:
                if paywall_k is not None and inserted is None and h2_seen == paywall_k:
                    post.add({'type': 'paywall'})
                    inserted = paywall_k
                h2_seen += 1
            post.heading(parse_inline(title), level=level)
            i += 1
            continue
        if (ln.startswith('|') and i + 1 < len(lines)
                and is_table_separator(lines[i + 1])):
            rows = [split_table_row(ln)]
            i += 2  # 標題列與 Markdown 對齊分隔列
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append(split_table_row(lines[i]))
                i += 1
            append_table(post, rows)
            continue
        if ln.startswith('- '):
            items = []
            while i < len(lines) and lines[i].startswith('- '):
                items.append(lines[i][2:].strip())
                i += 1
            post.draft_body.setdefault('content', []).append(
                node_bullet_list([node_list_item(tokens_to_text_nodes(parse_inline(it)))
                                  for it in items]))
            continue
        fence = re.match(r'^\s*(`{3,}|~{3,})([^`]*)$', ln)
        if fence:
            marker, info = fence.groups()
            language = info.strip() or None
            code = []
            i += 1
            while i < len(lines) and not re.match(
                    r'^\s*' + re.escape(marker[0]) + r'{' + str(len(marker)) + r',}\s*$',
                    lines[i]):
                code.append(lines[i])
                i += 1
            if i < len(lines):
                i += 1
            post.add(node_code_block('\n'.join(code), language=language))
            continue
        post.paragraph(parse_inline(ln.strip()))
        i += 1
    if paywall_k is not None and inserted is None:
        # 牆位在最後一個 H2 之後（不該發生）；仍補上以免白發免費全文
        post.add({'type': 'paywall'})
        inserted = paywall_k
        print('⚠️ 延伸想法 H2 沒對上，paywall 改接在文末')
    return inserted


def load_article(slug):
    # 2026-09-03 Charles 定調 Substack＝五分鐘讀完、六個以上 insight、四張以上概念圖，
    # 所以 Substack 版是獨立的濃縮稿 substack/<slug>.md（frontmatter 含 paywall_after_insight）；
    # 沒有濃縮稿才退回長文 .en.mdx。
    digest = os.path.join(ROOT, 'substack', slug + '.md')
    if os.path.isfile(digest):
        fm, body = parse_frontmatter(open(digest, encoding='utf-8').read())
        fm['_digest'] = True
        return fm, body, fm.get('title', ''), fm.get('subtitle') or fm.get('tldr') or ''
    path = os.path.join(ROOT, 'src', 'content', 'blog', slug + '.en.mdx')
    if not os.path.isfile(path):
        raise SystemExit('❌ 找不到英文稿 ' + path)
    fm, body = parse_frontmatter(open(path, encoding='utf-8').read())
    subtitle = fm.get('tldr') or fm.get('description') or ''
    return fm, body, fm.get('title', ''), subtitle



def paywall_k_for(fm, slug, body):
    """牆的位置（0-based H2 序號，牆插在該 H2 前）。
    優先序：frontmatter `substackPaywallAfter: N`（第 N 節之後免費結束；2026-09-03 Charles「只免費公開第一節」→ 1）
    → 濃縮稿的 paywall_after_insight → 依 zh「延伸想法」對應序號（乙案舊預設）。"""
    if not PAYWALL_ENABLED:
        return None, 'disabled'
    for key in ('substackPaywallAfter', 'paywall_after_insight'):
        v = str(fm.get(key, '')).strip()
        if v.isdigit():
            return int(v), key
    return find_paywall_k(slug, body)


def find_cover(slug, fm=None):
    covers = os.path.join(ROOT, 'public', 'covers')
    # 2026-09-09：先信 frontmatter 的 cover／ogImage（早期九篇短名封面靠猜檔名全漏，Substack 版無封面）
    for key in ('cover', 'ogImage'):
        v = str((fm or {}).get(key, '')).strip()
        if v.startswith('/'):
            p = os.path.join(ROOT, 'public', v.lstrip('/').replace('/', os.sep))
            if os.path.isfile(p):
                return p
    names = [slug + '-cover.png', slug + '.png']
    if slug in COVERS:
        names.append(COVERS[slug])
    for name in names:
        p = os.path.join(covers, name)
        if os.path.isfile(p):
            return p
    return None


def load_ids():
    return json.load(open(IDS_PATH, encoding='utf-8')) if os.path.isfile(IDS_PATH) else {}


def save_ids(ids):
    os.makedirs(os.path.dirname(IDS_PATH), exist_ok=True)
    with open(IDS_PATH, 'w', encoding='utf-8') as f:
        json.dump(ids, f, ensure_ascii=False, indent=2)
        f.write('\n')


def cookies_string():
    if not os.path.isfile(COOKIES_PATH):
        cookie_fail('找不到 cookie 檔 ' + COOKIES_PATH)
    try:
        rows = json.load(open(COOKIES_PATH, encoding='utf-8'))
    except ValueError:
        cookie_fail('cookie 檔不是合法 JSON')
    if not isinstance(rows, list) or not any(r.get('name') == 'substack.sid' for r in rows):
        cookie_fail('cookie 檔缺 substack.sid')
    return '; '.join('%s=%s' % (r['name'], r['value'])
                     for r in rows if r.get('name') is not None and 'value' in r)


def make_api():
    try:
        return Api(cookies_string=cookies_string(), publication_url=PUB_URL, timeout=60)
    except SubstackAPIException as e:
        if e.status_code in (401, 403):
            cookie_fail()
        raise SystemExit('Substack API 失敗：%s' % e)
    except SubstackRequestException as e:
        cookie_fail(str(e))



def svg_to_png(src_path):
    """把 SVG 用 Edge 無介面模式截成 PNG（本機沒有 rsvg-convert；cairosvg 未裝）。回 PNG 路徑或 None。"""
    import subprocess, tempfile, hashlib
    cache = os.path.join(tempfile.gettempdir(), 'substack_fig_png')
    os.makedirs(cache, exist_ok=True)
    raw = open(src_path, 'rb').read()
    key = hashlib.sha1(raw).hexdigest()[:12]
    # 2026-09-07：視窗高度照 SVG 原稿比例算（viewBox 或 width/height），不再寫死 640——
    # 960×520 的圖放到 1456 寬要 789 高，寫死 640 底部被截 149px。快取檔名加 v2 讓舊截圖失效。
    head = raw[:2000].decode('utf-8', 'ignore')
    m = re.search(r'viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"', head)
    if not m:
        mw = re.search(r'\swidth="([\d.]+)', head); mh = re.search(r'\sheight="([\d.]+)', head)
        m = (mw, mh) if mw and mh else None
    if m:
        vw, vh = (float(m.group(1)), float(m.group(2))) if not isinstance(m, tuple) else (float(m[0].group(1)), float(m[1].group(1)))
        height = max(200, int(round(1456 * vh / vw)))
    else:
        height = 640
    png = os.path.join(cache, os.path.basename(src_path).replace('.svg', '') + '-' + key + '-v2.png')
    if os.path.exists(png) and os.path.getsize(png) > 1000:
        return png
    html = os.path.join(cache, key + '.html')
    with open(html, 'w', encoding='utf-8') as f:
        f.write('<html><body style="margin:0;background:#fff"><img src="file:///%s" style="width:1456px;display:block"></body></html>'
                % src_path.replace(os.sep, '/'))
    edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    subprocess.run([edge, '--headless=new', '--disable-gpu', '--window-size=1456,%d' % height,
                    '--screenshot=' + png, 'file:///' + html.replace(os.sep, '/')],
                   capture_output=True, timeout=60)
    return png if os.path.exists(png) and os.path.getsize(png) > 1000 else None


def make_uploader(api):
    """回一個函式：mdx 圖片路徑（/figures/x-en.svg 或 /covers/x.png）→ Substack 圖片網址。"""
    def upload(src):
        rel = src.split('?', 1)[0].lstrip('/')
        local = os.path.join(ROOT, 'public', rel.replace('/', os.sep))
        if not os.path.exists(local):
            print('⚠️ 找不到圖檔：' + local)
            return None
        if local.lower().endswith('.svg'):
            local = svg_to_png(local)
            if not local:
                print('⚠️ SVG 轉 PNG 失敗：' + src)
                return None
        try:
            from PIL import Image
            with Image.open(local) as im:
                upload.last_size = im.size
        except Exception:
            upload.last_size = None
        img = api_try(api.get_image, local)
        return img.get('url') if isinstance(img, dict) else None
    upload.last_size = None
    return upload


def api_try(fn, *a, **k):
    try:
        return fn(*a, **k)
    except SubstackAPIException as e:
        if e.status_code in (401, 403):
            cookie_fail()
        raise SystemExit('Substack API 失敗：%s' % e)
    except SubstackRequestException as e:
        raise SystemExit('Substack 請求失敗：%s' % e)


def parse_body(draft):
    body = draft.get('draft_body') or draft.get('body') or {}
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except ValueError:
            return []
    if not isinstance(body, dict):
        return []
    return body.get('content') or []


def inspect_draft(draft):
    """從讀回的草稿抽出驗證欄。paywall 序號＝牆前面已經出現幾個 H2（從 0 數＝將插入的那個 H2）。"""
    content = parse_body(draft)
    h2 = 0
    paywall = None
    for node in content:
        t = node.get('type')
        if t == 'paywall':
            paywall = h2
        elif t == 'heading' and int((node.get('attrs') or {}).get('level') or 0) == 2:
            h2 += 1
    published = bool(draft.get('is_published'))
    url = draft.get('canonical_url') or draft.get('url') or ''
    if not url and draft.get('slug'):
        url = PUB_URL + '/p/' + draft['slug']
    if not url and draft.get('id'):
        url = PUB_URL + ('/p/' + str(draft.get('slug')) if published and draft.get('slug')
                         else '/publish/post/' + str(draft.get('id')))
    cover = draft.get('cover_image') or draft.get('draft_cover_image')
    return {
        'title': draft.get('draft_title') or draft.get('title') or '',
        'h2': h2,
        'paywall': paywall,
        'cover': bool(cover),
        'audience': draft.get('audience') or '',
        'status': 'published' if published else 'draft',
        'url': url or '',
        'id': draft.get('id'),
    }


def print_line(slug, info):
    pay = '無' if info['paywall'] is None else str(info['paywall'])
    print('[substack] slug=%s｜draft_id=%s｜標題=%s｜H2=%s｜paywall=%s｜封面=%s｜audience=%s｜狀態=%s｜url=%s'
          % (slug, info['id'], info['title'], info['h2'], pay,
             '有' if info['cover'] else '無', info['audience'] or '?',
             info['status'], info['url'] or ''))


def payload_from_post(post, cover_url=None):
    raw = post.get_draft()  # 注意：會把 post.draft_body 改成 JSON 字串
    out = {
        'draft_title': raw['draft_title'],
        'draft_subtitle': raw['draft_subtitle'],
        'draft_body': raw['draft_body'],
        'audience': raw['audience'],
        'write_comment_permissions': raw.get('write_comment_permissions') or 'everyone',
        'draft_bylines': raw['draft_bylines'],
    }
    if cover_url:
        out['cover_image'] = cover_url
    return out


def build_post(api, slug):
    fm, body, title, subtitle = load_article(slug)
    # 2026-09-03 Charles 看草稿：tldr 400 字被硬切到一半很難看 → 超長時改取完整句子（在 250 字內盡量多句），不切半句
    if subtitle and len(subtitle.strip()) > SUBTITLE_MAX:
        sents = re.split(r'(?<=[.!?])\s+', subtitle.strip())
        kept = ''
        for sen in sents:
            if len((kept + ' ' + sen).strip()) > SUBTITLE_MAX:
                break
            kept = (kept + ' ' + sen).strip()
        if kept:
            subtitle = kept
    clipped = clip_subtitle(subtitle)
    if clipped != (subtitle or '').strip():
        print('⚠️ 副標超過 %d 字，已截斷（原文 %d）' % (SUBTITLE_MAX, len(subtitle.strip())))
    subtitle = clipped
    k, src = paywall_k_for(fm, slug, body)
    if k is None:
        print('⚠️ 找不到「延伸想法」／Where I took it，不插付費牆')
    # 2026-09-03 實測：Substack 規定「有付費牆的文 audience 必須是 only_paid」（設 everyone 發布時回 400）；
    # only_paid＋牆＝牆上免費預覽、牆下付費，正是乙案要的；沒牆的文才用 everyone。
    post = Post(title, subtitle, api.get_user_id(), audience='only_paid' if k is not None else 'everyone')
    inserted = fill_post(post, body, k, upload_image=make_uploader(api))
    if os.environ.get('SUBSTACK_NO_CTA') != '1':  # 批次回填舊文時可關，省生成呼叫
        witty = cta_witty_en(title, subtitle, body[:800]) or CTA_EN_FALLBACK
        post.paragraph(parse_inline(witty))
        post.paragraph(parse_inline(CTA_EN_LINK))
    if fm.get('category') == 'investing':
        post.paragraph([{'content': DISCLAIMER, 'marks': [{'type': 'em'}]}])
    cover_path = find_cover(slug, fm)
    cover_url = None
    if cover_path:
        img = api_try(api.get_image, cover_path)
        cover_url = img.get('url') if isinstance(img, dict) else None
        if not cover_url:
            print('⚠️ get_image 沒回 url：%s' % list(img)[:8] if isinstance(img, dict) else type(img))
    return post, inserted, cover_url, k


def cmd_draft(api, slugs):
    ids = load_ids()
    rc = 0
    for slug in slugs:
        post, inserted, cover_url, k = build_post(api, slug)
        payload = payload_from_post(post, cover_url)
        rec = ids.get(slug) or {}
        draft_id = rec.get('draft_id')
        if draft_id:
            saved = api_try(api.put_draft, draft_id, **payload)
        else:
            saved = api_try(api.post_draft, payload)
            draft_id = saved.get('id')
            if cover_url and not saved.get('cover_image'):
                saved = api_try(api.put_draft, draft_id, cover_image=cover_url)
        readback = api_try(api.get_draft, draft_id)
        info = inspect_draft(readback)
        ids[slug] = {
            'draft_id': draft_id,
            'post_id': rec.get('post_id'),
            'url': info['url'] or rec.get('url'),
            'published_at': rec.get('published_at'),
        }
        save_ids(ids)
        print_line(slug, info)
        if k is not None and info['paywall'] != k:
            print('⚠️ 讀回 paywall=%s，預期插在 H2 序號 %s 前' % (info['paywall'], k))
            rc = 1
        if inserted is None and k is not None:
            rc = 1
    return rc


def cmd_check(api, slugs):
    ids = load_ids()
    rc = 0
    for slug in slugs:
        rec = ids.get(slug) or {}
        draft_id = rec.get('draft_id')
        if not draft_id:
            print('❌ 台帳沒有 %s 的 draft_id' % slug)
            rc = 1
            continue
        readback = api_try(api.get_draft, draft_id)
        print_line(slug, inspect_draft(readback))
    return rc


def cmd_publish(api, slugs):
    ids = load_ids()
    rc = 0
    for slug in slugs:
        rec = ids.get(slug) or {}
        draft_id = rec.get('draft_id')
        if not draft_id:
            print('❌ 沒有草稿，拒絕發布：' + slug)
            rc = 1
            continue
        fm_p, body, _, _ = load_article(slug)
        k, _ = paywall_k_for(fm_p, slug, body)
        readback = api_try(api.get_draft, draft_id)
        info = inspect_draft(readback)
        if k is not None and info['paywall'] != k:
            print('❌ paywall 位置不對（讀回 %s，預期 %s），拒絕發布：%s'
                  % (info['paywall'], k, slug))
            rc = 1
            continue
        api_try(api.prepublish_draft, draft_id)
        published = api_try(api.publish_draft, draft_id)
        post_id = published.get('id') or draft_id
        again = api_try(api.get_draft, draft_id)
        info = inspect_draft(again)
        ids[slug] = {
            'draft_id': draft_id,
            'post_id': post_id,
            'url': info['url'] or published.get('canonical_url') or rec.get('url'),
            'published_at': (again.get('post_date') or published.get('post_date')
                             or rec.get('published_at')),
        }
        save_ids(ids)
        print_line(slug, info)
    return rc


def cmd_backfill(api, slugs):
    """回填舊文（2026-09-08 Charles「部落格英文文章都放到 Substack」）。
    與 publish 三點不同：①沒草稿就先建 ②發文日期設回 .en.mdx 的 pubDate，Substack 目錄才會照原順序排
    ③publish_draft(send=False)——一次補 180 多篇，每篇寄一封信會把訂閱者炸掉。
    已在台帳且有 post_id 的直接跳過（重跑即續）。"""
    ids = load_ids()
    rc = 0
    for slug in slugs:
        rec = ids.get(slug) or {}
        if rec.get('post_id'):
            print('⏭ 已發過，跳過：%s（%s）' % (slug, rec.get('url')))
            continue
        for attempt in range(3):
            if attempt:
                print('   ⏳ 第 %d 次重試 %s（等 90 秒）' % (attempt + 1, slug))
                time.sleep(90)
            ok = _backfill_one(api, slug)
            if ok:
                break
        else:
            rc = 1
        time.sleep(10)   # 2026-09-08 實測：連發 100 篇後被 429 限流 12 篇、再被切線一次
    return rc


def _backfill_one(api, slug):
    """回填一篇；成功回 True。"""
    ids = load_ids()
    rec = ids.get(slug) or {}
    if rec.get('post_id'):
        return True
    try:
        if not rec.get('draft_id'):
            if cmd_draft(api, [slug]) != 0:
                print('❌ 草稿建立有警告，跳過發布：' + slug)
                return False
            rec = load_ids().get(slug) or {}
        draft_id = rec['draft_id']
        fm_p, body, _, _ = load_article(slug)
        k, _ = paywall_k_for(fm_p, slug, body)
        pub = str(fm_p.get('pubDate', '')).strip().strip('"\'')
        readback = api_try(api.get_draft, draft_id)
        info = inspect_draft(readback)
        if k is not None and info['paywall'] != k:
            print('❌ paywall 位置不對（讀回 %s，預期 %s），拒絕發布：%s'
                  % (info['paywall'], k, slug))
            return False
        api_try(api.prepublish_draft, draft_id)
        published = api_try(api.publish_draft, draft_id, send=False)
        post_id = published.get('id') or draft_id
        # Substack 規定「Post must be published to change post date」→ 發布後才改日期
        if re.match(r'^\d{4}-\d{2}-\d{2}$', pub):
            api_try(api.put_draft, draft_id, post_date=pub + 'T00:00:00.000Z')
        again = api_try(api.get_draft, draft_id)
        info = inspect_draft(again)
        ids = load_ids()
        ids[slug] = {
            'draft_id': draft_id,
            'post_id': post_id,
            'url': info['url'] or published.get('canonical_url') or rec.get('url'),
            'published_at': (again.get('post_date') or published.get('post_date')
                             or rec.get('published_at')),
            'backfill': True,
        }
        save_ids(ids)
        print_line(slug, info)
        print('   post_date=%s（預期 %s）' % (again.get('post_date'), pub))
        return True
    except (SystemExit, Exception) as e:   # 429 限流／連線被切都不能讓整批死掉
        print('❌ %s：%s' % (slug, e))
        return False


def cmd_unwall(api, slugs):
    """把線上稿的付費牆拿掉（2026-09-08）：讀回草稿 → 刪 paywall 節點 → audience=everyone → 存回。
    不重傳圖，只動這兩樣；讀回驗 paywall=無 且 audience=everyone 才算成功。已經沒牆的跳過。"""
    ids = load_ids()
    rc = 0
    for slug in slugs:
        rec = ids.get(slug) or {}
        draft_id = rec.get('draft_id')
        if not draft_id:
            print('❌ 台帳沒有 %s 的 draft_id' % slug)
            rc = 1
            continue
        for attempt in range(3):
            if attempt:
                print('   ⏳ 第 %d 次重試 %s（等 90 秒）' % (attempt + 1, slug))
                time.sleep(90)
            try:
                draft = api_try(api.get_draft, draft_id)
                info = inspect_draft(draft)
                if info['paywall'] is None and info['audience'] == 'everyone':
                    print('⏭ 本來就沒牆：%s' % slug)
                    break
                body = draft.get('draft_body') or draft.get('body')
                body = json.loads(body) if isinstance(body, str) else body
                body['content'] = [n for n in (body.get('content') or []) if n.get('type') != 'paywall']
                extra = {}
                if draft.get('cover_image'):
                    extra['cover_image'] = draft['cover_image']   # 帶著存回，免得被清掉
                api_try(api.put_draft, draft_id, draft_body=json.dumps(body), audience='everyone', **extra)
                # 已發布的文章改完要再「更新發布」一次才會反映到公開頁（2026-09-08 實測：只 put_draft 公開頁仍有付費提示）
                api_try(api.prepublish_draft, draft_id)
                api_try(api.publish_draft, draft_id, send=False)
                again = inspect_draft(api_try(api.get_draft, draft_id))
                if again['paywall'] is None and again['audience'] == 'everyone':
                    print('✅ 已拆牆：%s（H2=%s）' % (slug, again['h2']))
                    break
                print('❌ 存回後讀回仍有牆／audience=%s：%s' % (again['audience'], slug))
            except (SystemExit, Exception) as e:
                print('❌ %s：%s' % (slug, e))
        else:
            rc = 1
        time.sleep(3)
    return rc


def cmd_cover(api, slugs):
    """補封面（2026-09-09）：讀 frontmatter 封面 → 上傳 → put_draft(cover_image) → 更新發布 → 讀回驗。"""
    ids = load_ids()
    rc = 0
    for slug in slugs:
        rec = ids.get(slug) or {}
        draft_id = rec.get('draft_id')
        if not draft_id:
            print('❌ 台帳沒有 %s 的 draft_id' % slug)
            rc = 1
            continue
        try:
            fm, _, _, _ = load_article(slug)
            path = find_cover(slug, fm)
            if not path:
                print('❌ 找不到封面檔：%s' % slug)
                rc = 1
                continue
            img = api_try(api.get_image, path)
            url = img.get('url') if isinstance(img, dict) else None
            if not url:
                print('❌ 上傳沒回 url：%s' % slug)
                rc = 1
                continue
            api_try(api.put_draft, draft_id, cover_image=url)
            api_try(api.prepublish_draft, draft_id)
            api_try(api.publish_draft, draft_id, send=False)
            info = inspect_draft(api_try(api.get_draft, draft_id))
            print(('✅' if info['cover'] else '❌') + ' 封面 %s：%s（%s）' % ('已掛' if info['cover'] else '讀回仍無', slug, os.path.basename(path)))
            if not info['cover']:
                rc = 1
        except (SystemExit, Exception) as e:
            print('❌ %s：%s' % (slug, e))
            rc = 1
        time.sleep(5)
    return rc


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    mode, slugs = sys.argv[1], sys.argv[2:]
    if mode not in ('draft', 'publish', 'check', 'backfill', 'unwall', 'cover'):
        raise SystemExit('mode 只能是 draft / publish / check / backfill / unwall / cover')
    if len(slugs) == 1 and slugs[0].startswith('@'):   # @清單檔：一行一個 slug
        slugs = [l.strip() for l in open(slugs[0][1:], encoding='utf-8') if l.strip()]
    api = make_api()
    if mode == 'draft':
        sys.exit(cmd_draft(api, slugs))
    if mode == 'publish':
        sys.exit(cmd_publish(api, slugs))
    if mode == 'backfill':
        sys.exit(cmd_backfill(api, slugs))
    if mode == 'unwall':
        sys.exit(cmd_unwall(api, slugs))
    if mode == 'cover':
        sys.exit(cmd_cover(api, slugs))
    sys.exit(cmd_check(api, slugs))
