#!/usr/bin/env python3
"""對答案帳本 — 開獎發布管線（cron 每日跑一次）。

流程：ledger_settle.py 開獎 → 若有機器卡真的被判定 → npm run build → git commit（開獎戳）
→ git push → 通知 Charles（inbox + 可選 email）。沒到期就安靜 no-op，零 LLM。

設計原則（LEDGER_SPEC_v1.md / ADR-0019）：
- 漏開獎比判錯更傷 → 每日跑保證到期一定開。
- 機器判定 verdict 由 ledger_settle 寫死；本腳本只負責「發布 + 通知」，不改判定。
- 人工卡到期由 ledger_settle 投遞 inbox，本腳本偵測到就一併提醒 Charles。

用法：
  python scripts/ledger_open.py                 # 正式：settle→build→commit→push→notify
  python scripts/ledger_open.py --no-publish     # 只 settle + 通知，不 build/commit/push（測試用）
  python scripts/ledger_open.py --today 2026-08-09 --ledger <path>  # 覆寫日期/帳本（測試用）
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_LEDGER = REPO / "src" / "data" / "ledger.json"
INBOX = Path.home() / ".agents" / "iris" / "inbox"
LOG = REPO / "scripts" / "ledger_open.log"


def log(msg: str) -> None:
    stamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S%z")
    line = f"[{stamp}] {msg}"
    print(line)
    try:
        with LOG.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass


def run(cmd: list[str], cwd: Path | None = None, timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, cwd=str(cwd or REPO), capture_output=True, text=True, timeout=timeout
    )


def load_cards(ledger: Path) -> list[dict]:
    return json.loads(ledger.read_text(encoding="utf-8"))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Realpha ledger 開獎發布管線")
    p.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER)
    p.add_argument("--today", default=None, help="覆寫今天日期 YYYY-MM-DD（測試用）")
    p.add_argument("--no-publish", action="store_true", help="只 settle+通知，不 build/commit/push")
    return p.parse_args()


def notify(subject: str, body: str) -> None:
    """寫 inbox；若有 email 基建則另寄一封（smtplib-first，失敗不阻斷）。"""
    try:
        INBOX.mkdir(parents=True, exist_ok=True)
        slug = subject.replace(" ", "_").replace("/", "-")[:60]
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        (INBOX / f"ledger_open_{stamp}_{slug}.md").write_text(
            f"# {subject}\n\n{body}\n", encoding="utf-8"
        )
    except OSError as exc:
        log(f"notify inbox 失敗：{exc}")
    # 可選 email：走既有 smtplib helper（不存在就跳過）
    helper = Path.home() / "scripts" / "send_email.py"
    if helper.exists():
        try:
            run([sys.executable, str(helper), "--to", "keytransit@gmail.com",
                 "--subject", subject, "--body", body], cwd=Path.home(), timeout=90)
        except Exception as exc:  # noqa: BLE001 通知失敗不該擋開獎
            log(f"notify email 失敗（不阻斷）：{exc}")


def settled_summary(before: list[dict], after: list[dict]) -> list[str]:
    """比對 settle 前後，找出這輪新開獎的卡。"""
    before_status = {c.get("card_id"): c.get("status") for c in before}
    out = []
    for c in after:
        cid = c.get("card_id")
        if before_status.get(cid) == "aging" and c.get("status") in ("hit", "miss"):
            v = c.get("verdict") or {}
            out.append(f"- {cid}｜{c.get('title')}｜{'✓ 命中' if c.get('status') == 'hit' else '✗ 證偽'}｜"
                       f"{v.get('summary', '')}")
    return out


def main() -> int:
    args = parse_args()
    ledger = args.ledger.resolve()
    if not ledger.exists():
        log(f"帳本不存在：{ledger}")
        return 1

    before = load_cards(ledger)

    # 1) 開獎（沿用 ledger_settle.py，機器卡自動判、人工卡投遞 inbox）
    settle_cmd = [sys.executable, str(REPO / "scripts" / "ledger_settle.py"), "--ledger", str(ledger)]
    if args.today:
        settle_cmd += ["--today", args.today]
    res = run(settle_cmd)
    log(f"settle rc={res.returncode} out={res.stdout.strip()}")
    if res.stderr.strip():
        log(f"settle stderr={res.stderr.strip()}")

    after = load_cards(ledger)
    newly = settled_summary(before, after)

    # settle 失敗（如 yfinance 錯誤）→ 通知，不繼續發布
    if res.returncode != 0:
        notify("⚠️ 帳本開獎異常（settle 非 0）",
               f"settle 回傳 {res.returncode}，可能到期卡抓數據失敗，請查。\n\nstdout:\n{res.stdout}\n\nstderr:\n{res.stderr}")
        return 1

    # 沒有機器卡新開獎 → 安靜結束（人工卡提醒已由 settle 投遞 inbox）
    if not newly:
        # settle 有寫人工提醒的話，stdout 會顯示 human_reminded>0
        if "human_reminded=0" not in res.stdout:
            notify("📒 帳本有人工卡到期待裁決", f"settle 輸出：{res.stdout.strip()}\n請查 inbox 的 ledger_*.md 依判準裁決。")
        log("無機器卡新開獎，結束（no-op 或僅人工提醒）")
        return 0

    body = "本輪新開獎：\n" + "\n".join(newly) + "\n\nblog.getrealpha.com/ledger"
    log("新開獎：\n" + "\n".join(newly))

    if args.no_publish:
        notify("📒 帳本開獎（未發布，--no-publish）", body)
        log("--no-publish：跳過 build/commit/push")
        return 0

    # 2) build（把開獎結果打進 dist，服務直接吃）
    b = run(["npm", "run", "build"], timeout=900)
    if b.returncode != 0:
        notify("⚠️ 帳本開獎後 build 失敗", f"{body}\n\nbuild stderr:\n{b.stderr[-2000:]}")
        log(f"build 失敗 rc={b.returncode}")
        return 1
    log("build 成功")

    # 3) commit（開獎戳）+ push
    ids = ", ".join(line.split("｜")[0].strip("- ") for line in newly)
    run(["git", "add", "--", str(ledger.relative_to(REPO)).replace("\\", "/")])
    c = run(["git", "commit", "-m", f"ledger: 開獎 {ids}\n\n{chr(10).join(newly)}"])
    if c.returncode != 0:
        notify("⚠️ 帳本開獎 commit 失敗", f"{body}\n\ncommit out:\n{c.stdout}\n{c.stderr}")
        log(f"commit 失敗：{c.stdout} {c.stderr}")
        return 1
    p = run(["git", "push", "origin", "main"], timeout=120)
    if p.returncode != 0:
        notify("⚠️ 帳本開獎 push 失敗（已 commit 未 push）",
               f"{body}\n\npush stderr:\n{p.stderr}\n本機已 commit，請手動 push。")
        log(f"push 失敗：{p.stderr}")
        return 1

    log("開獎已發布並 push")
    notify("📒 帳本開獎已上線", body)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
