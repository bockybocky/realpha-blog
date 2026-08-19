# -*- coding: utf-8 -*-
"""看部落格的流量：誰在看、哪篇有人看、人從哪裡來。

資料來源＝serve_dist.mjs 寫的 logs/visits-YYYY-MM-DD.jsonl（每次請求一行）。
機器人預設不算進來——它們佔的量很大，混在一起看不出真人在做什麼。

用法：
    python scripts/visits_report.py            # 最近 7 天
    python scripts/visits_report.py --days 30
    python scripts/visits_report.py --bots     # 連機器人一起看
"""
import argparse
import datetime
import glob
import json
import os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(os.path.dirname(HERE), 'logs')


def load(days, keep_bots):
    today = datetime.datetime.now(datetime.timezone.utc).date()
    wanted = {(today - datetime.timedelta(days=i)).isoformat() for i in range(days)}
    rows = []
    for path in sorted(glob.glob(os.path.join(LOG_DIR, 'visits-*.jsonl'))):
        day = os.path.basename(path)[7:17]
        if day not in wanted:
            continue
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue                      # 寫到一半被截斷的行，跳過就好
            if not keep_bots and r.get('bot'):
                continue
            rows.append(r)
    return rows


def source_of(ref):
    """把 referer 歸成一個看得懂的來源名稱。"""
    if not ref:
        return '直接進來或書籤'
    host = ref.split('//')[-1].split('/')[0].lower()
    if 'vocus' in host:
        return '方格子'
    if 'getrealpha' in host:
        return '站內'
    if 'google' in host:
        return 'Google 搜尋'
    if any(k in host for k in ('t.co', 'twitter', 'x.com')):
        return 'X'
    if 'facebook' in host:
        return 'Facebook'
    if 'github' in host:
        return 'GitHub'
    return host or '不明'


def bar(n, top, width=22):
    return '█' * max(1, round(n / top * width)) if top else ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=7)
    ap.add_argument('--bots', action='store_true', help='連機器人一起算')
    a = ap.parse_args()

    rows = load(a.days, a.bots)
    if not rows:
        print('最近 %d 天沒有任何紀錄。' % a.days)
        print('可能原因：伺服器還沒重啟（新的記錄功能要重啟才生效），或這段期間真的沒有人來。')
        print('紀錄目錄：%s' % LOG_DIR)
        return

    print('=' * 60)
    print('最近 %d 天：%d 次瀏覽%s' % (a.days, len(rows), '' if a.bots else '（不含機器人）'))
    print('=' * 60)

    print('\n人從哪裡來')
    srcs = Counter(source_of(r.get('ref')) for r in rows)
    top = srcs.most_common(1)[0][1]
    for name, n in srcs.most_common(8):
        print('  %-14s %4d  %s' % (name, n, bar(n, top)))

    vocus = srcs.get('方格子', 0)
    pct = vocus / len(rows) * 100
    print('\n  → 方格子那條線帶回來 %d 次，佔 %.1f%%' % (vocus, pct))

    print('\n哪幾頁有人看')
    pages = Counter(r['p'] for r in rows)
    top = pages.most_common(1)[0][1]
    for path, n in pages.most_common(12):
        print('  %4d  %s %s' % (n, bar(n, top, 14), path[:52]))

    miss = [r for r in rows if r.get('s') == 404]
    if miss:
        print('\n有人點到不存在的頁面（%d 次）' % len(miss))
        for path, n in Counter(r['p'] for r in miss).most_common(5):
            print('  %4d  %s' % (n, path[:56]))

    days = Counter(r['t'][:10] for r in rows)
    print('\n每天')
    top = max(days.values())
    for day in sorted(days):
        print('  %s  %4d  %s' % (day, days[day], bar(days[day], top)))

    if a.bots:
        b = sum(1 for r in rows if r.get('bot'))
        print('\n其中機器人 %d 次（%.0f%%）' % (b, b / len(rows) * 100))


if __name__ == '__main__':
    main()
