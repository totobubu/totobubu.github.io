"""Record an issuer-announced distribution without fabricating an ex-date close."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAV_PATH = ROOT / 'public' / 'nav.json'


def find_data_path(symbol):
    nav = json.loads(NAV_PATH.read_text(encoding='utf-8')).get('nav', [])
    item = next((entry for entry in nav if entry.get('symbol', '').upper() == symbol), None)
    if not item or not item.get('dataPaths'):
        raise ValueError(f'No data path registered for {symbol}')
    return ROOT / 'public' / item['dataPaths'][0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--symbol', required=True)
    parser.add_argument('--ex-date', required=True)
    parser.add_argument('--amount', type=float, required=True)
    parser.add_argument('--announcement-date', required=True)
    parser.add_argument('--source-url', required=True)
    args = parser.parse_args()

    symbol = args.symbol.upper()
    path = find_data_path(symbol)
    data = json.loads(path.read_text(encoding='utf-8'))
    rows = data.get('backtestData', [])
    prior_prices = [
        row for row in rows
        if row.get('date', '') < args.ex_date and isinstance(row.get('close'), (int, float)) and row['close'] > 0
    ]
    if not prior_prices:
        raise ValueError(f'No prior closing price available for {symbol}')
    reference = max(prior_prices, key=lambda row: row['date'])

    event = next((row for row in rows if row.get('date') == args.ex_date), None)
    if event is None:
        event = {'date': args.ex_date}
        rows.append(event)
    event.pop('expected', None)
    event.update({
        'amountFixed': args.amount,
        'amountOriginal': args.amount,
        'officiallyAnnounced': True,
        'announcementDate': args.announcement_date,
        'announcementUrl': args.source_url,
        'priceStatus': 'provisional',
        'referenceCloseDate': reference['date'],
        'referenceClose': reference['close'],
        'recordedAt': datetime.now(timezone.utc).isoformat(),
    })
    data['backtestData'] = sorted(rows, key=lambda row: row.get('date', ''))
    path.write_text(json.dumps(data, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
    print(f'Recorded {symbol} {args.ex_date} at {args.amount} using {reference["date"]} close {reference["close"]}')


if __name__ == '__main__':
    main()
