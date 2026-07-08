#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any


DEFAULT_LEDGER = Path("src/data/ledger.json")
DEFAULT_INBOX = Path.home() / ".agents" / "iris" / "inbox"
BENCHMARK_SYMBOLS = ("SPY", "QQQ")


@dataclass
class PricePoint:
    symbol: str
    start_date: str
    start_close: float
    end_date: str
    end_close: float

    @property
    def return_pct(self) -> float:
        return ((self.end_close / self.start_close) - 1.0) * 100.0

    def to_json(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "start_date": self.start_date,
            "start_close": round(self.start_close, 6),
            "end_date": self.end_date,
            "end_close": round(self.end_close, 6),
            "return_pct": round(self.return_pct, 4),
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Settle due Realpha ledger cards without LLM calls.")
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER, help="Path to ledger.json")
    parser.add_argument("--today", default=None, help="Override today's date as YYYY-MM-DD")
    parser.add_argument("--inbox", type=Path, default=DEFAULT_INBOX, help="Iris inbox directory for human reminders")
    return parser.parse_args()


def parse_day(value: str) -> date:
    return datetime.strptime(value[:10], "%Y-%m-%d").date()


def load_ledger(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        ledger = json.load(handle)
    if not isinstance(ledger, list):
        raise ValueError("ledger.json must be an array")
    return ledger


def save_ledger(path: Path, ledger: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def is_due(card: dict[str, Any], today: date) -> bool:
    if card.get("status") != "aging":
        return False
    deadline = parse_day(str(card.get("deadline", "")))
    return deadline < today


def import_yfinance():
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:
        raise RuntimeError("yfinance is required for machine settlement: python -m pip install yfinance") from exc
    return yf


def close_series(data: Any, symbol: str) -> Any:
    columns = getattr(data, "columns", None)
    if columns is None:
        raise ValueError(f"no columns returned for {symbol}")

    if getattr(columns, "nlevels", 1) > 1:
        level_zero = list(columns.get_level_values(0))
        level_one = list(columns.get_level_values(1))
        if symbol in level_zero:
            frame = data[symbol]
        elif symbol in level_one:
            frame = data.xs(symbol, axis=1, level=1)
        else:
            raise ValueError(f"missing yfinance data for {symbol}")
        if "Close" in frame:
            return frame["Close"]
        if "Adj Close" in frame:
            return frame["Adj Close"]
        raise ValueError(f"missing close column for {symbol}")

    if "Close" in data:
        return data["Close"]
    if "Adj Close" in data:
        return data["Adj Close"]
    raise ValueError(f"missing close column for {symbol}")


def endpoint(series: Any) -> tuple[str, float, str, float]:
    clean = series.dropna()
    if clean.empty:
        raise ValueError("no non-empty close prices in selected window")
    start_index = clean.index[0]
    end_index = clean.index[-1]
    return (
        str(start_index.date()),
        float(clean.iloc[0]),
        str(end_index.date()),
        float(clean.iloc[-1]),
    )


def fetch_price_points(symbols: list[str], start: date, end: date) -> dict[str, PricePoint]:
    yf = import_yfinance()
    unique_symbols = list(dict.fromkeys(symbols))
    raw = yf.download(
        unique_symbols,
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        auto_adjust=True,
        progress=False,
        group_by="ticker",
        threads=False,
    )
    if raw.empty:
        raise ValueError("yfinance returned no rows")

    points: dict[str, PricePoint] = {}
    for symbol in unique_symbols:
        start_date, start_close, end_date, end_close = endpoint(close_series(raw, symbol))
        points[symbol] = PricePoint(
            symbol=symbol,
            start_date=start_date,
            start_close=start_close,
            end_date=end_date,
            end_close=end_close,
        )
    return points


def compare(value: float, operator: str, threshold: float, upper: float | None = None) -> bool:
    if operator == "gt":
        return value > threshold
    if operator == "gte":
        return value >= threshold
    if operator == "lt":
        return value < threshold
    if operator == "lte":
        return value <= threshold
    if operator == "between":
        if upper is None:
            raise ValueError("between operator requires threshold_upper")
        return threshold <= value <= upper
    raise ValueError(f"unsupported operator: {operator}")


def pct(value: float) -> str:
    return f"{value * 100.0:.2f}%"


def settle_machine(card: dict[str, Any], today: date) -> dict[str, Any]:
    criterion = card.get("criterion") or {}
    rule = criterion.get("machine_rule") or {}
    if not isinstance(rule, dict):
        raise ValueError(f"{card.get('card_id')} missing criterion.machine_rule")

    metric = str(rule.get("metric") or "")
    subject_symbol = str(rule.get("subject_symbol") or "")
    benchmark_symbol = str(rule.get("benchmark_symbol") or "")
    operator = str(rule.get("operator") or "gte")
    start = parse_day(str(rule.get("observation_start") or card.get("committed_at") or ""))
    end = parse_day(str(card.get("deadline")))
    symbols = [symbol for symbol in [subject_symbol, benchmark_symbol, *BENCHMARK_SYMBOLS] if symbol]
    if not subject_symbol:
        raise ValueError(f"{card.get('card_id')} missing machine_rule.subject_symbol")

    points = fetch_price_points(symbols, start, end)
    subject = points[subject_symbol]
    threshold = float(rule.get("threshold_pct", rule.get("threshold_value", 0.0)))
    upper = rule.get("threshold_upper")
    upper_float = float(upper) if upper is not None else None

    if metric == "relative_return":
        if not benchmark_symbol:
            raise ValueError(f"{card.get('card_id')} missing machine_rule.benchmark_symbol")
        benchmark = points[benchmark_symbol]
        measured_value = (subject.return_pct - benchmark.return_pct) / 100.0
        unit = "relative_return"
        evidence = (
            f"{subject_symbol} 報酬 {subject.return_pct:.2f}%，"
            f"{benchmark_symbol} 報酬 {benchmark.return_pct:.2f}%，差額 {pct(measured_value)}。"
        )
    elif metric == "absolute_return":
        measured_value = subject.return_pct / 100.0
        unit = "absolute_return"
        evidence = f"{subject_symbol} 區間報酬 {subject.return_pct:.2f}%。"
    elif metric == "level":
        measured_value = subject.end_close
        unit = "level"
        evidence = f"{subject_symbol} deadline 收盤值 {measured_value:.4f}。"
    else:
        raise ValueError(f"unsupported metric: {metric}")

    hit = compare(measured_value, operator, threshold, upper_float)
    outcome = "hit" if hit else "miss"
    card["status"] = outcome
    card["replay_ready_at"] = (today + timedelta(days=90)).isoformat()
    card["verdict"] = {
        "settled_at": today.isoformat(),
        "judge_mode": "machine",
        "outcome": outcome,
        "summary": f"機器判定：{'命中' if hit else '證偽'}。{evidence}",
        "rule": {
            "metric": metric,
            "operator": operator,
            "threshold": threshold,
            "threshold_upper": upper_float,
            "unit": unit,
        },
        "l2_benchmark": {
            symbol: points[symbol].to_json()
            for symbol in BENCHMARK_SYMBOLS
            if symbol in points
        },
        "source_snapshots": [points[symbol].to_json() for symbol in points],
    }
    return card


def write_human_reminder(card: dict[str, Any], inbox: Path, today: date) -> bool:
    inbox.mkdir(parents=True, exist_ok=True)
    card_id = str(card.get("card_id"))
    reminder_path = inbox / f"ledger_{card_id}_{card.get('deadline')}.md"
    if reminder_path.exists():
        return False

    criterion = card.get("criterion") or {}
    lines = [
        f"# Ledger human settlement needed: {card_id}",
        "",
        f"- due_checked_at: {today.isoformat()}",
        f"- title: {card.get('title')}",
        f"- deadline: {card.get('deadline')}",
        f"- claim_type: {card.get('claim_type')}",
        f"- judge_mode: {card.get('judge_mode')}",
        "",
        "## Claim",
        "",
        str(card.get("claim")),
        "",
        "## Locked Criterion",
        "",
        f"- 指標: {criterion.get('indicator')}",
        f"- 門檻: {criterion.get('threshold')}",
        f"- 期限: {criterion.get('deadline')}",
        f"- 基準: {criterion.get('benchmark')}",
        f"- 資料源: {criterion.get('data_source')}",
        "",
        "請 Charles 依公證判準裁決 hit / miss / undecidable，並附裁決理由全文；原 verdict 不得覆寫。",
    ]
    reminder_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True


def main() -> int:
    args = parse_args()
    today = parse_day(args.today) if args.today else date.today()
    ledger = load_ledger(args.ledger)
    changed = False
    machine_settled = 0
    human_reminded = 0
    errors: list[str] = []

    for card in ledger:
        try:
            if not is_due(card, today):
                continue
        except ValueError as exc:
            errors.append(f"{card.get('card_id', 'unknown')}: invalid deadline: {exc}")
            continue

        if card.get("judge_mode") == "machine":
            try:
                settle_machine(card, today)
                machine_settled += 1
                changed = True
            except Exception as exc:  # yfinance/network/data errors should surface to cron.
                errors.append(f"{card.get('card_id')}: machine settlement failed: {exc}")
        elif card.get("judge_mode") == "human":
            if write_human_reminder(card, args.inbox, today):
                human_reminded += 1
        else:
            errors.append(f"{card.get('card_id')}: unsupported judge_mode={card.get('judge_mode')}")

    if changed:
        save_ledger(args.ledger, ledger)

    print(f"ledger_settle: machine_settled={machine_settled} human_reminded={human_reminded} changed={changed}")
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
