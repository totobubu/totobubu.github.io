#!/usr/bin/env python
"""
로컬 환경에서 신규 티커를 온보딩하기 위한 one-stop 스크립트.

사용 예:
    python scripts/add_new_symbols.py --symbol YMAX
    python scripts/add_new_symbols.py --symbol voo --symbol qqq

주요 단계:
    1. fetch_missing_isin.py 로직을 재사용해 ISIN/심볼 정규화
       (실패 시 터미널에서 수동 입력 가능)
    2. fetch_market_from_google_finance.js를 사용하여 정확한 거래소 정보 조회
       (기존 감지 실패 시 Google Finance에서 자동 조회)
    3. Yahoo Finance chart API를 활용해 IPO 일자를 조회
       (tasks/addIpoDatesToNav.js와 동일한 방식)
    4. 해당 market 폴더의 nav 소스 파일에 심볼/ipoDate 반영
    5. public/data/<market>/<symbol>.json 스켈레톤 생성 및 기본 메타데이터 저장
    6. update_info_data.yml과 동일한 순서의 워크플로우를 로컬에서 실행

Windows PowerShell, macOS/Linux 쉘 모두 지원.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

# 기존 스크립트 재사용
try:
    # 실행 경로가 프로젝트 루트가 아닐 수 있으므로 scripts 디렉터리를 우선 추가
    CURRENT_DIR = Path(__file__).resolve().parent
    if str(CURRENT_DIR) not in sys.path:
        sys.path.insert(0, str(CURRENT_DIR))
    from fetch_missing_isin import (  # type: ignore
        FetchError,
        fetch_isin,
        symbol_to_slug,
        determine_market_from_symbol,
    )
except ImportError as exc:  # pragma: no cover - 환경 문제
    raise SystemExit(f"fetch_missing_isin.py 로직을 불러오지 못했습니다: {exc}") from exc

ROOT_DIR = Path(__file__).resolve().parents[2]  # scripts/utils/ -> scripts/ -> 프로젝트 루트
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from scripts.utils import save_json_file  # 프로젝트 공용 유틸
PUBLIC_DIR = ROOT_DIR / "public"
DATA_DIR = PUBLIC_DIR / "data"
NAV_DIR = PUBLIC_DIR / "nav"
PYTHON = sys.executable

MARKET_CHOICES = ("NASDAQ", "NYSE", "NYSEARCA", "BATS", "AMEX", "KOSPI", "KOSDAQ", "KONEX")
MARKET_TO_CURRENCY = {
    "NASDAQ": "USD",
    "NYSE": "USD",
    "NYSEARCA": "USD",
    "BATS": "USD",
    "AMEX": "USD",
    "KOSPI": "KRW",
    "KOSDAQ": "KRW",
    "KONEX": "KRW",
}

# 거래소 → 디렉토리 매핑
MARKET_TO_DIR = {
    "NASDAQ": "nasdaq",
    "NYSE": "nyse",
    "NYSEARCA": "nysearca",
    "BATS": "bats",
    "AMEX": "amex",
    "KOSPI": "kospi",
    "KOSDAQ": "kosdaq",
    "KONEX": "konex",
}

YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/119.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


class WorkflowError(RuntimeError):
    """Raised when a required step fails."""


def nav_filename_for_symbol(symbol: str) -> str:
    if not symbol:
        return "unknown.json"
    first_char = symbol[0].lower()
    if first_char.isalnum():
        return f"{first_char}.json"
    return "unknown.json"


def sanitize_symbol(symbol: str) -> str:
    return symbol.upper().strip()


def prompt_user(prompt: str, default: Optional[str] = None) -> str:
    if not sys.stdin.isatty():
        raise WorkflowError(f"{prompt} 값을 자동으로 얻지 못했고 터미널 입력이 불가능합니다.")

    suffix = f" (default: {default})" if default else ""
    while True:
        value = input(f"{prompt}{suffix}: ").strip()
        if value:
            return value
        if default:
            return default
        print("값을 입력해주세요.")


def prompt_market(symbol: str) -> str:
    print(f"[INPUT] {symbol}의 상장 시장을 선택하세요: {', '.join(MARKET_CHOICES)}")
    while True:
        user_value = prompt_user("Market").upper()
        if user_value in MARKET_CHOICES:
            return user_value
        print(f"지원되지 않는 시장입니다. ({', '.join(MARKET_CHOICES)})")


def prompt_isin(symbol: str) -> str:
    while True:
        candidate = prompt_user(f"{symbol} ISIN (예: US0000000001)").upper()
        if len(candidate) == 12 and candidate.isalnum():
            return candidate
        print("ISIN은 12자리 영숫자입니다. 다시 입력해주세요.")


def fetch_isin_with_fallback(symbol: str) -> Tuple[str, str]:
    try:
        return fetch_isin(symbol)
    except FetchError as exc:
        print(f"[WARN] 자동 ISIN 조회 실패: {exc}")
        manual_symbol = prompt_user(
            "수동으로 입력할 심볼 (엔터 시 기존 심볼 유지)", default=symbol
        ).upper()
        manual_isin = prompt_isin(manual_symbol)
        return manual_isin, manual_symbol


def fetch_ipo_date(symbol: str) -> str:
    now_ts = int(time.time())
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{symbol.upper()}?period1=0&period2={now_ts}&interval=1d&events=history"
    )
    try:
        response = requests.get(url, headers=YF_HEADERS, timeout=15)
        response.raise_for_status()
        payload = response.json()
        result = (payload.get("chart") or {}).get("result") or []
        meta = result[0].get("meta") if result else {}
        first_trade = meta.get("firstTradeDate")
        if first_trade:
            iso = datetime.fromtimestamp(first_trade, tz=timezone.utc).date().isoformat()
            return iso
        raise ValueError("firstTradeDate 필드를 찾을 수 없음")
    except Exception as exc:  # pylint: disable=broad-except
        print(f"[WARN] Yahoo Finance IPO 조회 실패 ({exc})")
        manual_date = prompt_user("수동 IPO 일자 (YYYY-MM-DD)")
        return manual_date


def ensure_nav_entry(symbol: str, market: str, ipo_date: Optional[str]) -> Path:
    # MARKET_TO_DIR를 사용하여 디렉토리 이름 결정
    market_dir_name = MARKET_TO_DIR.get(market, market.lower())
    market_dir = NAV_DIR / market_dir_name
    market_dir.mkdir(parents=True, exist_ok=True)
    nav_path = market_dir / nav_filename_for_symbol(symbol)

    try:
        with nav_path.open(encoding="utf-8") as fp:
            entries = json.load(fp)
            if not isinstance(entries, list):
                entries = []
    except FileNotFoundError:
        entries = []
    except json.JSONDecodeError:
        entries = []

    # 한국 티커의 경우 yfSymbol 자동 설정
    base_symbol = symbol
    yf_symbol = symbol
    if market in ("KOSPI", "KOSDAQ", "KONEX"):
        # symbol에 접미사가 있으면 분리
        if "." in symbol:
            base_symbol = symbol.rsplit(".", 1)[0]
            yf_symbol = symbol  # 접미사 포함된 symbol을 yfSymbol로 사용
        else:
            # symbol에 접미사가 없으면 market에 따라 추가
            suffix = ".KS" if market == "KOSPI" else ".KQ"
            yf_symbol = f"{symbol}{suffix}"

    updated = False
    for entry in entries:
        if entry.get("symbol") == base_symbol or entry.get("symbol") == symbol:
            if ipo_date and entry.get("ipoDate") != ipo_date:
                entry["ipoDate"] = ipo_date
                updated = True
            # yfSymbol 설정
            if market in ("KOSPI", "KOSDAQ", "KONEX") and entry.get("yfSymbol") != yf_symbol:
                entry["yfSymbol"] = yf_symbol
                updated = True
            break
    else:
        new_entry = {"symbol": base_symbol, "market": market}
        if market in ("KOSPI", "KOSDAQ", "KONEX"):
            new_entry["yfSymbol"] = yf_symbol
        if ipo_date:
            new_entry["ipoDate"] = ipo_date
        entries.append(new_entry)
        updated = True

    if updated:
        entries.sort(key=lambda item: item.get("symbol", ""))
        save_json_file(str(nav_path), entries, indent=4)
        print(f"[UPDATE] nav entry 저장: {nav_path.relative_to(ROOT_DIR)}")
    else:
        print(f"[SKIP] nav entry 변경 없음: {nav_path.relative_to(ROOT_DIR)}")

    return nav_path


def ensure_data_file(
    symbol: str,
    market: str,
    currency: Optional[str],
    isin: str,
) -> Path:
    slug = symbol_to_slug(symbol)
    # market 디렉토리 사용
    market_dir = MARKET_TO_DIR.get(market, market.lower())
    market_data_dir = DATA_DIR / market_dir
    market_data_dir.mkdir(parents=True, exist_ok=True)
    data_path = market_data_dir / f"{slug}.json"

    if data_path.exists():
        try:
            with data_path.open(encoding="utf-8") as fp:
                payload = json.load(fp)
        except json.JSONDecodeError:
            payload = {}
    else:
        payload = {}

    ticker_info = payload.setdefault("tickerInfo", {})
    ticker_info["Symbol"] = symbol
    ticker_info["isin"] = isin
    ticker_info["market"] = market
    if currency:
        ticker_info["currency"] = currency
    ticker_info["Update"] = datetime.now(timezone(timedelta(hours=9))).strftime(
        "%Y-%m-%d %H:%M:%S KST"
    )
    payload.setdefault("backtestData", [])

    save_json_file(str(data_path), payload, indent=4)
    print(f"[UPDATE] data 파일 저장: {data_path.relative_to(ROOT_DIR)}")
    return data_path


def fetch_market_from_google_finance(symbol: str) -> Optional[str]:
    """Google Finance에서 거래소 정보를 가져옵니다."""
    script_path = ROOT_DIR / "scripts" / "utils" / "fetch_market_from_google_finance.js"
    if not script_path.exists():
        print(f"[WARN] fetch_market_from_google_finance.js를 찾을 수 없습니다: {script_path}")
        return None
    
    node_exe = resolve_executable("node")
    try:
        # --query-only 모드 사용 (nav.json 업데이트 없이 마켓 정보만 조회)
        result = subprocess.run(
            [node_exe, str(script_path), "--query-only", symbol.upper()],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            timeout=60,
        )
        
        if result.returncode != 0:
            print(f"[WARN] Google Finance 마켓 조회 실패: {result.stderr}")
            return None
        
        # 출력에서 거래소 정보 추출
        # 예: "[AAPW] 거래소: BATS"
        output = result.stdout
        for line in output.split("\n"):
            # "[SYMBOL] 거래소:" 패턴 찾기
            if f"[{symbol.upper()}]" in line and "거래소:" in line:
                # "거래소: BATS" 패턴
                if ":" in line:
                    parts = line.split("거래소:")[-1].strip()
                    # 알파벳만 추출 (BATS, NASDAQ 등)
                    market = "".join(c for c in parts if c.isalpha()).upper()
                    if market and len(market) >= 2:
                        return market
        
        return None
    except subprocess.TimeoutExpired:
        print(f"[WARN] Google Finance 마켓 조회 타임아웃")
        return None
    except Exception as exc:
        print(f"[WARN] Google Finance 마켓 조회 오류: {exc}")
        return None


def resolve_market(symbol: str, detected: Optional[str]) -> str:
    """마켓 정보를 결정합니다. Google Finance를 사용하여 정확한 거래소를 확인합니다."""
    # 1. 기존 감지된 마켓이 유효하면 사용
    if detected in MARKET_CHOICES:
        print(f"[INFO] 기존 감지 마켓 사용: {detected}")
        return detected
    
    # 2. Google Finance에서 거래소 정보 가져오기
    print(f"[INFO] Google Finance에서 {symbol}의 거래소 정보를 조회합니다...")
    google_market = fetch_market_from_google_finance(symbol)
    
    if google_market and google_market in MARKET_CHOICES:
        print(f"[INFO] Google Finance에서 거래소 확인: {google_market}")
        return google_market
    
    # 3. Google Finance에서 새로운 거래소가 발견된 경우
    if google_market:
        print(f"[INFO] 새로운 거래소 발견: {google_market}")
        # 사용자에게 확인
        print(f"[INPUT] {symbol}의 거래소로 '{google_market}'을 사용하시겠습니까?")
        response = prompt_user("사용 (y/n)", default="y").lower()
        if response == "y":
            # MARKET_CHOICES에 추가 (런타임에만)
            return google_market
    
    # 4. 수동 입력
    return prompt_market(symbol)


def resolve_executable(executable: str) -> str:
    system = platform.system().lower()
    if system.startswith("win"):
        if executable.lower() in {"npm", "npx", "node"}:
            return f"{executable}.cmd"
    return executable


def run_command(label: str, command: List[str], dry_run: bool = False) -> None:
    normalized = [resolve_executable(command[0]), *command[1:]]
    printable = shlex.join(normalized)
    print(f"\n-> {label}\n   $ {printable}")
    if dry_run:
        return
    result = subprocess.run(normalized, cwd=ROOT_DIR)  # noqa: S603
    if result.returncode != 0:
        raise WorkflowError(f"명령 실패: {label} (exit {result.returncode})")


def run_update_workflow(skip_format: bool) -> None:
    steps: List[Tuple[str, List[str]]] = [
        ("1. 환율 데이터 업데이트", ["node", "scripts/exchange/fetch_all_exchange_rates.js"]),
        ("2. IPO date/Upcoming 싱크", ["npm", "run", "add-ipo-dates"]),
        ("3. nav.json 재생성", ["npm", "run", "generate-nav"]),
        (
            "4. 정보성 데이터 파이프라인 (KR)",
            [PYTHON, "scripts/data_pipeline/info_data_pipeline_kr.py"],
        ),
        (
            "4-2. 정보성 데이터 파이프라인 (US)",
            [PYTHON, "scripts/data_pipeline/info_data_pipeline_us.py"],
        ),
        ("5. 배당 히스토리 보강", [PYTHON, "scripts/data_pipeline/scraper_dividend.py"]),
        ("6. 캘린더 이벤트 생성", ["npm", "run", "generate-calendar-events"]),
    ]

    if not skip_format:
        format_script = (
            ["npm", "run", "format:changed:win"]
            if platform.system().lower().startswith("win")
            else ["npm", "run", "format:changed"]
        )
        steps.append(("7. 변경 파일 포맷팅", format_script))

    print("\n" + "=" * 80)
    print("로컬 update_info_data 워크플로우 실행")
    print("=" * 80)
    for label, command in steps:
        run_command(label, command)
    print("\n✅ 워크플로우 완료")


def process_symbol(symbol: str) -> Dict[str, str]:
    normalized = sanitize_symbol(symbol)
    print("\n" + "=" * 60)
    print(f"신규 티커 처리: {normalized}")
    print("=" * 60)

    isin, resolved_symbol = fetch_isin_with_fallback(normalized)
    if resolved_symbol != normalized:
        print(f"[INFO] {normalized} → {resolved_symbol} 로 재매핑")

    detected_market = determine_market_from_symbol(resolved_symbol)
    market = resolve_market(resolved_symbol, detected_market)
    currency = MARKET_TO_CURRENCY.get(market)

    ipo_date = fetch_ipo_date(resolved_symbol)
    nav_path = ensure_nav_entry(resolved_symbol, market, ipo_date)
    data_path = ensure_data_file(resolved_symbol, market, currency, isin)

    return {
        "input_symbol": normalized,
        "resolved_symbol": resolved_symbol,
        "market": market,
        "isin": isin,
        "ipo_date": ipo_date,
        "nav_path": str(nav_path.relative_to(ROOT_DIR)),
        "data_path": str(data_path.relative_to(ROOT_DIR)),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="신규 심볼 온보딩 자동화 스크립트",
    )
    parser.add_argument(
        "--symbol",
        dest="symbols",
        action="append",
        required=True,
        help="처리할 심볼 (여러 번 지정 가능)",
    )
    parser.add_argument(
        "--skip-workflow",
        action="store_true",
        help="update_info_data 로컬 워크플로우 실행을 건너뜁니다.",
    )
    parser.add_argument(
        "--skip-format",
        action="store_true",
        help="최종 포맷팅 스텝만 건너뜁니다.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="명령 실행 없이 수행 계획만 출력합니다.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    os.chdir(ROOT_DIR)
    summaries: List[Dict[str, str]] = []

    for symbol in args.symbols:
        summaries.append(process_symbol(symbol))

    if args.dry_run:
        print("\n[DRY-RUN] 워크플로우는 실행되지 않았습니다.")
        return 0

    if not args.skip_workflow:
        run_update_workflow(skip_format=args.skip_format)
    else:
        print("\n[INFO] --skip-workflow 옵션으로 통합 워크플로우를 건너뜁니다.")

    print("\n요약")
    print("-" * 40)
    for item in summaries:
        print(
            f"{item['resolved_symbol']} "
            f"(시장: {item['market']}, ISIN: {item['isin']}, IPO: {item['ipo_date']})"
        )
        print(f"  - nav : {item['nav_path']}")
        print(f"  - data: {item['data_path']}")
    print("-" * 40)
    print("완료되었습니다.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except WorkflowError as exc:
        print(f"\n❌ 작업 중단: {exc}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n사용자 중단 (Ctrl+C)")
        sys.exit(1)

