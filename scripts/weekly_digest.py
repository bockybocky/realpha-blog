# -*- coding: utf-8 -*-
"""每週節目筆記週報：把一週（週一到週日）所有節目心得合併成一篇可被 Google 收錄的週報（中英各一）。

為什麼存在（2026-09-22 Fable 判決、Charles 拍板）：
  500 多篇自動產生的單集心得讓 Google 把全站判成低價值，原創文拿不到爬取配額。
  單集心得改成對 Google noindex（kind: "podcast-notes"），每週改由這一篇整理頁承接搜尋流量。

每集一小節：節目名＋集數＋2～4 句結論（取該篇 tldr，不足再補 description，去掉免責句）＋連結回原文。
只用各篇已有的文字，不加原文沒有的數字或關聯。

用法：
    python scripts/weekly_digest.py                      # 上一個完整週（排程每週一跑）
    python scripts/weekly_digest.py --week 2026-09-08    # 指定該週週一（回補）
    python scripts/weekly_digest.py --week ... --no-publish   # 只寫檔，不 build／commit／push／IndexNow
    python scripts/weekly_digest.py --selftest
冪等：週報檔已存在就跳過該週（要重寫加 --force）。
排程：Windows 工作排程器 RealphaBlogWeeklyDigest（scripts/run_weekly_digest.bat）。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG_DIR = ROOT / 'src' / 'content' / 'blog'
TOPICS = ROOT / 'src' / 'data' / 'topics.json'
SHOWS_JSON = Path(r'C:\Users\Charles\scripts\iltb\shows.json')
LOG = ROOT / 'scripts' / 'logs' / 'weekly_digest.log'
SITE = 'https://blog.getrealpha.com'
INDEXNOW_KEY = '73edbed9757488ffc8e914866f0ac5a8'
NPM = r'C:\Program Files\nodejs\npm.cmd'
NOTES_KIND = 'podcast-notes'
EXTRA_SHOW_NAMES = {
    'dingmao': {'zh-TW': '定錨產業筆記', 'en': 'Dingmao Industry Notes'},
    'xiaotian': {'zh-TW': '小天fotos', 'en': 'Xiaotian'},
    'kelly': {'zh-TW': 'Kelly Tsai', 'en': 'Kelly Tsai'},
    'caleb': {'zh-TW': 'Caleb Writes Code', 'en': 'Caleb Writes Code'},
}

DISCLAIMER = re.compile(
    r'非投資建議|投資建議|教育性|教育用途|教育與方法論|不構成|個股推薦|目標價|閱讀筆記，非|'
    r'investment advice|[Ee]ducational|not a recommendation|not advice', re.I)


def log(msg: str) -> None:
    line = f'[{dt.datetime.now():%Y-%m-%d %H:%M:%S}] {msg}'
    print(line, flush=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG, 'a', encoding='utf-8') as fh:
        fh.write(line + '\n')


# ---------- 讀文章 ----------
def _scalar(raw: str):
    raw = raw.strip()
    if raw.startswith('"') and raw.endswith('"'):
        try:
            return json.loads(raw)
        except ValueError:
            return raw[1:-1]
    if raw.startswith("'") and raw.endswith("'"):
        return raw[1:-1]
    if raw.startswith('['):
        try:
            return json.loads(raw)
        except ValueError:
            return [x.strip().strip('"\'') for x in raw[1:-1].split(',') if x.strip()]
    return raw


def parse_mdx(text: str) -> tuple[dict, str]:
    m = re.match(r'---\r?\n(.*?)\r?\n---\r?\n?(.*)$', text, re.S)
    if not m:
        return {}, text
    fm = {}
    for line in m.group(1).splitlines():
        km = re.match(r'^([A-Za-z_]+):\s*(.*)$', line)
        if km:
            fm[km.group(1)] = _scalar(km.group(2))
    return fm, m.group(2)


def load_posts() -> list[dict]:
    posts = []
    for p in sorted(BLOG_DIR.glob('*.mdx')):
        fm, body = parse_mdx(p.read_text(encoding='utf-8'))
        if not fm.get('slug') or str(fm.get('draft', '')).lower() == 'true':
            continue
        fm['_body'] = body
        fm['_date'] = dt.date.fromisoformat(str(fm.get('pubDate', ''))[:10])
        posts.append(fm)
    return posts


def show_names() -> dict:
    names = {}
    try:
        for s in json.loads(TOPICS.read_text(encoding='utf-8'))['series']:
            names[s['id']] = s['name']
    except (OSError, ValueError, KeyError):
        pass
    try:
        for s in json.loads(SHOWS_JSON.read_text(encoding='utf-8'))['shows']:
            names.setdefault(s['id'], {'zh-TW': s['name'], 'en': s['name']})
    except (OSError, ValueError, KeyError):
        pass
    for k, v in EXTRA_SHOW_NAMES.items():
        names.setdefault(k, v)
    return names


def show_of(post: dict, names: dict) -> str:
    prefix = post['slug'].split('-')[0]
    if prefix in names:
        return names[prefix][post['lang']]
    tags = post.get('tags') or []
    return tags[0] if tags else prefix


def episode_label(post: dict) -> str:
    en = post['lang'] == 'en'
    hay = f"{post['slug']} {post.get('title', '')}"
    m = re.search(r'(?i)\bep[-_. ]?(\d{2,4})\b', hay) or re.search(r'#(\d{2,4})\b', hay) or re.search(r'第\s*(\d{2,4})\s*集', hay)
    if m:
        return f'EP{m.group(1)}'
    d = re.search(r'-(\d{4}-\d{2}-\d{2})(?:-|$)', post['slug'])
    if d and '-week-' in post['slug']:
        return f'week of {d.group(1)}' if en else f'{d.group(1)} 那一週'
    if d:
        return f'episode of {d.group(1)}' if en else f'{d.group(1)} 那一集'
    return 'this episode' if en else '單集'


# ---------- 摘句 ----------
def sentences(text: str, en: bool) -> list[str]:
    text = re.sub(r'\s+', ' ', text or '').strip()
    if not text:
        return []
    if en:
        parts = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9"“(\'])', text)
    else:
        parts = re.split(r'(?<=[。！？])', text)
    return [p.strip() for p in parts if p.strip()]


def summary(post: dict) -> list[str]:
    en = post['lang'] == 'en'
    out: list[str] = []
    for src in (post.get('tldr') or '', post.get('description') or ''):
        for s in sentences(str(src), en):
            if DISCLAIMER.search(s) or s in out:
                continue
            out.append(s)
        if len(out) >= 2:
            break
    return out[:4]


def mdx_escape(text: str) -> str:
    return text.replace('\\', '\\\\').replace('{', '\\{').replace('}', '\\}').replace('<', '\\<')


def link_text_escape(text: str) -> str:
    return mdx_escape(text).replace('[', '\\[').replace(']', '\\]')


def epigraph_of(post: dict) -> str:
    head = post['_body'].split('\n## ')[0]
    lines, block = head.splitlines(), []
    for ln in lines:
        if ln.startswith('>'):
            block.append(ln.rstrip())
        elif block:
            break
    return '\n'.join(block)


# ---------- 組稿 ----------
def week_bounds(monday: dt.date) -> tuple[dt.date, dt.date]:
    return monday, monday + dt.timedelta(days=6)


def digest_slug(monday: dt.date) -> str:
    return f'weekly-digest-{monday.isoformat()}'


def build_digest(monday: dt.date, lang: str, posts: list[dict], names: dict) -> str | None:
    start, end = week_bounds(monday)
    week = [p for p in posts if p['lang'] == lang and p.get('kind') == NOTES_KIND and start <= p['_date'] <= end]
    week.sort(key=lambda p: (p['_date'], p['slug']))
    if not week:
        return None
    en = lang == 'en'
    slug = digest_slug(monday)
    span = f'{start:%m-%d}～{end:%m-%d}' if not en else f'{start:%b %d}–{end:%b %d}'
    shows = []
    for p in week:
        n = show_of(p, names)
        if n not in shows:
            shows.append(n)
    more = len(shows) > 6
    shows_text = (', '.join(shows[:6]) + (' and more' if more else '')) if en else ('、'.join(shows[:6]) + ('等' if more else ''))
    if en:
        title = f'Podcast Notes Weekly: {start:%b %d}–{end:%b %d}, {end.year}'
        desc = (f'The takeaways from {len(week)} podcast notes I wrote this week ({shows_text}). '
                f'Two to four sentences per episode, with a link to each full post.')
        tags = ['Podcast Notes Weekly', 'Podcast']
        intro = (f'This week ({span}) I wrote notes on {len(week)} podcast episodes. '
                 f'Here are the takeaways from each one in one place. '
                 f'If an episode catches your eye, the link under it goes to the full post.')
        intro_h = 'What I listened to this week'
    else:
        title = f'節目筆記週報｜{start.year}-{span}'
        desc = f'這週寫了 {len(week)} 篇節目筆記（{shows_text}），這篇把每集的結論收在一起，每集兩到四句，點連結看全文。'
        tags = ['節目筆記週報', 'Podcast']
        intro = (f'這週（{span}）我寫了 {len(week)} 篇節目筆記。'
                 f'這裡把每篇的結論放在一起，一集一段。'
                 f'哪一集你有興趣，點段落下面的連結看全文。')
        intro_h = '這週聽了什麼'
    epi = next((e for e in (epigraph_of(p) for p in week) if e), '')
    fm = [
        '---',
        f'title: {json.dumps(title, ensure_ascii=False)}',
        f'description: {json.dumps(desc, ensure_ascii=False)}',
        f'slug: "{slug}"',
        f'lang: "{lang}"',
        f'pubDate: {(end + dt.timedelta(days=1)).isoformat()}',
        'category: "investing"',
        'kind: "weekly-digest"',
        f'tags: {json.dumps(tags, ensure_ascii=False)}',
        '---',
        '',
    ]
    body = []
    if epi:
        body += [epi, '']
    body += [f'## {intro_h}', '', mdx_escape(intro), '']
    prefix = '/en' if en else ''
    for p in week:
        body += [f'## {mdx_escape(show_of(p, names))}｜{mdx_escape(episode_label(p))}' if not en
                 else f'## {mdx_escape(show_of(p, names))} — {mdx_escape(episode_label(p))}', '']
        sents = summary(p)
        body += [mdx_escape(''.join(sents) if not en else ' '.join(sents)), '']
        label = 'Read the full post' if en else '看全文'
        body += [f'[{label}：{link_text_escape(p.get("title", p["slug"]))}]({prefix}/blog/{p["slug"]}/)'
                 if not en else f'[{label}: {link_text_escape(p.get("title", p["slug"]))}]({prefix}/blog/{p["slug"]}/)', '']
    return '\n'.join(fm + body).rstrip() + '\n'


def digest_path(monday: dt.date, lang: str) -> Path:
    return BLOG_DIR / f'{digest_slug(monday)}.{lang}.mdx'


def write_week(monday: dt.date, force: bool) -> list[Path]:
    posts, names = load_posts(), show_names()
    written = []
    for lang in ('zh-TW', 'en'):
        path = digest_path(monday, lang)
        if path.exists() and not force:
            log(f'  已存在，跳過：{path.name}')
            continue
        text = build_digest(monday, lang, posts, names)
        if text is None:
            log(f'  {monday} 這週沒有 {lang} 節目心得，不寫')
            continue
        path.write_text(text, encoding='utf-8')
        written.append(path)
        log(f'  寫入 {path.name}（{text.count(chr(10) + "## ") - 1} 集）')
    return written


# ---------- 發布 ----------
def run(cmd: list[str], timeout: int = 900) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, encoding='utf-8',
                          errors='replace', timeout=timeout)


def publish(paths: list[Path]) -> bool:
    slugs = sorted({p.name.split('.')[0] for p in paths})
    r = run([NPM, 'run', 'build'], timeout=1800)
    if r.returncode != 0:
        log(f'  ❌ build 失敗 rc={r.returncode}：{(r.stderr or r.stdout)[-800:]}')
        return False
    log('  ✅ build 通過')
    urls = []
    for slug in slugs:
        for prefix in ('', '/en'):
            if not (BLOG_DIR / f'{slug}.{"en" if prefix else "zh-TW"}.mdx').exists():
                continue
            url = f'{SITE}{prefix}/blog/{slug}/'
            try:
                code = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).getcode()
            except Exception as e:  # noqa: BLE001
                log(f'  ❌ 線上取不到 {url}：{type(e).__name__}')
                return False
            log(f'  線上 {code} {url}')
            urls.append(url)
    rel = [str(p.relative_to(ROOT)).replace('\\', '/') for p in paths]
    run(['git', 'add', '--'] + rel)
    msg = (f'blog: 節目筆記週報 {", ".join(slugs)}\n\n由 scripts/weekly_digest.py 產生（RealphaBlogWeeklyDigest）。\n\n'
           'Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')
    c = run(['git', 'commit', '-m', msg, '--'] + rel)
    log(f'  git commit rc={c.returncode} {c.stdout.strip().splitlines()[0] if c.stdout.strip() else c.stderr.strip()[:200]}')
    f = run(['git', 'fetch', 'origin', 'main'], timeout=120)
    anc = run(['git', 'merge-base', '--is-ancestor', 'origin/main', 'HEAD'])
    if f.returncode == 0 and anc.returncode == 0:
        pu = run(['git', 'push', 'origin', 'HEAD:main'], timeout=180)
        log(f'  git push rc={pu.returncode} {pu.stderr.strip()[-200:]}')
    else:
        log('  ⚠️ origin/main 不是本地祖先（或 fetch 失敗），不推，留給人工處理')
    if urls:
        payload = json.dumps({'host': 'blog.getrealpha.com', 'key': INDEXNOW_KEY,
                              'keyLocation': f'{SITE}/{INDEXNOW_KEY}.txt', 'urlList': urls}).encode()
        try:
            req = urllib.request.Request('https://api.indexnow.org/indexnow', data=payload,
                                         headers={'Content-Type': 'application/json; charset=utf-8'})
            log(f'  IndexNow 回 {urllib.request.urlopen(req, timeout=30).getcode()}（{len(urls)} 個網址）')
        except Exception as e:  # noqa: BLE001
            log(f'  ⚠️ IndexNow 失敗：{e}')
    return True


def last_full_week(today: dt.date) -> dt.date:
    this_monday = today - dt.timedelta(days=today.weekday())
    return this_monday - dt.timedelta(days=7)


def selftest() -> None:
    assert last_full_week(dt.date(2026, 9, 21)) == dt.date(2026, 9, 14)   # 週一跑 → 上週一～上週日
    assert last_full_week(dt.date(2026, 9, 22)) == dt.date(2026, 9, 14)
    assert last_full_week(dt.date(2026, 9, 27)) == dt.date(2026, 9, 14)
    zh = {'lang': 'zh-TW', 'tldr': '甲在說一件事。乙也在說。', 'description': '丙。教育性內容，非投資建議。'}
    assert summary(zh) == ['甲在說一件事。', '乙也在說。'], summary(zh)
    zh2 = {'lang': 'zh-TW', 'description': '第一句。第二句。第三句。第四句。第五句。教育性筆記，非投資建議。'}
    assert summary(zh2) == ['第一句。', '第二句。', '第三句。', '第四句。']
    en = {'lang': 'en', 'description': 'One thing. Another thing. Educational, not investment advice.'}
    assert summary(en) == ['One thing.', 'Another thing.'], summary(en)
    assert episode_label({'lang': 'zh-TW', 'slug': 'gooaye-2026-09-19-ep698', 'title': 'x'}) == 'EP698'
    assert episode_label({'lang': 'en', 'slug': 'acquired-2026-09-13-home-depot', 'title': 'x'}) == 'episode of 2026-09-13'
    assert mdx_escape('a<b{c}') == 'a\\<b\\{c\\}'
    print('selftest OK')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--week', action='append', help='該週週一 YYYY-MM-DD，可重複')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--no-publish', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        selftest()
        return 0
    mondays = [dt.date.fromisoformat(w) for w in a.week] if a.week else [last_full_week(dt.date.today())]
    written = []
    for monday in mondays:
        if monday.weekday() != 0:
            log(f'❌ {monday} 不是週一')
            return 2
        log(f'週報 {monday}～{monday + dt.timedelta(days=6)}')
        written += write_week(monday, a.force)
    if not written:
        log('沒有新週報要發（冪等跳過）')
        return 0
    if a.no_publish:
        return 0
    return 0 if publish(written) else 1


if __name__ == '__main__':
    sys.exit(main())
