# -*- coding: utf-8 -*-
"""Parse BLOCKS via AST (no execute side effects), segment-check vs API content."""
import ast
import json
import os
import re
import urllib.request

AID = "6a572c22fd897800011b158a"
S = r"D:\Temp\claude\C--Users-Charles\e7dd9726-6186-4aa3-a8b1-0d28b75c5c5c\scratchpad"
TOK = open(os.path.join(S, "vocus_token.txt"), encoding="utf-8").read().strip()
src_path = os.path.join(os.path.dirname(__file__), "vocus_publish_my_ai_engineering_team.py")
src = open(src_path, encoding="utf-8").read()
tree = ast.parse(src)
blocks = None
for node in tree.body:
    if isinstance(node, ast.Assign):
        for t in node.targets:
            if isinstance(t, ast.Name) and t.id == "BLOCKS":
                blocks = ast.literal_eval(node.value)

segments = []
for b in blocks:
    kind = b[0]
    if kind == "img":
        continue
    if kind == "poem_lines":
        for line in b[1]:
            segments.append(line.replace("**", ""))
    elif kind in ("h3", "p", "p_italic"):
        segments.append(b[1].replace("**", ""))
    elif kind in ("ul", "ol"):
        for item in b[1]:
            segments.append(item.replace("**", ""))

req = urllib.request.Request(
    f"https://api.vocus.cc/api/article/{AID}",
    headers={"Authorization": f"Bearer {TOK}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    art = json.loads(resp.read().decode("utf-8"))
article = art.get("article") or art
content_html = article.get("content") or ""
plain = re.sub(r"<[^>]+>", " ", content_html)
plain = re.sub(r"\s+", " ", plain)
hay = re.sub(r"\s+", "", plain)

missing = []
for i, seg in enumerate(segments):
    needle = re.sub(r"\s+", "", seg)
    if needle not in hay:
        missing.append((i, seg[:100]))

print(f"blocks={len(blocks)} segments={len(segments)} missing={len(missing)}")
if missing:
    for i, s in missing:
        print(f"MISS[{i}]: {s}")
else:
    print("segment_check: PASS (0 missing)")

blacklist = list("开关状态软资报过运点对确决变应仓")
hits = [(ch, plain[max(0, plain.find(ch) - 10) : plain.find(ch) + 12]) for ch in blacklist if ch in plain]
print(f"simplified_hits={len(hits)}")
for ch, ctx in hits:
    print(f"  {ch}: {ctx}")
if not hits:
    print("simplified_check: PASS")
