# -*- coding: utf-8 -*-
"""為股癌 EP682／財報狗 EP541 兩篇準備方格子草稿：上傳封面 + 開新 articleId。

用法：python vocus_prep_ep682_ep541.py
輸出：把 {slug: {articleId, imgUrl, w, h}} 寫進 scratchpad 的 vocus_ids.json
"""
import json, os, struct, sys, uuid
import urllib.request

SP = sys.argv[1] if len(sys.argv) > 1 else r'D:\Temp\claude\C--Users-Charles\09bc9574-f278-41fb-8634-8a571e39c551\scratchpad'
TOK = open(os.path.join(SP, 'vocus_token.txt'), encoding='utf-8').read().strip()
ROOT = r'C:\Users\Charles\Projects\realpha-blog'

COVERS = {
    'gooaye-ep682': 'public/covers/gooaye-ep682-no-bad-news-selloff-cover.png',
    'caibaogou-ep541': 'public/covers/caibaogou-ep541-panel-level-packaging-cover.png',
}


def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('not a png: ' + path)
    return struct.unpack('>II', head[16:24])


def upload(path):
    w, h = png_size(path)
    boundary = uuid.uuid4().hex
    name = os.path.basename(path)
    body = b''
    for field, value in (('width', str(w)), ('height', str(h))):
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"\r\n\r\n{value}\r\n').encode()
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="img"; filename="{name}"\r\n'
             'Content-Type: image/png\r\n\r\n').encode()
    body += open(path, 'rb').read() + b'\r\n'
    body += f'--{boundary}--\r\n'.encode()

    req = urllib.request.Request(
        'https://api.vocus.cc/api/imgs', data=body, method='POST',
        headers={'Authorization': f'Bearer {TOK}',
                 'Content-Type': f'multipart/form-data; boundary={boundary}',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc',
                 'Referer': 'https://vocus.cc/'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        res = json.loads(resp.read())
    return 'https://images.vocus.cc/' + res['relPath'], w, h


def new_article():
    req = urllib.request.Request(
        'https://api.vocus.cc/api/articles', method='POST',
        data=json.dumps({'draftType': 'pad', 'title': ''}).encode(),
        headers={'Authorization': f'Bearer {TOK}', 'Content-Type': 'application/json',
                 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://vocus.cc',
                 'Referer': 'https://vocus.cc/'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())['_id']


out = {}
for slug, rel in COVERS.items():
    url, w, h = upload(os.path.join(ROOT, rel))
    aid = new_article()
    out[slug] = {'articleId': aid, 'imgUrl': url, 'w': w, 'h': h}
    print(f'{slug}: article={aid} img={url} {w}x{h}')

with open(os.path.join(SP, 'vocus_ids.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print('written to', os.path.join(SP, 'vocus_ids.json'))
