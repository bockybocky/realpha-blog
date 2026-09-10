#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable


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
    parser.add_argument("--self-test", action="store_true", help="Run forecast settlement unit tests without network access")
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
    return deadline <= today


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


def fetch_deadline_close(symbol: str, deadline: date) -> tuple[str, float]:
    point = fetch_price_points([symbol], deadline - timedelta(days=10), deadline)[symbol]
    return point.end_date, point.end_close


def scenario_contains(scenario: dict[str, Any], close: float) -> bool:
    close_range = scenario.get("close_range") or {}
    lo = close_range.get("lo")
    hi = close_range.get("hi")
    return (lo is None or float(lo) < close) and (hi is None or close <= float(hi))


def forecast_brier(scenarios: list[dict[str, Any]], realized_id: str) -> float:
    score = 0.0
    for scenario in scenarios:
        probability = float(scenario.get("prob_pct")) / 100.0
        observed = 1.0 if str(scenario.get("id")) == realized_id else 0.0
        score += (probability - observed) ** 2
    return round(score, 3)


def cumulative_forecast_brier(ledger: list[dict[str, Any]]) -> tuple[float, int]:
    values: list[float] = []
    for card in ledger:
        if card.get("claim_type") != "forecast" or card.get("status") != "scored":
            continue
        verdict = card.get("verdict") or {}
        if isinstance(verdict, dict) and isinstance(verdict.get("brier"), (int, float)):
            values.append(float(verdict["brier"]))
    if not values:
        raise ValueError("no scored forecast Brier values found")
    return round(sum(values) / len(values), 3), len(values)


def display_number(value: float) -> str:
    return f"{value:.4f}".rstrip("0").rstrip(".")


def settle_forecast(
    card: dict[str, Any],
    today: date,
    ledger: list[dict[str, Any]],
    close_fetcher: Callable[[str, date], tuple[str, float]] = fetch_deadline_close,
) -> dict[str, Any]:
    criterion = card.get("criterion") or {}
    rule = criterion.get("machine_rule") or {}
    if not isinstance(rule, dict):
        raise ValueError(f"{card.get('card_id')} missing criterion.machine_rule")
    if rule.get("metric") != "scenario_partition":
        raise ValueError(f"{card.get('card_id')} forecast metric must be scenario_partition")

    symbol = str(rule.get("subject_symbol") or "")
    if not symbol:
        raise ValueError(f"{card.get('card_id')} missing machine_rule.subject_symbol")
    deadline = parse_day(str(card.get("deadline")))
    close_date, close = close_fetcher(symbol, deadline)
    scenarios = card.get("scenarios")
    if not isinstance(scenarios, list):
        raise ValueError(f"{card.get('card_id')} missing scenarios")

    realized = next((scenario for scenario in scenarios if scenario_contains(scenario, close)), None)
    if realized is None:
        card["status"] = "undecidable"
        card["verdict"] = {
            "settled_at": today.isoformat(),
            "judge_mode": "machine",
            "outcome": "undecidable",
            "summary": (
                f"機器無法裁決：{symbol} 於 {close_date} 收盤 {display_number(close)}，"
                "但沒有任何公證情境區間包含該收盤值，已轉交人工覆核。"
            ),
            "actual_close": close,
            "close_date": close_date,
        }
        return card

    realized_id = str(realized.get("id"))
    brier = forecast_brier(scenarios, realized_id)
    card["status"] = "scored"
    card["replay_ready_at"] = ""
    card["verdict"] = {
        "settled_at": today.isoformat(),
        "judge_mode": "machine",
        "outcome": "scored",
        "realized_scenario_id": realized_id,
        "realized_scenario_label": str(realized.get("label")),
        "actual_close": close,
        "close_date": close_date,
        "assigned_prob_pct": int(realized.get("prob_pct")),
        "brier": brier,
    }
    cumulative_average, cumulative_n = cumulative_forecast_brier(ledger)
    card["verdict"]["cumulative_brier_avg"] = cumulative_average
    card["verdict"]["cumulative_n"] = cumulative_n
    card["verdict"]["summary"] = (
        f"機器判定：實現情境「{realized.get('label')}」，{symbol} 於 {close_date} 收盤 "
        f"{display_number(close)}，當初賦予機率 {int(realized.get('prob_pct'))}%，"
        f"本卡 Brier {brier:.3f}。"
        f"全站 forecast 卡累積 Brier 平均 {cumulative_average:.3f}（n={cumulative_n}）。"
    )
    return card


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


def settle_machine(
    card: dict[str, Any],
    today: date,
    ledger: list[dict[str, Any]] | None = None,
    forecast_close_fetcher: Callable[[str, date], tuple[str, float]] = fetch_deadline_close,
) -> dict[str, Any]:
    if card.get("claim_type") == "forecast":
        return settle_forecast(card, today, ledger or [card], forecast_close_fetcher)

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
        (
            "請 Charles 覆核 forecast 情境分割與收盤資料，裁決後附理由全文；原 verdict 不得覆寫。"
            if card.get("claim_type") == "forecast"
            else "請 Charles 依公證判準裁決 hit / miss / undecidable，並附裁決理由全文；原 verdict 不得覆寫。"
        ),
    ]
    reminder_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True


def run_forecast_self_test() -> int:
    scenarios = [
        {"id": "s1", "label": "低檔", "prob_pct": 20, "close_range": {"lo": None, "hi": 100}, "narrative": "低檔情境"},
        {"id": "s2", "label": "中段", "prob_pct": 50, "close_range": {"lo": 100, "hi": 200}, "narrative": "中段情境"},
        {"id": "s3", "label": "高檔", "prob_pct": 30, "close_range": {"lo": 200, "hi": None}, "narrative": "高檔情境"},
    ]
    cases = [
        (50.0, "s1", 0.98),
        (100.0, "s1", 0.98),
        (150.0, "s2", 0.38),
        (200.0, "s2", 0.38),
        (250.0, "s3", 0.78),
    ]
    for index, (close, expected_id, expected_brier) in enumerate(cases, start=1):
        card = {
            "card_id": f"LJ-2099-{index:04d}",
            "claim_type": "forecast",
            "judge_mode": "machine",
            "deadline": "2099-12-18",
            "scenarios": scenarios,
            "criterion": {
                "machine_rule": {
                    "metric": "scenario_partition",
                    "subject_symbol": "^GSPC",
                    "observation": "weekly_close_on_deadline",
                }
            },
            "status": "aging",
            "verdict": "",
        }

        def mock_close(_symbol: str, _deadline: date, value: float = close) -> tuple[str, float]:
            return "2099-12-18", value

        settle_machine(card, date(2099, 12, 18), [card], mock_close)
        verdict = card.get("verdict") or {}
        actual_id = verdict.get("realized_scenario_id")
        actual_brier = verdict.get("brier")
        assert card.get("status") == "scored"
        assert actual_id == expected_id, (close, actual_id, expected_id)
        assert actual_brier == expected_brier, (close, actual_brier, expected_brier)
        assert verdict.get("cumulative_brier_avg") == expected_brier
        assert verdict.get("cumulative_n") == 1
        print(
            f"forecast_settlement: close={display_number(close)} "
            f"realized={actual_id} brier={actual_brier:.3f} passed"
        )
    print("forecast_settlement: all scenario and boundary cases passed")
    return 0


def main() -> int:
    args = parse_args()
    if args.self_test:
        return run_forecast_self_test()
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
                settle_machine(card, today, ledger)
                if card.get("status") == "undecidable":
                    if write_human_reminder(card, args.inbox, today):
                        human_reminded += 1
                else:
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
