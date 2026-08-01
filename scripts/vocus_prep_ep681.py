# -*- coding: utf-8 -*-
"""EP681 前置：建草稿 + 上傳封面。印出 AID 與 IMG_URL 供發文腳本填入。"""
import json, os, mimetypes, uuid
import urllib.request

S = r'D:\Temp\claude\C--Users-Charles\f8ebc1e4-ccaa-4c72-abfd-b7bff7eec81c\scratchpad'
TOK = open(os.path.join(S, 'vocus_token.txt'), encoding='utf-8').read().strip()
IMG_PATH = r'C:\Users\Charles\Projects\realpha-blog\public\covers\gooaye-ep681-fundamentals-vs-price-cover.png'
IMG_W, IMG_H = 1672, 941

BASE = 'https://api.vocus.cc'
H = {'Authorization': f'Bearer {TOK}', 'User-Agent': 'Mozilla/5.0',
     'Origin': 'https://vocus.cc', 'Referer': 'https://vocus.cc/'}

def jreq(method, path, body):
    r = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={**H, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')

# 1) 建新草稿
st, body = jreq('POST', '/api/articles', {'draftType': 'pad', 'title': ''})
print('create draft:', st, body[:200])
aid = None
try:
    aid = json.loads(body).get('_id') or json.loads(body).get('article', {}).get('_id')
except Exception:
    pass
print('AID =', aid)

# 2) 上傳封面（multipart）
boundary = '----vocus' + uuid.uuid4().hex
data = open(IMG_PATH, 'rb').read()
fname = os.path.basename(IMG_PATH)
ctype = mimetypes.guess_type(fname)[0] or 'image/png'
parts = []
def add_field(name, value):
    parts.append(('--' + boundary).encode())
    parts.append(f'Content-Disposition: form-data; name="{name}"'.encode())
    parts.append(b'')
    parts.append(str(value).encode())
parts.append(('--' + boundary).encode())
parts.append(f'Content-Disposition: form-data; name="img"; filename="{fname}"'.encode())
parts.append(f'Content-Type: {ctype}'.encode())
parts.append(b'')
parts.append(data)
add_field('width', IMG_W)
add_field('height', IMG_H)
parts.append(('--' + boundary + '--').encode())
parts.append(b'')
payload = b'\r\n'.join(parts)

r = urllib.request.Request(BASE + '/api/imgs', method='POST', data=payload,
    headers={**H, 'Content-Type': f'multipart/form-data; boundary={boundary}'})
try:
    with urllib.request.urlopen(r, timeout=60) as resp:
        st, body = resp.status, resp.read().decode('utf-8', 'replace')
except urllib.error.HTTPError as e:
    st, body = e.code, e.read().decode('utf-8', 'replace')
print('upload img:', st, body[:300])
rel = None
try:
    j = json.loads(body)
    rel = j.get('relPath') or j.get('path') or j.get('url')
except Exception:
    pass
print('IMG_URL = https://images.vocus.cc/' + str(rel) if rel else 'IMG_REL_NONE')
