import json

KOREAN_ETF_BRANDS = [
    "KODEX",
    "TIGER",
    "KBSTAR",
    "ACE",
    "ARIRANG",
    "HANARO",
    "SOL",
    "PLUS",
    "RISE",
    "TIMEFOLIO",
    "KOSEF",
    "KINDEX",
    "TRUE",
    "FOCUS",
    "SMART",
    "QV",
    "TREX",
    "HK ",
]


def load_nav_metadata(nav_path="public/nav.json"):
    try:
        with open(nav_path, "r", encoding="utf-8") as f:
            nav_data = json.load(f)
        items = nav_data.get("nav", [])
        return {item.get("symbol"): item for item in items if item.get("symbol")}
    except FileNotFoundError:
        print(f"Warning: nav metadata file not found at {nav_path}")
    except json.JSONDecodeError as e:
        print(f"Warning: Failed to parse nav metadata ({nav_path}): {e}")
    return {}


def is_etf(nav_item):
    if not nav_item:
        return False
    if nav_item.get("company") or nav_item.get("underlying"):
        return True
    ko_name = nav_item.get("koName", "")
    return any(ko_name.startswith(brand) for brand in KOREAN_ETF_BRANDS)


def normalize_symbol(symbol, nav_metadata):
    """
    심볼을 nav.json 기준 표준 심볼로 정규화합니다.
    - 그대로 존재하면 그대로 반환
    - .KS -> .KQ 전환 가능 시 치환
    """
    if not symbol:
        return symbol
    if symbol in nav_metadata:
        return symbol
    if symbol.endswith(".KS"):
        candidate = f"{symbol[:-3]}.KQ"
        if candidate in nav_metadata:
            return candidate
    return symbol

