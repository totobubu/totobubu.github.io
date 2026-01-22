import os
import re
import sys
import json
import glob
import subprocess
import pytesseract
from PIL import Image
from pathlib import Path

# Configuration
SCREENSHOT_DIR = Path("public/screenshot")
DATA_DIR = Path("public/data")

# Tesseract Setup
TESSERACT_CMD_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\User\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
]

def setup_tesseract():
    try:
        pytesseract.get_tesseract_version()
        return True
    except:
        pass
    for path in TESSERACT_CMD_PATHS:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            return True
    return False

# Base Parser
class BaseParser:
    def __init__(self, text, filename):
        self.text = text
        self.filename = filename

    def parse_date(self):
        match = re.search(r'(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})', self.filename)
        if match:
             return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

        match = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', self.text)
        if match:
             return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

        return None

    def extract_data(self):
        raise NotImplementedError

# RoundHill Parser
class RoundHillParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        for line in lines:
            line = line.strip()
            if not line: continue

            if "Expense Ratio" in line or "Fee" in line:
                continue

            match = re.findall(r'\b([A-Z]{3,5})\b', line)

            # Find float with at least 4 decimals
            amount_match = re.search(r'[\$]?(\d+\.\d{4,})', line)

            if match and amount_match:
                ticker = match[-1]
                amount = float(amount_match.group(1))

                if ticker not in ["FUND", "ETF", "NAV", "DATE"]:
                    results[ticker] = amount

        return results

# YieldMax Parser
class YieldMaxParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        for line in lines:
            clean_line = line.strip()
            if not clean_line: continue

            ticker_match = re.match(r'^\s*([A-Z]{3,5})\b', clean_line)
            if ticker_match:
                ticker = ticker_match.group(1)
                if ticker in ["YIELDMAX", "ETF", "TICKER", "FUND", "DATE", "VAL", "TEST"]:
                    if ticker != "TEST" and ticker != "MSST" and ticker != "NVIT":
                         if ticker in ["DATE", "VAL"]: continue

                matches = re.findall(r'(\d+\.\d+)', clean_line)
                candidate = None

                # First pass: Look for exactly 4 decimals
                for m in matches:
                     if '.' in m:
                         decimals = m.split('.')[1]
                         if len(decimals) >= 4:
                             val = float(m)
                             # Unpack "70.2389" -> "0.2389"
                             if val > 5.0:
                                 if len(decimals) == 4:
                                     candidate = float(f"0.{decimals}")
                             else:
                                 candidate = val
                             break

                # Second pass fallback for MSST (0.2157) if simple float
                if not candidate:
                     for m in matches:
                         val = float(m)
                         if 0.05 < val < 2.5:
                             candidate = val
                             break

                if candidate:
                    results[ticker] = candidate

        return results

class RexParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue

            # REX Ticker Pattern: Line with only 4 uppercase letters
            # e.g. "NVII", "TSII". Avoids text lines.
            if re.match(r'^[A-Z]{4}$', line):
                ticker = line
                # Filter out potential false positives if any occur (e.g. DATE)
                if ticker in ["DATE", "RATE", "YIELD"]:
                    continue

                # Look forward for price (e.g. "$0.2075")
                # Usually within 1-3 lines
                for offset in range(1, 5):
                    if i + offset >= len(lines): break
                    next_line = lines[i + offset].strip()
                    if not next_line: continue

                    # Match $0.xxxx
                    # REX text format: "$0.2075"
                    amt_match = re.match(r'^\$(\d+\.\d+)', next_line)
                    if amt_match:
                        results[ticker] = float(amt_match.group(1))
                        break
        return results

def find_json_path(ticker):
    pattern = str(DATA_DIR / "**" / f"{ticker.lower()}.json")
    matches = glob.glob(pattern, recursive=True)
    if matches:
        return Path(matches[0])
    return None

def update_json(path, date_str, amount):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        updated = False
        target_list = None

        if isinstance(data, list):
            target_list = data
        elif isinstance(data, dict):
            if 'backtestData' in data:
                target_list = data['backtestData']
            elif 'dividend_history' in data:
                target_list = data['dividend_history']
            elif 'dividends' in data:
                target_list = data['dividends']

        if target_list is None:
            return False

        for entry in target_list:
            if entry.get('date') == date_str:
                if entry.get('expected') == True:
                    del entry['expected']
                    entry['amountFixed'] = amount
                    updated = True
                    print(f"  [+] Updated {path.name}: {date_str} -> {amount}")
                elif 'amountFixed' in entry:
                     # Skip overwriting existing values
                     if abs(entry['amountFixed'] - amount) > 0.0001:
                         print(f"  [!] Skipped {path.name}: {date_str} has {entry['amountFixed']} (new: {amount})")

        if updated:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            # Format with Prettier
            try:
                subprocess.run(["npx", "prettier", "--write", str(path)], shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"  [+] Formatted {path.name} with Prettier")
            except Exception as fmt_err:
                print(f"  [!] formatting error on {path.name}: {fmt_err}")

            return True

    except Exception as e:
        print(f"  [!] Error reading/writing {path}: {e}")

    return False

def main():
    if not setup_tesseract():
        sys.exit(1)

    image_files = list(SCREENSHOT_DIR.glob("*.webp")) + list(SCREENSHOT_DIR.glob("*.jpg")) + list(SCREENSHOT_DIR.glob("*.png")) + list(SCREENSHOT_DIR.glob("*.txt"))

    for img_path in image_files:
        print(f"\nProcessing {img_path.name}...")
        if img_path.suffix.lower() == ".txt":
            with open(img_path, "r", encoding="utf-8") as f:
                text = f.read()
        else:
            text = pytesseract.image_to_string(Image.open(img_path))

        parser_type = None
        if "roundhill" in img_path.name.lower():
            parser_type = RoundHillParser
        elif "yieldmax" in img_path.name.lower():
            parser_type = YieldMaxParser
        elif "rex" in img_path.name.lower():
            parser_type = RexParser
        else:
            continue

        parser = parser_type(text, img_path.name)
        date_str = parser.parse_date()

        if not date_str: continue
        print(f"  Date: {date_str}")

        data_map = parser.extract_data()
        for ticker, amount in data_map.items():
            json_path = find_json_path(ticker)
            if json_path:
                update_json(json_path, date_str, amount)

if __name__ == "__main__":
    main()
