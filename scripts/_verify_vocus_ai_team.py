# -*- coding: utf-8 -*-
"""三層驗證：API 內容逐段 + 簡體掃描 + 公開頁 HTML/og:image."""
import json
import os
import re
import sys
import urllib.request

AID = "6a572c22fd897800011b158a"
S = r"D:\Temp\claude\C--Users-Charles\e7dd9726-6186-4aa3-a8b1-0d28b75c5c5c\scratchpad"
TOK = open(os.path.join(S, "vocus_token.txt"), encoding="utf-8").read().strip()
NEW_HASH = "ee4c5b03-147d-4ec5-99e5-dd08c569d47d"
OLD_HASH = "179424d4-dd04-4e27-8cd5-1c6ca3465df9"
EXPECTED_IMG = f"https://images.vocus.cc/{NEW_HASH}.png"

# Import BLOCKS from publish script without re-running side effects awkwardly
sys.path.insert(0, os.path.dirname(__file__))
# Read BLOCKS by exec of just the constants portion — safer: re-import module pieces
import importlib.util

spec = importlib.util.spec_from_file_location(
    "pub",
    os.path.join(os.path.dirname(__file__), "vocus_publish_my_ai_engineering_team.py"),
)
# Don't exec the module (it reads token and defines everything fine actually)
# Module top only sets constants — OK to import
import vocus_publish_my_ai_engineering_team as pub  # noqa: E402

# ---------- Layer 2: API content paragraph check + simplified Chinese ----------
req = urllib.request.Request(
    f"https://api.vocus.cc/api/article/{AID}",
    headers={"Authorization": f"Bearer {TOK}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    art = json.loads(resp.read().decode("utf-8"))

article = art.get("article") or art
content_html = article.get("content") or ""
status = article.get("status")
title = article.get("title")
thumb = article.get("thumbnailUrl") or ""
# strip tags
plain = re.sub(r"<[^>]+>", " ", content_html)
plain = re.sub(r"\s+", " ", plain)

print("=== LAYER2 API ===")
print(f"status={status} title={title[:40] if title else None}")
print(f"thumb={thumb}")
print(f"contentLen={len(content_html)} plainLen={len(plain)}")

# collect expected text segments from BLOCKS
segments = []
for b in pub.BLOCKS:
    kind = b[0]
    if kind == "img":
        continue
    if kind == "poem_lines":
        for line in b[1]:
            segments.append(line.replace("**", ""))
    elif kind in ("h3", "p"):
        segments.append(b[1].replace("**", ""))
    elif kind in ("ul", "ol"):
        for item in b[1]:
            segments.append(item.replace("**", ""))

missing = []
for i, seg in enumerate(segments):
    # allow minor whitespace differences: check core slice
    needle = re.sub(r"\s+", "", seg)
    hay = re.sub(r"\s+", "", plain)
    if needle not in hay:
        missing.append((i, seg[:60]))

print(f"segments_checked={len(segments)} missing={len(missing)}")
if missing:
    for i, s in missing[:20]:
        print(f"  MISS[{i}]: {s}")
else:
    print("segment_check: PASS (0 missing)")

# simplified Chinese blacklist
blacklist = list("开关状态软资报过运点对确决变应仓")
found_simp = []
for ch in blacklist:
    if ch in plain:
        # find context
        idx = plain.find(ch)
        ctx = plain[max(0, idx - 12) : idx + 13]
        found_simp.append((ch, ctx))
print(f"simplified_hits={len(found_simp)}")
for ch, ctx in found_simp:
    print(f"  SIMP '{ch}' @ ...{ctx}...")
if not found_simp:
    print("simplified_check: PASS")

# also verify img hash in content
has_new = NEW_HASH in content_html
has_old = OLD_HASH in content_html
print(f"content_has_new_hash={has_new} content_has_old_hash={has_old}")

# ---------- Layer 3: anonymous public page ----------
print("=== LAYER3 PUBLIC ===")
html_path = os.path.join(S, "vocus_public_page.html")
req2 = urllib.request.Request(
    f"https://vocus.cc/article/{AID}",
    headers={"User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(req2, timeout=60) as resp:
    html = resp.read().decode("utf-8", errors="replace")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)
print(f"saved={html_path} bytes={len(html)}")

# parse __NEXT_DATA__
m = re.search(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
    html,
    re.S,
)
if not m:
    print("NEXT_DATA: MISSING")
    next_data = None
else:
    next_data = json.loads(m.group(1))
    print("NEXT_DATA: present")

# og:image
og_m = re.search(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    html,
    re.I,
)
if not og_m:
    og_m = re.search(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        html,
        re.I,
    )
og_raw = og_m.group(1) if og_m else None
og_decoded = None
if og_raw:
    from urllib.parse import unquote

    og_decoded = unquote(og_raw)
print(f"og:image raw={og_raw[:120] if og_raw else None}...")
print(f"og:image decoded={og_decoded[:200] if og_decoded else None}")
print(
    f"og_has_images.vocus.cc={bool(og_decoded and 'images.vocus.cc' in og_decoded)}"
)
print(f"og_has_new_hash={bool(og_decoded and NEW_HASH in og_decoded)}")
print(f"og_has_old_hash={bool(og_decoded and OLD_HASH in og_decoded)}")
print(
    f"og_is_default={bool(og_decoded and 'vocus_og_2025' in og_decoded)}"
)

# checks from next_data / page
checks = {
    "title": TITLE if (TITLE := pub.TITLE) in html or (title and title in html) else False,
    "/ledger": "/ledger" in html,
    "/propose": "/propose" in html,
    "disclaimer": "本文為投資方法論" in html or "不構成任何個股買賣建議" in html,
}
# dig status from next_data
pub_status = None
if next_data:
    try:
        props = next_data.get("props", {}).get("pageProps", {})
        # try common shapes
        a = props.get("article") or props.get("initialArticle") or props
        if isinstance(a, dict):
            pub_status = a.get("status")
            if pub_status is None and isinstance(a.get("article"), dict):
                pub_status = a["article"].get("status")
        # recursive search
        if pub_status is None:

            def find_status(obj, depth=0):
                if depth > 8:
                    return None
                if isinstance(obj, dict):
                    if "status" in obj and obj.get("_id") == AID:
                        return obj["status"]
                    if obj.get("status") in (1, 2) and (
                        obj.get("title") == title or obj.get("_id") == AID
                    ):
                        return obj["status"]
                    for v in obj.values():
                        r = find_status(v, depth + 1)
                        if r is not None:
                            return r
                elif isinstance(obj, list):
                    for v in obj:
                        r = find_status(v, depth + 1)
                        if r is not None:
                            return r
                return None

            pub_status = find_status(next_data)
    except Exception as e:
        print("status_dig_err", e)

print(f"public_status_from_next={pub_status}")
print(f"public_checks={checks}")

# Layer 1 style counts from content HTML (SSR content field)
print("=== LAYER1-ish from API content HTML ===")
h3n = len(re.findall(r"<h3\b", content_html, re.I))
uln = len(re.findall(r"<ul\b", content_html, re.I))
oln = len(re.findall(r"<ol\b", content_html, re.I))
imgn = len(re.findall(r"<img\b", content_html, re.I))
print(f"H3={h3n} UL={uln} OL={oln} img={imgn}")
