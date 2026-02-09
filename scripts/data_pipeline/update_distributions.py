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
    OCR_CORRECTIONS = {
        'COsSWw': 'COSW',
        'GOOWw': 'GOOW',
        'COSSW': 'COSW',
        'GOOWW': 'GOOW',
    }

    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        for line in lines:
            line = line.strip()
            if not line: continue
            
            # Pre-cleanup keys using OCR corrections
            for bad, good in self.OCR_CORRECTIONS.items():
                if bad in line:
                    line = line.replace(bad, good)

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
    # OCR often misreads YieldMax tickers
    # Map: OCR_result → Actual_ticker (case-insensitive)
    OCR_CORRECTIONS = {
        # Direct mappings based on analysis of ocr_output.txt
        'APNY': 'ABNY', 'APNY_': 'ABNY',
        'ALYY': 'AIYY', 'ALYY': 'AIYY', 'AIVY': 'AIYY',
        'ANIPY': 'AMDY',
        'ANAZY': 'AMZY', 'ANAZY,': 'AMZY',
        'APTY': 'APLY',  # Correction: APLY (Apple), not QDTY
        'PASO': 'BABO', 'PASO,': 'BABO',
        'SAKE': 'BRKY',
        'CONY': 'CONY',
        'CRCO': 'CRCO', 'CRCO_': 'CRCO',
        'CRS': 'CRSH', 'CRS,': 'CRSH', # Short TSLA
        'EVNY': 'CVNY',
        'PS': 'DIPS', # Short NVDA
        'DISO': 'DISO',
        'PRAY': 'DRAY',
        'GAY': 'FBYY',
        'PAR': 'FIAT', # Short COIN
        'EPXY': 'GDXY',
        'EMEY': 'GMEY',
        'COOY': 'GOOY',
        'RVY': 'HIYY', 'RVY_': 'HIYY',
        'HOOY': 'HOOY',
        'JPMO': 'JPMO',
        'MANO': 'MARO',
        'MARNY': 'MRNY', 'MARNY,': 'MRNY',
        'MSRO': 'MSFO',
        'MUSTY': 'MSTY', 'MUSTY:': 'MSTY',
        'NEVY': 'NFLY',
        'NVPY': 'NVDY',
        'ARK': 'OARK',
        'PLTY': 'PLTY',
        'PYPY': 'PYPY',
        'PRETY': 'RBLY',
        'AOVY': 'RDYY', 'AOVY:': 'RDYY',
        'SMCY': 'SMCY', 'SMCY_': 'SMCY',
        'SNOY': 'SNOY', 'SNOY:': 'SNOY',
        'RSTY': 'TSLY', 'RSTY,': 'TSLY',
        'TSMY': 'TSMY',
        'WWTR': 'WNTR', # Short MSTR
        'XOMO': 'XOMO',
        'XYZY': 'XYZY',
        'YAR': 'YBIT',
        'YAAA': 'YQQQ', # Short N100
        
        # Existing/Generic corrections just in case
        'GAPY': 'CHPY',
        'PEAR': 'FEAT',
        'PIVY': 'FIVY',
        'ELEMAX': 'FIVY',  # OCR sometimes reads "pivy_" as "eleMax"
        'UPCY': 'LFGY',
        'SIRE': 'SLTY',
        'SUTY': 'SLTY',
        'WIRY': 'ULTY',
        'UTY': 'ULTY',
        'YMAG': 'YMAG',  # Sometimes correct
        'LDMAX': 'YMAG',  # OCR sometimes reads "ymag_" as "ldMax"
        'YELEIAN': 'LFGY',
        'YIN': 'YMAX',
        'VI': 'YMAX',
        'GPTY': 'GPTY',  # Sometimes correct
        'RDTY': 'RDTY',  # Sometimes correct
        'SDTY': 'SDTY',  # Sometimes correct
    }
    
    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        for line in lines:
            clean_line = line.strip()
            if not clean_line: continue

            # Strategy 1: Look for first token that looks like a garbled ticker
            # YieldMax lines in OCR often start with the ticker then a Separator like | or [
            # Example: "apny_ |'eldMax..."
            
            parts = clean_line.split()
            valid_ticker = None
            
            if parts:
                first_token = parts[0].upper().replace('_', '').replace(',', '').replace(':', '')
                
                # Check if first token is a mapped ticker
                if first_token in self.OCR_CORRECTIONS:
                    valid_ticker = self.OCR_CORRECTIONS[first_token]
                # Check if first token is a valid ticker (2-5 chars)
                elif 2 <= len(first_token) <= 5 and first_token.isalpha():
                    # Check if it's one of the known tickers that doesn't need mapping
                    candidate = first_token
                    if candidate not in ["YIELD", "ETF", "THE", "AND", "FOR", "SEE", "DATE"]:
                        valid_ticker = candidate

            # Fallback: Searching regex in the whole line if the first token check failed
            if not valid_ticker:
                ticker_matches = re.findall(r'\b([A-Za-z]{2,8})\b', clean_line)
                for ticker in ticker_matches:
                    ticker_upper = ticker.upper()
                    if ticker_upper in self.OCR_CORRECTIONS:
                        valid_ticker = self.OCR_CORRECTIONS[ticker_upper]
                        break
                    
                    if ticker_upper in ["YIELDMAX", "ETF", "TICKER", "FUND", "DATE", "VAL", "TEST", 
                                 "WEEKLY", "DAILY", "MONTHLY", "ROC", "SEC", "YIELD", "DAY",
                                 "DISTRIBUTION", "RATE", "PER", "SHARE", "FREQUENCY", "WELD",
                                 "MIAN", "MELD", "MAX", "DORSEY", "WRIGHT", "PORTFOLIO", "OPTION",
                                 "INCOME", "STRATEGY", "ODTE", "COVERED", "CALL", "ULTRA", "SHORT",
                                 "MAGNIFICENT", "UNIVERSE", "SEMICONDUCTOR", "TECH", "CRYPTO",
                                 "INDUSTRY", "NASDAQ", "FEATURED", "HYBRID", "NAME", "TIYORID",
                                 "CIYETO", "INCUSTY", "FECH", "ELDMAX", "SELDMAX", "TELDMAX",
                                 "YELDMEX", "COVET", "TECHY", "NASDIAD", "ORIG", "TE", "OD",
                                 "GAVEIED", "OE", "VELIE", "ULTA", "SHERE", "IHESINE", "MELDMEXT",
                                 "FUNDA", "OPTIC", "MERT", "ETFS", "AL", "HIYARID", "WEIGHT",
                                 "OF", "THE", "AND", "FOR", "SEE"]:
                        continue
                    
                    # If it looks like a valid ticker (3-5 chars), take it
                    if 3 <= len(ticker_upper) <= 5:
                         valid_ticker = ticker_upper
                         break

            if not valid_ticker:
                continue

            # Apply OCR correction (case-insensitive) just to be sure
            corrected_ticker = self.OCR_CORRECTIONS.get(valid_ticker, valid_ticker)

            # Look for distribution amount (prefer $0.xxxx format)
            amount_match = re.search(r'\$(\d+\.\d{4})', clean_line)
            candidate = None
            
            if amount_match:
                candidate = float(amount_match.group(1))
            else:
                # Fallback: Look for any decimal with 4+ digits
                matches = re.findall(r'(\d+\.\d+)', clean_line)
                
                # First pass: Look for exactly 4 decimals
                for m in matches:
                     if '.' in m:
                         decimals = m.split('.')[1]
                         if len(decimals) >= 3: # Relaxed to 3 for cases like 2.68% vs 0.221
                             val = float(m)
                             # Unpack "70.2389" -> "0.2389" if > 5.0 (likely OCR error)
                             if val > 5.0:
                                 if len(decimals) == 4:
                                     candidate = float(f"0.{decimals}")
                             elif val < 2.5: # Most distributions are small
                                 candidate = val
                                 break

            if candidate:
                results[corrected_ticker] = candidate

        return results

class RexParser(BaseParser):
    # OCR often misreads REX tickers as underlying stock symbols
    # Map: OCR_result → Actual_REX_ticker
    OCR_CORRECTIONS = {
        'NVDA': 'NVII',  # REX NVDA Growth & Income ETF
        'TSLA': 'TSII',  # REX TSLA Growth & Income ETF
        'MSTR': 'MSII',  # REX MSTR Growth & Income ETF
        'COIN': 'COII',  # REX COIN Growth & Income ETF
        'HOOD': 'HOII',  # REX HOOD Growth & Income ETF
        'HOON': 'HOII',  # OCR sometimes reads HOOD as "Hoon"
        'CRWY': 'CWII',  # REX CRWY Growth & Income ETF
        'PLTR': 'PLTI',  # REX PLTR Growth & Income ETF
        'LLY': 'LLII',   # REX LLY Growth & Income ETF
        'WMT': 'WMTI',   # REX WMT Growth & Income ETF
    }
    
    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue

            # Strategy 1: Image-based table format
            # Extract Fund Ticker and Distribution Per Share from table rows
            # Pattern: "REX TICKER ... $0.xxxx" or "REX TICKER ... 0.xxxx"
            
            # Find ALL tickers in the line (3-4 letters)
            ticker_matches = re.findall(r'\b([A-Z]{3,4})\b', line)
            if not ticker_matches:
                continue
            
            # Filter out header words and find the actual fund ticker
            # Prioritize tickers in OCR_CORRECTIONS or 4-letter tickers
            ticker = None
            for candidate in ticker_matches:
                # Skip common header words
                if candidate in ["DATE", "RATE", "FUND", "NAME", "RISK", "HIGH", "YIELD"]:
                    continue
                # Skip "REX" itself (the fund family name)
                if candidate == "REX":
                    continue
                # This is likely the actual ticker
                ticker = candidate
                break
            
            if not ticker:
                continue
            
            # Look for distribution amount on the same line
            # Try with $ first
            amt_match = re.search(r'\$(\d+\.\d+)', line)
            if not amt_match:
                # Fallback: decimal without $ (must have 4 decimals to avoid percentages)
                amt_match = re.search(r'\b(\d+\.\d{4})\b', line)
            
            if amt_match:
                amount = float(amt_match.group(1))
                
                # Fix OCR error: sometimes leading 0 is dropped (9.0491 → 0.0491)
                # If amount > 5.0 and has 4 decimals, likely missing leading 0
                if amount > 5.0:
                    # Try replacing first digit with 0
                    amt_str = amt_match.group(1)
                    if '.' in amt_str:
                        # e.g., "9.0491" → "0.0491"
                        fixed_amt_str = '0' + amt_str[1:]
                        fixed_amount = float(fixed_amt_str)
                        if 0.001 <= fixed_amount <= 5.0:
                            amount = fixed_amount
                
                # Validate amount is in reasonable range for distributions
                if 0.001 <= amount <= 5.0:
                    # Apply OCR correction if needed
                    corrected_ticker = self.OCR_CORRECTIONS.get(ticker, ticker)
                    results[corrected_ticker] = amount
                    continue

            # Strategy 2: Text-based format (original logic)
            # REX Ticker Pattern: Line with only 4 uppercase letters
            # e.g. "NVII", "TSII". Avoids text lines.
            if re.match(r'^[A-Z]{4}$', line):
                ticker = line
                # Filter out potential false positives
                if ticker in ["DATE", "RATE", "YIELD"]:
                    continue

                # Look forward for price (e.g. "$0.2075")
                for offset in range(1, 5):
                    if i + offset >= len(lines): break
                    next_line = lines[i + offset].strip()
                    if not next_line: continue

                    # Match $0.xxxx
                    amt_match = re.match(r'^\$(\d+\.\d+)', next_line)
                    if amt_match:
                        results[ticker] = float(amt_match.group(1))
                        break
        return results


# Graniteshares Parser
class GranitesharesParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        for line in lines:
            line = line.strip()
            if not line: continue

            # Pattern: Ticker (first word) ... $Amount
            # Handle OCR noise: |OYY -> IOYY, _YieldBOOST -> YieldBOOST

            parts = line.split()
            if not parts: continue

            raw_ticker = parts[0]

            # Clean ticker
            clean_ticker = raw_ticker
            if '|' in clean_ticker:
                 clean_ticker = clean_ticker.replace('|', 'I')

            # Special case for QBy -> QBY
            if clean_ticker == 'QBy':
                clean_ticker = 'QBY'

            clean_ticker = clean_ticker.upper()

            # Filter: Must be 3-5 uppercase letters
            if not re.match(r'^[A-Z]{3,5}$', clean_ticker):
                continue

            # Look for $0.xxxx
            amount_match = re.search(r'\$(\d+\.\d+)', line)
            if amount_match:
                amount = float(amount_match.group(1))
                results[clean_ticker] = amount

        return results


# Defiance Parser
class DefianceParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split('\n')

        current_ticker = None

        for line in lines:
            line = line.strip()
            if not line: continue

            # 1. Look for Ticker (start of line or distinct)
            # Must be 3-5 chars.
            # Only consider if we are looking for a ticker or resetting?
            # Actually, standard heuristic:

            # Check for Ticker line
            # IWMY R2000 ...
            ticker_match = re.search(r'\b([A-Z]{3,5})\b', line)
            if ticker_match:
                candidate = ticker_match.group(1)
                if candidate not in ["FUND", "DATE", "RATE", "YIELD", "DIST", "NAV", "PAY", "REC", "TEST", "NET", "ASSET", "ROC"]:
                    current_ticker = candidate

            # 2. Look for Value with /share
            # $0.1184/share
            # The value might be on the same line or a subsequent line.

            val_match = re.search(r'\$?(\d+\.\d+)\s*/\s*share', line, re.IGNORECASE)
            if val_match and current_ticker:
                 amount = float(val_match.group(1))
                 results[current_ticker] = amount
                 # Reset ticker after finding amount to avoid misattribution
                 current_ticker = None
            elif not val_match and ticker_match:
                 # If we found a ticker but no value on this line, we keep current_ticker
                 # and hope next lines have the value.
                 pass

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
        elif "graniteshares" in img_path.name.lower():
            parser_type = GranitesharesParser
        elif "defiance" in img_path.name.lower():
            parser_type = DefianceParser
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
