# scripts\scraper_dividend.py
import json
from datetime import datetime, timedelta
from utils import load_json_file, save_json_file, sanitize_ticker_for_filename
from tqdm import tqdm


def calculate_yields(backtest_data):
    if not backtest_data:
        return []

    for item in backtest_data:
        try:
            item["date_obj"] = datetime.strptime(item["date"], "%Y-%m-%d")
        except (ValueError, KeyError):
            item["date_obj"] = None

    valid_data = sorted(
        [item for item in backtest_data if item["date_obj"] is not None],
        key=lambda x: x["date_obj"],
    )

    for i, current_item in enumerate(valid_data):
        price_raw = current_item.get("open") or current_item.get("close")

        # [핵심 수정] amountFixed 우선 사용
        dividend_raw = (
            current_item.get("amountFixed")
            if "amountFixed" in current_item
            else current_item.get("amount")
        )

        if price_raw and price_raw > 0 and dividend_raw is not None:
            one_year_before = current_item["date_obj"] - timedelta(days=365)

            dividends_in_past_year = sum(
                (
                    entry.get("amountFixed")
                    if "amountFixed" in entry
                    else entry.get("amount", 0)
                )
                for entry in valid_data[i::-1]
                if entry["date_obj"] >= one_year_before
                and (
                    entry.get("amount") is not None
                    or entry.get("amountFixed") is not None
                )
            )

            if dividends_in_past_year > 0:
                current_item["yield"] = dividends_in_past_year / price_raw

    for item in backtest_data:
        item.pop("date_obj", None)

    return backtest_data


def main():
    print("\n--- Calculating Yield for Backtest Data ---")
    files = [f for f in os.listdir("public/data") if f.endswith(".json")]
    updated_count = 0

    for filename in tqdm(files, desc="Calculating Yields"):
        file_path = os.path.join("public/data", filename)
        data = load_json_file(file_path)
        if not data or "backtestData" not in data:
            continue

        original_backtest_data_str = json.dumps(
            data.get("backtestData", []), sort_keys=True
        )

        # 배당 데이터가 있는 경우에만 배당률 계산 실행
        if any(
            item.get("amount") is not None or item.get("amountFixed") is not None
            for item in data["backtestData"]
        ):
            new_backtest_data = calculate_yields(data["backtestData"])
            new_backtest_data_str = json.dumps(new_backtest_data, sort_keys=True)

            if original_backtest_data_str != new_backtest_data_str:
                data["backtestData"] = new_backtest_data
                if save_json_file(file_path, data):
                    updated_count += 1

    print(f"\n--- Yield Calculation Finished. Total files updated: {updated_count} ---")


if __name__ == "__main__":
    main()
