"""更新已發布的 Substack 文章內容，不寄信給訂閱者。

只給「已經發布過、內容有改動」的文章用（2026-09-15 補英文配圖的 4 篇）。
流程照 substack_publish_mdx.py 的 cmd_cover / cmd_unwall：put_draft 之後必須再
prepublish + publish_draft(send=False)，公開頁才會更新（2026-09-08 實測）。
"""
import os
import sys

BLOG = r'C:/Users/Charles/Projects/realpha-blog'
sys.path.insert(0, os.path.join(BLOG, 'scripts'))
os.chdir(BLOG)
import substack_publish_mdx as m  # noqa: E402

slugs = sys.argv[1:]
assert slugs, '要給 slug'
api = m.make_api()
ids = m.load_ids()
for slug in slugs:
    rec = ids.get(slug) or {}
    if not rec.get('post_id'):
        print('❌ %s 台帳沒有 post_id（沒發布過），跳過，這支只更新已發布的' % slug)
        continue
    rc = m.cmd_draft(api, [slug])
    draft_id = m.load_ids()[slug]['draft_id']
    m.api_try(api.prepublish_draft, draft_id)
    m.api_try(api.publish_draft, draft_id, send=False)
    info = m.inspect_draft(m.api_try(api.get_draft, draft_id))
    print('✅ 已更新發布（不寄信）rc=%s' % rc)
    m.print_line(slug, info)
