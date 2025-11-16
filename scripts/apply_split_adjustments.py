import json
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, getcontext, InvalidOperation
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"

getcontext().prec = 28
DECIMAL_QUANT = Decimal("0.000001")


def parse_ratio(ratio_str):
    if not ratio_str or ":" not in ratio_str:
        return None
    left, right = ratio_str.split(":", 1)
    try:
        left_val = Decimal(left.strip())
        right_val = Decimal(right.strip())
        if left_val == 0:
            return None
        return right_val / left_val
    except (InvalidOperation, ValueError):
        return None


def load_splits(ticker_info):
    splits = (
        ticker_info.get("events", {}).get("splits", [])
        if isinstance(ticker_info, dict)
        else []
    )
    parsed = []
    for split in splits:
        date_str = split.get("date")
        ratio = split.get("ratio")
        factor = parse_ratio(ratio)
        if not date_str or factor is None:
            continue
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            continue
        parsed.append(
            {
                "date": date_obj,
                "ratio": ratio,
                "factor": factor,
            }
        )
    return sorted(parsed, key=lambda item: item["date"])


def apply_splits(base_value, entry_date, splits):
    if base_value is None or entry_date is None or not splits:
        return base_value, []

    try:
        current = Decimal(str(base_value))
    except (InvalidOperation, ValueError):
        return base_value, []

    adjustments = []

    for split in splits:
        if entry_date >= split["date"]:
            continue
        factor = split["factor"]
        if factor is None or factor == 0:
            continue
        current /= factor
        adjustments.append(
            {
                "date": split["date"].isoformat(),
                "ratio": split["ratio"],
                "factor": float(factor),
            }
        )

    if not adjustments:
        return base_value, []

    quantized = current.quantize(DECIMAL_QUANT, rounding=ROUND_HALF_UP)
    if quantized == quantized.to_integral_value():
        adjusted_value = int(quantized)
    else:
        adjusted_value = float(quantized)

    return adjusted_value, adjustments


def adjust_field(entry, field_name, entry_date, splits):
    original_field = f"{field_name}Original"
    adjustments_field = f"{field_name}SplitAdjustments"

    if (
        entry.get(field_name) is None
        and entry.get(original_field) is None
        and entry.get(adjustments_field) is None
    ):
        return False

    base_value = entry.get(original_field, entry.get(field_name))
    if base_value is None:
        return False

    adjusted_value, adjustments = apply_splits(base_value, entry_date, splits)
    changed = False

    if adjustments:
        if original_field not in entry or entry[original_field] != base_value:
            entry[original_field] = base_value
            changed = True
        if entry.get(field_name) != adjusted_value:
            entry[field_name] = adjusted_value
            changed = True
        if entry.get(adjustments_field) != adjustments:
            entry[adjustments_field] = adjustments
            changed = True
    else:
        # No applicable splits; ensure metadata is removed and field reflects base value
        if entry.get(field_name) != base_value:
            entry[field_name] = base_value
            changed = True
        if original_field in entry:
            entry.pop(original_field, None)
            changed = True
        if adjustments_field in entry:
            entry.pop(adjustments_field, None)
            changed = True

    return changed


def process_file(json_path):
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)

    ticker_info = data.get("tickerInfo", {})
    splits = load_splits(ticker_info)
    if not splits:
        return False

    backtest = data.get("backtestData", [])
    file_changed = False

    for entry in backtest:
        date_str = entry.get("date")
        try:
            entry_date = (
                datetime.strptime(date_str, "%Y-%m-%d").date()
                if date_str
                else None
            )
        except ValueError:
            entry_date = None

        field_changed = False
        field_changed |= adjust_field(entry, "amount", entry_date, splits)
        field_changed |= adjust_field(entry, "amountFixed", entry_date, splits)

        if field_changed:
            file_changed = True

    if file_changed:
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

    return file_changed


def iter_market_files():
    if not DATA_DIR.exists():
        return []
    for market_dir in DATA_DIR.iterdir():
        if not market_dir.is_dir():
            continue
        for json_path in market_dir.glob("*.json"):
            yield json_path


def main():
    updated_files = 0
    for json_path in iter_market_files():
        if process_file(json_path):
            updated_files += 1
            print(f"[updated] {json_path.relative_to(BASE_DIR)}")
    print(f"완료: {updated_files}개 파일 업데이트")


if __name__ == "__main__":
    main()

