"""Create a review queue of single-underlying ETF candidates from Yahoo data.

This script deliberately never edits nav.json or tickerInfo. A reviewer must
approve each candidate before it becomes public metadata or a rival-card set.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

ROOT = Path(__file__).resolve().parents[2]
NAV_PATH = ROOT / 'public' / 'nav.json'
DEFAULT_OUTPUT = ROOT / 'public' / 'data' / 'underlying-candidates.json'


def single_holding_candidate(symbol):
    try:
        holdings = yf.Ticker(symbol).funds_data.top_holdings
    except Exception as error:
        return {'symbol': symbol, 'status': 'unresolved', 'reason': str(error)}

    if holdings is None or holdings.empty or 'holdingPercent' not in holdings:
        return {'symbol': symbol, 'status': 'unresolved', 'reason': 'Yahoo top holdings unavailable'}

    weights = holdings['holdingPercent'].dropna().sort_values(ascending=False)
    if len(weights) != 1 or float(weights.iloc[0]) < 0.9:
        return {
            'symbol': symbol,
            'status': 'unresolved',
            'reason': 'No unambiguous single underlying holding',
        }
    return {
        'symbol': symbol,
        'candidateUnderlying': str(weights.index[0]).upper(),
        'holdingPercent': float(weights.iloc[0]),
        'status': 'pending_review',
        'source': 'Yahoo Finance funds_data.top_holdings',
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--symbol', action='append', default=[])
    args = parser.parse_args()

    nav = json.loads(NAV_PATH.read_text(encoding='utf-8')).get('nav', [])
    requested = {symbol.upper() for symbol in args.symbol}
    entries = [
        item for item in nav
        if item.get('symbol')
        and not item.get('upcoming')
        and item.get('company')
        and not item.get('underlying')
        and (not requested or item['symbol'].upper() in requested)
    ]
    candidates = [single_holding_candidate(item['symbol']) for item in entries]
    payload = {
        'schemaVersion': 1,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'reviewRequired': True,
        'candidates': candidates,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(candidates)} Yahoo underlying candidates to {args.output}')


if __name__ == '__main__':
    main()
