# -*- coding: utf-8 -*-
"""把 blog 的 .en.mdx 直接轉成 Substack 草稿／發布（乙案：前半免費、後半付費牆）。

為什麼存在：英文版要上 Realpha Reads the World 收會員費，來源仍是
src/content/blog/<slug>.en.mdx，不另抄一份。介面仿 vocus_publish_mdx.py。

用法：
    python substack_publish_mdx.py draft   <slug> [<slug>...]   # 建／更新草稿（不公開）
    python substack_publish_mdx.py publish <slug> [<slug>...]   # 公開（只在 Charles 說「發」之後呼叫）
    python substack_publish_mdx.py check   <slug>               # 讀回線上草稿，印驗證行

from_markdown 處理得了 **粗體**／*斜體*／連結，但 <br/> 會被丟掉、詩引黏成一段，
所以正文自己拆，用 Post.heading/paragraph/horizontal_rule/add 與 substack.nodes。
"""
import json, os, re, sys

from substack.api import Api
from substack.exceptions import SubstackAPIException, SubstackRequestException
from substack.nodes import blockquote as node_blockquote
from substack.nodes import bullet_list as node_bullet_list
from substack.nodes import list_item as node_list_item
from substack.post import Post, parse_inline, tokens_to_text_nodes

ROOT = r'C:\Users\Charles\projects\realpha-blog'
SP = os.environ.get('SUBSTACK_SP') or r'C:\Users\Charles\scripts\blog_auto'
COOKIES_PATH = os.path.join(SP, 'substack_cookies.json')
IDS_PATH = os.path.join(SP, 'substack_ids.json')
PUB_URL = 'https://realphareads.substack.com'
COOKIE_HINT = 'cookie 失效，跑 `python C:/Users/Charles/scripts/substack_cookies_from_profile.py`'
DISCLAIMER = ('This is personal research and educational commentary, not investment advice. '
              'Positions may be held in securities mentioned.')
EN_PAYWALL_H2 = re.compile(r'Where I took it|Extended|What it means', re.I)
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
                        post.draft_body.setdefault('content', []).append({'type': 'captionedImage', 'content': [{
                            'type': 'image2',
                            'attrs': {'src': url, 'fullscreen': False, 'imageSize': 'normal',
                                      'height': 819, 'width': 1456, 'resizeWidth': 728,
                                      'bytes': None, 'alt': alt or None, 'title': None, 'type': None,
                                      'href': None, 'belowTheFold': False, 'internalRedirect': None}}]})
            elif upload_image is None:
                print('⚠️ 跳過內文圖（未提供上傳函式）：' + src)
            else:
                # 2026-09-03：DEC-0535 已推翻「英文版不配圖」，英文稿掛 -en.svg；Substack 只吃點陣圖 → SVG 先轉 PNG 再上傳
                alt = m_img.group(1) if m_img else ''
                url = upload_image(src)
                if url:
                    post.captioned_image(src=url, alt=alt or None)
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
        if ln.startswith('|'):
            print('⚠️ 跳過表格（Substack 轉換未支援）')
            while i < len(lines) and lines[i].strip().startswith('|'):
                i += 1
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
        if ln.startswith('```'):
            print('⚠️ 跳過 code fence')
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                i += 1
            i += 1
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
    path = os.path.join(ROOT, 'src', 'content', 'blog', slug + '.en.mdx')
    if not os.path.isfile(path):
        raise SystemExit('❌ 找不到英文稿 ' + path)
    fm, body = parse_frontmatter(open(path, encoding='utf-8').read())
    subtitle = fm.get('tldr') or fm.get('description') or ''
    return fm, body, fm.get('title', ''), subtitle


def find_cover(slug):
    covers = os.path.join(ROOT, 'public', 'covers')
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
    key = hashlib.sha1(open(src_path, 'rb').read()).hexdigest()[:12]
    png = os.path.join(cache, os.path.basename(src_path).replace('.svg', '') + '-' + key + '.png')
    if os.path.exists(png) and os.path.getsize(png) > 1000:
        return png
    html = os.path.join(cache, key + '.html')
    with open(html, 'w', encoding='utf-8') as f:
        f.write('<html><body style="margin:0;background:#fff"><img src="file:///%s" style="width:1456px;display:block"></body></html>'
                % src_path.replace(os.sep, '/'))
    edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    subprocess.run([edge, '--headless=new', '--disable-gpu', '--window-size=1456,640',
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
        img = api_try(api.get_image, local)
        return img.get('url') if isinstance(img, dict) else None
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
    k, src = find_paywall_k(slug, body)
    if k is None:
        print('⚠️ 找不到「延伸想法」／Where I took it，不插付費牆')
    # 2026-09-03 實測：Substack 規定「有付費牆的文 audience 必須是 only_paid」（設 everyone 發布時回 400）；
    # only_paid＋牆＝牆上免費預覽、牆下付費，正是乙案要的；沒牆的文才用 everyone。
    post = Post(title, subtitle, api.get_user_id(), audience='only_paid' if k is not None else 'everyone')
    inserted = fill_post(post, body, k, upload_image=make_uploader(api))
    if fm.get('category') == 'investing':
        post.paragraph([{'content': DISCLAIMER, 'marks': [{'type': 'em'}]}])
    cover_path = find_cover(slug)
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
        _, body, _, _ = load_article(slug)
        k, _ = find_paywall_k(slug, body)
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


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    mode, slugs = sys.argv[1], sys.argv[2:]
    if mode not in ('draft', 'publish', 'check'):
        raise SystemExit('mode 只能是 draft / publish / check')
    api = make_api()
    if mode == 'draft':
        sys.exit(cmd_draft(api, slugs))
    if mode == 'publish':
        sys.exit(cmd_publish(api, slugs))
    sys.exit(cmd_check(api, slugs))
