"""改一篇已發布文章的標題：本機中英文稿 → 建置 → 推送 → 同步方格子。

為什麼要有（2026-09-04）：Charles 要求改 SEMICON 那篇的標題，當時沒有現成工具，
臨時手動走了四步，中間還踩到方格子 API 的欄位型別坑。改標題不該每次都重來一遍。

設計原則：
- **預設不動任何東西**，要加 --apply 才真的改（標題是對外的東西）
- 每一步都讀回驗證，任一步失敗就停在那裡，不繼續往下
- 方格子那段**先整份讀下來存快照**再改，且原值帶回只換標題——
  不確定該 API 是部分更新還是全量覆蓋語意，只送 title 有清空內容的風險

用法：
    python scripts/retitle.py <slug> --zh "新標題" --en "New Title"          # 只看會改什麼
    python scripts/retitle.py <slug> --zh "新標題" --en "New Title" --apply  # 真的改
    python scripts/retitle.py <slug> --zh "新標題" --apply --skip-vocus      # 不動方格子
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Sequence

REPO = Path(__file__).resolve().parent.parent
CONTENT = REPO / "src" / "content" / "blog"
VOCUS_LINKS = REPO / "src" / "data" / "vocus-links.json"
TOKEN_FILE = Path(r"D:\Temp\vocus_token.txt")
TOKEN_TOOL = Path.home() / "scripts" / "vocus_token_from_profile.py"
TITLE_LINE = re.compile(r'^title:\s*".*"\s*$', re.MULTILINE)


def read_title(path: Path) -> str | None:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("title:"):
            return line[len("title:"):].strip().strip('"')
    return None


def set_title(path: Path, new: str, apply: bool) -> tuple[str, str]:
    text = path.read_text(encoding="utf-8")
    match = TITLE_LINE.search(text)
    if not match:
        raise SystemExit(f"{path.name} 找不到 title 行")
    old = match.group(0)
    replacement = f'title: "{new}"'
    if apply:
        path.write_text(text.replace(old, replacement, 1), encoding="utf-8")
        back = read_title(path)
        if back != new:
            raise SystemExit(f"{path.name} 寫入後讀回不符：{back}")
    return old, replacement


def run(cmd: Sequence[str], cwd: Path, timeout: int = 900) -> tuple[int, str]:
    result = subprocess.run(list(cmd), cwd=str(cwd), capture_output=True, text=True,
                            encoding="utf-8", errors="replace", timeout=timeout, check=False)
    return result.returncode, (result.stdout or "") + (result.stderr or "")


def vocus_token() -> str:
    if TOKEN_TOOL.exists():
        subprocess.run([sys.executable, str(TOKEN_TOOL)], capture_output=True, check=False)
    if not TOKEN_FILE.exists():
        raise SystemExit(f"拿不到方格子憑證（{TOKEN_FILE} 不存在），請先跑 {TOKEN_TOOL.name}")
    return TOKEN_FILE.read_text(encoding="utf-8").strip()


def vocus_api(method: str, path: str, token: str, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"https://api.vocus.cc{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {token}", "User-Agent": "Mozilla/5.0",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def vocus_retitle(article_id: str, new_title: str, apply: bool) -> bool:
    token = vocus_token()
    status, body = vocus_api("GET", f"/api/article/{article_id}", token)
    if status != 200:
        print(f"  方格子讀取失敗 {status}：{body[:120]}")
        return False
    art = json.loads(body)["article"]
    before_len = len(str(art.get("content") or ""))
    print(f"  方格子現有標題：{art.get('title')}")
    print(f"  內容長度 {before_len}｜字數 {art.get('wordsCount')}｜狀態 {art.get('status')}")
    if art.get("title") == new_title:
        print("  方格子標題已經是新的，跳過")
        return True
    if not apply:
        return True

    snapshot = Path(r"D:\Temp") / f"vocus_{article_id[:10]}_before_retitle.json"
    snapshot.write_text(json.dumps(art, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  改動前快照已存 {snapshot}")

    # 原值帶回只換標題。newCategory 必須是整個物件——送 id 字串會回 400。
    payload = {
        "title": new_title,
        "content": art.get("content"),
        "abstract": art.get("abstract"),
        "catalog": art.get("catalog") or "[]",
        "showCatalog": art.get("showCatalog", True),
        "wordsCount": art.get("wordsCount"),
        "readingTime": art.get("readingTime"),
        "thumbnailUrl": art.get("thumbnailUrl"),
        "noThumbnailImage": art.get("noThumbnailImage", False),
        "ogImageType": art.get("ogImageType") or "thumbnail",
        "coverSource": art.get("coverSource") or "upload",
        "tags": [{"title": t["title"]} for t in (art.get("tags") or []) if t.get("title")],
        "newCategory": art.get("newCategory"),
        "isInvestment": art.get("isInvestment", True),
        "setInvestment": art.get("isInvestment", True),
        "adult": art.get("adult", False),
    }
    status, body = vocus_api("PATCH", f"/api/articles/{article_id}",
                             token, {k: v for k, v in payload.items() if v is not None})
    print(f"  metadata PATCH：{status}")
    if status != 200:
        print(f"  失敗內容：{body[:160]}")
        print(f"  ⚠️ 快照在 {snapshot} 可還原")
        return False

    # 草稿標題也要換，否則後台顯示的還是舊的（實測會不一致）
    draft = art.get("currentDraft") or {}
    if draft.get("title") and draft.get("title") != new_title:
        d_status, _ = vocus_api("PATCH", f"/api/articles/{article_id}/draft", token, {
            "title": new_title, "articleId": article_id,
            "lexicalObj": draft.get("lexicalObj"), "obj": draft.get("obj") or "",
            "draftType": draft.get("draftType") or "pad", "commandLogs": "[]"})
        print(f"  draft PATCH：{d_status}")

    status, body = vocus_api("GET", f"/api/article/{article_id}", token)
    after = json.loads(body)["article"]
    after_len = len(str(after.get("content") or ""))
    ok = after.get("title") == new_title and after_len == before_len
    print(f"  讀回標題：{after.get('title')}")
    print(f"  內容長度未變：{after_len == before_len}（{before_len} → {after_len}）")
    if not ok:
        print(f"  ⚠️ 驗證未通過，快照在 {snapshot}")
    return ok


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="改一篇已發布文章的標題（本機＋方格子）")
    # slug 與 --zh 不設 required，否則 --selftest 會被 argparse 先擋掉（首版實測）
    parser.add_argument("slug", nargs="?")
    parser.add_argument("--zh", help="新的繁中標題")
    parser.add_argument("--en", default=None, help="新的英文標題；不給就不動英文版")
    parser.add_argument("--apply", action="store_true", help="真的改；不加只顯示會改什麼")
    parser.add_argument("--skip-vocus", action="store_true", help="不動方格子")
    parser.add_argument("--skip-push", action="store_true", help="改完不建置也不推送")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args(argv)
    if args.selftest:
        return selftest()
    if not args.slug or not args.zh:
        parser.error("需要 slug 與 --zh（或用 --selftest）")

    zh = CONTENT / f"{args.slug}.zh-TW.mdx"
    en = CONTENT / f"{args.slug}.en.mdx"
    if not zh.exists():
        print(f"RETITLE status=FAIL reason=找不到 {zh.name}")
        return 1

    print(f"繁中：{read_title(zh)}")
    print(f"  →  {args.zh}")
    if args.en:
        if not en.exists():
            print(f"RETITLE status=FAIL reason=指定了 --en 但找不到 {en.name}")
            return 1
        print(f"英文：{read_title(en)}")
        print(f"  →  {args.en}")
    elif en.exists():
        print(f"⚠️ 英文版存在但沒給 --en，兩版標題會不一致：{read_title(en)}")

    set_title(zh, args.zh, args.apply)
    if args.en:
        set_title(en, args.en, args.apply)

    if not args.apply:
        print("RETITLE status=DRY_RUN reason=加 --apply 才會真的改")
        return 0
    print("本機稿已改並讀回確認")

    if not args.skip_push:
        code, out = run(["npm", "run", "build"], REPO)
        if code != 0:
            print(f"RETITLE status=FAIL reason=建置失敗\n{out[-400:]}")
            return 1
        print("建置通過")
        files = [str(zh.relative_to(REPO))] + ([str(en.relative_to(REPO))] if args.en else [])
        run(["git", "add", *files], REPO)
        code, out = run(["git", "commit", "-q", "-m", f"blog: {args.slug} 改標題——{args.zh}"], REPO)
        if code != 0 and "nothing to commit" not in out:
            print(f"RETITLE status=FAIL reason=commit 失敗\n{out[-200:]}")
            return 1
        code, out = run(["git", "push"], REPO)
        if code != 0:
            print(f"RETITLE status=FAIL reason=push 失敗\n{out[-200:]}")
            return 1
        print("已推送")

    if not args.skip_vocus and VOCUS_LINKS.exists():
        links = json.loads(VOCUS_LINKS.read_text(encoding="utf-8"))
        article_id = links.get(args.slug)
        if not article_id:
            print(f"方格子沒有這篇（vocus-links.json 查無 {args.slug}），跳過")
        else:
            print(f"方格子文章 {article_id}：")
            if not vocus_retitle(article_id, args.zh, args.apply):
                print("RETITLE status=FAIL reason=方格子同步失敗（本機與部落格已改）")
                return 1

    print(f"RETITLE status=OK slug={args.slug}")
    return 0


def selftest() -> int:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "x.zh-TW.mdx"
        path.write_text('---\ntitle: "舊標題"\nslug: "x"\n---\n\n內文\n', encoding="utf-8")
        assert read_title(path) == "舊標題"
        set_title(path, "新標題", apply=False)
        assert read_title(path) == "舊標題", "沒加 --apply 不該動檔案"
        set_title(path, "新標題", apply=True)
        assert read_title(path) == "新標題"
        assert "內文" in path.read_text(encoding="utf-8"), "只該動 title 行"
    assert TITLE_LINE.search('title: "有：冒號的標題"')
    assert not TITLE_LINE.search('description: "這不是標題"')
    print("SELFTEST retitle PASS read=1 dry_run_no_write=1 apply=1 body_intact=1 regex=2cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())
