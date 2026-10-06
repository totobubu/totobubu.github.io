"""Promote provisional issuer announcements once their actual ex-date close exists."""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / 'public' / 'data'


def main():
    updated = 0
    for path in DATA_DIR.rglob('*.json'):
        data = json.loads(path.read_text(encoding='utf-8'))
        changed = False
        for row in data.get('backtestData', []):
            if row.get('priceStatus') != 'provisional':
                continue
            close = row.get('close')
            if not isinstance(close, (int, float)) or close <= 0:
                continue
            row['priceStatus'] = 'confirmed'
            row['confirmedClose'] = close
            row['confirmedAt'] = datetime.now(timezone.utc).isoformat()
            changed = True
        if changed:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')
            updated += 1
    print(f'Reconciled {updated} announced distribution file(s)')


if __name__ == '__main__':
    main()
