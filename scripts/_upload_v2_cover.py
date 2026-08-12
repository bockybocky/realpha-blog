# -*- coding: utf-8 -*-
"""One-shot: upload my-ai-engineering-team-cover-v2.png to vocus, print IMG_URL."""
import json
import os
import urllib.request

S = r"D:\Temp\claude\C--Users-Charles\e7dd9726-6186-4aa3-a8b1-0d28b75c5c5c\scratchpad"
TOK = open(os.path.join(S, "vocus_token.txt"), encoding="utf-8").read().strip()
cover = r"C:\Users\Charles\Projects\realpha-blog\public\covers\my-ai-engineering-team-cover-v2.png"
assert os.path.isfile(cover), "cover missing"

boundary = "----VocusBoundary7MA4YWxkTrZu0gW"
filename = os.path.basename(cover)
with open(cover, "rb") as f:
    img_data = f.read()

parts = []
parts.append(f"--{boundary}\r\n".encode())
parts.append(
    f'Content-Disposition: form-data; name="img"; filename="{filename}"\r\n'.encode()
)
parts.append(b"Content-Type: image/png\r\n\r\n")
parts.append(img_data)
parts.append(b"\r\n")
parts.append(f"--{boundary}\r\n".encode())
parts.append(b'Content-Disposition: form-data; name="width"\r\n\r\n')
parts.append(b"1664\r\n")
parts.append(f"--{boundary}\r\n".encode())
parts.append(b'Content-Disposition: form-data; name="height"\r\n\r\n')
parts.append(b"936\r\n")
parts.append(f"--{boundary}--\r\n".encode())
body = b"".join(parts)

req = urllib.request.Request(
    "https://api.vocus.cc/api/imgs",
    data=body,
    method="POST",
    headers={
        "Authorization": f"Bearer {TOK}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "Mozilla/5.0",
    },
)
try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read().decode("utf-8")
        code = resp.status
except Exception as e:
    body_err = ""
    if hasattr(e, "read"):
        try:
            body_err = e.read().decode("utf-8", errors="replace")[:800]
        except Exception:
            pass
    print("ERR", getattr(e, "code", type(e).__name__), str(e)[:300], body_err)
    raise SystemExit(1)

print("status", code)
data = json.loads(raw)
print(json.dumps(data, ensure_ascii=False, indent=2)[:2500])

rel = None
if isinstance(data, dict):
    rel = data.get("relPath")
    if not rel and isinstance(data.get("data"), dict):
        rel = data["data"].get("relPath")
    if not rel and isinstance(data.get("result"), dict):
        rel = data["result"].get("relPath")
    if not rel:
        # nested common shapes
        for k, v in data.items():
            if isinstance(v, dict) and "relPath" in v:
                rel = v["relPath"]
                break
            if k == "relPath":
                rel = v
if not rel:
    print("TOP_KEYS", list(data.keys()) if isinstance(data, dict) else type(data))
    raise SystemExit(2)

print("relPath", rel)
print("IMG_URL", f"https://images.vocus.cc/{rel}")
