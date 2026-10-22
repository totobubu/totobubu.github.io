#!/usr/bin/env python3
import argparse
import os
import re
import sys
import json
import glob
import math
from decimal import Decimal
from datetime import date
import pytesseract
from PIL import Image
from pathlib import Path
from dataclasses import dataclass

# Configuration
SCREENSHOT_DIR = Path("public/screenshot")
DATA_DIR = Path("public/data")
OCR_DEBUG_PATH = Path("ocr_debug.txt")
SUPPORTED_EXTENSIONS = {".webp", ".jpg", ".jpeg", ".png", ".txt"}
PARSER_TYPES = {}

# OCR aliases are deliberately scoped to their issuer.  Do not turn this into a
# repository-wide ticker alias map: a short OCR token can be a valid symbol for
# a different issuer.
YIELDMAX_TICKER_REGISTRY = {
    "YQQQ": {"aliases": {"YEOQ", "YEQQ", "YAAA", "YAAQ", "YOQOO", "YOQQQ", "YQ0Q"}},
    "SDTY": {"aliases": {"SDTV", "SPTY"}},
    "YMAG": {"aliases": {"VMAG", "VM", "LDMAX"}},
    "HOOY": {"aliases": {"HOOYY"}},
    "NFLY": {"aliases": {"NEFLY"}},
    # Verified against the GDXY row in YieldMax_2026-10-22.png.
    "GDXY": {"aliases": {"GDXXY"}},
    "INYY": {"aliases": set()},
    "YSPC": {"aliases": set()},
    "YRAM": {"aliases": set()},
    "MUY": {"aliases": set()},
    "CVNY": {"aliases": {"CCVNY"}},
}

# These Target 12 rows are published together in this exact order.  The OCR
# fixture for 2026-10-07 loses both BIGY and RNTY ticker cells, so pairing by
# the documented table order is safer than guessing from the garbled token.
YIELDMAX_TARGET_12_MONTHLY_ORDER = ("BIGY", "RNTY", "SOXY")


def normalize_yieldmax_ticker(token):
    """Return a canonical YieldMax ticker for an unambiguous OCR token."""
    normalized = token.upper().strip()
    for ticker, details in YIELDMAX_TICKER_REGISTRY.items():
        if normalized == ticker or normalized in details["aliases"]:
            return ticker
    return None


@dataclass
class UpdateOutcome:
    ticker: str
    status: str
    detail: str
    amount: float | None = None
    source: str | None = None
    date: str | None = None
    raw_text: str | None = None


BLOCKING_REVIEW_STATUSES = {
    "extraction_failed",
    "data_error",
    "missing_registration",
    "missing_distribution_row",
    "ambiguous_mapping",
    "unknown_ocr_token",
    "conflicting_confirmed_amount",
}

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
        self.issues = []
        self.raw_rows = {}

    def parse_date(self):
        # Try YYYY-MM-DD
        match = re.search(r"(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})", self.filename)
        if match:
            return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

        # Try YY-MM-DD (assume 20xx)
        match = re.search(r"(\d{2})[-_.](\d{1,2})[-_.](\d{1,2})", self.filename)
        if match:
            return f"20{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

        match = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", self.text)
        if match:
            return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

        return None

    def extract_data(self):
        raise NotImplementedError


# RoundHill Parser
class RoundHillParser(BaseParser):
    OCR_CORRECTIONS = {
        "COsSWw": "COSW",
        "GOOWw": "GOOW",
        "COSSW": "COSW",
        "GOOWW": "GOOW",
        "COIw": "COIW",
        "GOOwWw": "GOOW",
    }

    def extract_data(self):
        results = {}
        lines = self.text.split("\n")

        # Strategy 1: Same-line format (Ticker and Amount on the same line)
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Pre-cleanup keys using OCR corrections
            for bad, good in self.OCR_CORRECTIONS.items():
                if bad in line:
                    line = line.replace(bad, good)

            if "Expense Ratio" in line or "Fee" in line:
                continue

            match = re.findall(r"\b([A-Z]{3,5})\b", line)

            # Find float with at least 4 decimals
            amount_match = re.search(r"[\$]?(\d+\.\d{4,})", line)

            if match and amount_match:
                ticker = match[-1]
                amount = float(amount_match.group(1))

                if ticker not in ["FUND", "ETF", "NAV", "DATE"]:
                    results[ticker] = amount

        # Strategy 2: Columnar format detection (Tickers in one block, Amounts in another)
        if not results:
            tickers_list = []
            amounts_list = []
            for line in lines:
                line = line.strip()
                if not line:
                    continue

                if "Expense Ratio" in line or "Fee" in line:
                    continue

                # Look for distribution amount (e.g., $0.158776 or 0.158776)
                # Must have at least 4 decimals to be a valid distribution amount
                amount_match = re.search(r"^\$?(\d+\.\d{4,})$", line)
                if amount_match:
                    amounts_list.append(float(amount_match.group(1)))
                    continue

                # Look for ticker (3-6 chars, allowing for some OCR noise)
                # Roundhill tickers are usually 4 uppercase chars.
                words = line.split()
                if words:
                    # Take the first token if it's short and looks like a ticker
                    token = words[0]
                    # Apply corrections first (e.g., GOOwWw -> GOOW)
                    corrected_token = self.OCR_CORRECTIONS.get(token, token)

                    # If it's a known correction, it's definitely a ticker
                    if corrected_token in self.OCR_CORRECTIONS.values():
                        tickers_list.append(corrected_token)
                        continue

                    # Otherwise, check if it looks like a valid ticker (all caps, 3-5 chars)
                    # or if it was a minor OCR mess (allow some lowercase if corrected or short)
                    if re.match(r"^[A-Za-z]{3,5}$", token):
                        ticker = token.upper()
                        # Final check against stopwords
                        if ticker not in [
                            "FUND",
                            "NAME",
                            "ETF",
                            "NAV",
                            "DATE",
                            "SHARE",
                            "PER",
                            "STOCK",
                            "MACRO",
                            "THE",
                            "THEIR",
                            "AND",
                            "FOR",
                        ]:
                            tickers_list.append(ticker)

            # Map by position if counts match
            if len(tickers_list) == len(amounts_list) and tickers_list:
                for i in range(len(tickers_list)):
                    results[tickers_list[i]] = amounts_list[i]

        return results


# YieldMax Parser
class YieldMaxParser(BaseParser):
    # Membership helps identify incomplete OCR rows. Order is never used
    # to assign amounts: issuer tables change as funds launch or move groups.
    KNOWN_TICKERS = [
        "AIYY",
        "AMDY",
        "AMZY",
        "APLY",
        "BABO",
        "BRKC",
        "CONY",
        "CRCO",
        "CRSH",
        "CVNY",
        "DIPS",
        "DRAY",
        "FBY",
        "FIAT",
        "GDXY",
        "GMEY",
        "GOOY",
        "HIYY",
        "HOOY",
        "INYY",
        "JPO",
        "MARO",
        "MRNY",
        "MSFO",
        "MSTY",
        "NFLY",
        "NVDY",
        "OARK",
        "PLTY",
        "PYPY",
        "RBLY",
        "RDYY",
        "SMCY",
        "SNOY",
        "TSLY",
        "TSMY",
        "WNTR",
        "XOMO",
        "XYZY",
        "YSPC",
        "YBIT",
        "YQQQ",
        "YRAM",
    ]

    # OCR often misreads YieldMax tickers
    # Map: OCR_result → Actual_ticker (case-insensitive)
    OCR_CORRECTIONS = {
        # Direct mappings based on analysis of ocr_output.txt
        "APNY": "ABNY",
        "APNY_": "ABNY",
        "ALYY": "AIYY",
        "AIVY": "AIYY",
        "seestegy": "AIYY",
        "AL": "AIYY",
        "ANIPY": "AMDY",
        "ANAZY": "AMZY",
        "ANAZY,": "AMZY",
        "APTY": "APLY",  # Correction: APLY (Apple), not QDTY
        "PASO": "BABO",
        "PASO,": "BABO",
        "SAKE": "BRKY",
        "CONY": "CONY",
        "CRCO": "CRCO",
        "CRCO_": "CRCO",
        "CRS": "CRSH",
        "CRS,": "CRSH",  # Short TSLA
        "EVNY": "CVNY",
        "PS": "DIPS",  # Short NVDA
        "DISO": "DISO",
        "PRAY": "DRAY",
        "GAY": "FBYY",
        "PAR": "FIAT",
        "EPXY": "GDXY",
        "EMEY": "GMEY",
        "COOY": "GOOY",
        "RVY": "HIYY",
        "RVY_": "HIYY",
        "HOOY": "HOOY",
        "JPMO": "JPO",
        "MANO": "MARO",
        "MARNY": "MRNY",
        "MARNY,": "MRNY",
        "MSRO": "MSFO",
        "MUSTY": "MSTY",
        "MUSTY:": "MSTY",
        "NEVY": "NFLY",
        "NVPY": "NVDY",
        "ARK": "OARK",
        "PLTY": "PLTY",
        "PYPY": "PYPY",
        "PRETY": "RBLY",
        "AOVY": "RDYY",
        "AOVY:": "RDYY",
        "SMCY": "SMCY",
        "SMCY_": "SMCY",
        "SNOY": "SNOY",
        "SNOY:": "SNOY",
        "RSTY": "TSLY",
        "RSTY,": "TSLY",
        "TSMY": "TSMY",
        "WWTR": "WNTR",
        "XOMO": "XOMO",
        "WPAY": "TOPW",
        "XYZY": "XYZY",
        "YAR": "YBIT",
        "YAAA": "YQQQ",
        # New corrections for 2026-02-11
        "CUPY": "CHPY",
        "RIVY": "FIVY",
        "GERY": "GPTY",
        "URAY": "LFGY",
        "OOTY": "QDTY",
        "SPTY": "SDTY",
        "SURY": "SLTY",
        "UM": "ULTY",
        # Existing/Generic corrections just in case
        "GAPY": "CHPY",
        "PEAR": "FEAT",
        "PIVY": "FIVY",
        "ELEMAX": "FIVY",
        "UPCY": "LFGY",
        "SIRE": "SLTY",
        "SUTY": "SLTY",
        "WIRY": "ULTY",
        "UTY": "ULTY",
        "YMAG": "YMAG",
        "LDMAX": "YMAG",
        "YELEIAN": "LFGY",
        "YIN": "YMAX",
        "VI": "YMAX",
        "GPTY": "GPTY",
        "RDTY": "RDTY",
        "SDTY": "SDTY",
        # New corrections for 2026-02-12
        "AY": "AIYY",
        "AMPY": "AMDY",
        "ANMZY": "AMZY",
        "APTY": "APLY",
        "SAKE": "BRKY",
        "CUNY": "CVNY",
        "PIPS": "DIPS",
        "PISO": "DISO",
        "piso": "DISO",
        "PRAY": "DRAY",
        "RAY": "FBY",
        "RAT": "FIAT",
        "GPXY": "GDXY",
        "AMEY": "GMEY",
        "SPMO": "JPO",
        "JPMO": "JPO",
        "NANG": "MARO",
        "MANY": "MRNY",
        "MSRO": "MSFO",
        "NETY": "NFLY",
        "NEFLY": "NFLY",
        "PURTY": "PLTY",
        "ROVY": "RDYY",
        "QS": "TSLY",
        "WWE": "WNTR",
        "XVZY": "XYZY",
        "YERT": "YBIT",
        "YAAQ": "YQQQ",
        "YEQQ": "YQQQ",
        "YEOQ": "YQQQ",
        "HOOYY": "HOOY",
        "SDTV": "SDTY",
        "VMAG": "YMAG",
        # Corrections for missing tickers (2026-02-12 debug)
        "8RKC": "BRKC",
        "BRKC": "BRKC",
        "sake": "BRKC",
        "0IPS": "DIPS",
        "OIPS": "DIPS",
        "DlPS": "DIPS",
        "pips": "DIPS",
        "6DXY": "GDXY",
        "CDXY": "GDXY",
        "@pxy": "GDXY",
        "M5FO": "MSFO",
        "M5TY": "MSTY",
        "misty": "MSTY",
        "NELY": "NFLY",
        "nety": "NFLY",
        # New garbled patterns from 2026-03-26 (Updated 2026-04-02)
        "ARR": "AIYY",
        "AIRR": "AIYY",
        "AMIDY": "AMDY",
        "AMIDY,": "AMDY",
        "ACNFRI": "AMZY",
        "AG": "APLY",
        "MARS": "BABO",
        "CERE": "BRKC",
        "cere": "BRKC",
        "CONN": "CONY",
        "CONN,": "CONY",
        "ERCO": "CRCO",
        "GRI": "CRSH",
        "DIS": "CVNY",
        "BRAY": "DIPS",
        "BRAY,": "DIPS",
        "ay": "DRAY",
        "FEY)": "FBY",
        "FEY": "FBY",
        "MEY": "FBY",
        "MEY,": "FBY",
        "BOOY)": "FIAT",
        "“IRR?": "GDXY",
        "NOOY": "GMEY",
        "nOoY": "GMEY",
        "IRO": "GOOY",
        "iro": "GOOY",
        "IRR?": "HIYY",
        "NOT": "HOOY",
        "MANY": "MRNY",
        "MANY,": "MRNY",
        "MERO": "MSFO",
        "Mero": "MSFO",
        "METN": "MSTY",
        "MeTN": "MSTY",
        "NNA?": "NFLY",
        "nna?": "NFLY",
        "CR?": "NVDY",
        "NUDY": "NVDY",
        "ENS": "OARK",
        "ens": "OARK",
        "PYEN": "PLTY",
        "PYEN,": "PLTY",
        "REIN": "RBLY",
        "REIN,": "RBLY",
        "ROY": "RDYY",
        "AURA": "SMCY",
        "aura": "SMCY",
        "ENOY": "SNOY",
        "aay": "SNOY",
        "AAY": "SNOY",
        "GARY": "TSLY",
        "MOMO)": "TSMY",
        "MOMO": "TSMY",
        "AR": "WNTR",
        "AN": "XOMO",
        "an": "XOMO",
        "YOQOO": "YQQQ",
        "YoQoo": "YQQQ",
    }

    def extract_data(self):
        """Pair a ticker with its own row, never with a historical roster."""
        self.issues = []
        self.raw_rows = {}
        results = {}
        lines = self.text.splitlines()

        def issue(token, detail, line):
            self.issues.append({
                "status": "ambiguous_mapping",
                "ticker": token,
                "detail": detail,
                "raw_text": line,
            })

        # Target 12 has a separate, context-qualified three-row recovery path.
        if "target 12" in self.text.lower():
            monthly_rows = [
                (line, re.search(r"(?:\$|§)?(\d+\.\d{4})\b", line))
                for line in lines
            ]
            monthly_rows = [(line, match) for line, match in monthly_rows if match]
            if len(monthly_rows) == len(YIELDMAX_TARGET_12_MONTHLY_ORDER):
                for ticker, (line, match) in zip(YIELDMAX_TARGET_12_MONTHLY_ORDER, monthly_rows):
                    results[ticker] = float(match.group(1))
                    self.raw_rows[ticker] = line
                return results
            issue("GOUGE", "Target 12 requires the complete three-row table", self.text)
            return results

        known = set(self.KNOWN_TICKERS) | set(YIELDMAX_TICKER_REGISTRY)
        known.update(self.OCR_CORRECTIONS.values())
        known.update({"MSST", "NVIT", "TEST", "MINY", "YMAX", "BIGY", "RNTY", "SOXY"})
        stopwords = {"YIELD", "ETF", "THE", "AND", "FOR", "SEE", "DATE",
                     "FUND", "NAME", "NAV", "RATE", "SHARE", "TOTAL",
                     "WEEKL", "WEEKLY", "MONTHLY", "DAILY", "YI"}

        for line in lines:
            clean = line.strip()
            if not clean:
                continue
            raw = clean.split()[0].strip("_,:|[]*()?'\\\"“”‘’")
            token = raw.upper()
            ticker = self.OCR_CORRECTIONS.get(raw, self.OCR_CORRECTIONS.get(token, token))
            ticker = normalize_yieldmax_ticker(ticker) or ticker
            is_ticker = ticker in known or (
                re.fullmatch(r"[A-Z]{2,5}", ticker) and ticker not in stopwords
            )
            # Prefer the dollar-labelled distribution cell. An unlabelled
            # four-decimal value is accepted only when it is not a percentage.
            amounts = re.findall(r"(?:\$|§)\s*(\d+\.\d{4,})\b", clean)
            if not amounts:
                amounts = re.findall(r"(?<![\w.])(\d+\.\d{4,})(?![\d.]|\s*%)", clean)
            distribution_row = bool(amounts) or ticker in known or (
                is_ticker and re.search(r"\b(?:weekly|monthly)\b", clean, re.IGNORECASE)
            )
            if not distribution_row:
                continue
            if not is_ticker or token == "GOUGE":
                issue(token, "Distribution amount has no unambiguous ticker on the same row", line)
                continue
            if len(amounts) != 1:
                issue(ticker, "Expected exactly one distribution amount on the ticker row", line)
                continue
            value = float(amounts[0])
            if not math.isfinite(value):
                issue(ticker, "Invalid distribution amount", line)
                continue
            if ticker in results and results[ticker] != value:
                issue(ticker, f"Conflicting duplicate OCR rows: {results[ticker]} vs {value}", line)
                continue
            results[ticker] = value
            self.raw_rows[ticker] = line
        return results


def recover_yieldmax_visual_rows(image):
    """Recover sparse OCR only from tokens sharing a visual row.

    PSM 6 can merge or lose amount cells in short Target 25 tables. PSM 11
    recognizes those cells independently; coordinates establish their row
    relationship without relying on a ticker list or table order.
    """
    words = pytesseract.image_to_data(
        image, config="--psm 11", output_type=pytesseract.Output.DICT
    )
    tokens = [
        (text.strip(), words["left"][i], words["top"][i],
         words["width"][i], words["height"][i])
        for i, text in enumerate(words["text"]) if text.strip()
    ]
    tickers = [word for word in tokens if word[1] < image.width * 0.12
               and re.fullmatch(r"\*?[A-Za-z]{2,5}", word[0])]
    amounts = [word for word in tokens if re.fullmatch(r"[$§]\d+\.\d{4,}", word[0])]
    rows = []
    used = set()
    for amount in amounts:
        center = amount[2] + amount[4] / 2
        matches = [
            (i, word) for i, word in enumerate(tickers)
            if word[1] + word[3] < amount[1]
            and abs(word[2] + word[4] / 2 - center) <= max(word[4], amount[4]) * 0.75
        ]
        if len(matches) != 1 or matches[0][0] in used:
            return None
        i, ticker = matches[0]
        used.add(i)
        rows.append((center, f"{ticker[0]} Weekly {amount[0]}"))
    # Do not accept a fallback which silently loses a ticker or an amount.
    if not rows or len(used) != len(tickers):
        return None
    return "\n".join(row for _, row in sorted(rows))


class RexParser(BaseParser):
    # OCR often misreads REX tickers as underlying stock symbols
    # Map: OCR_result → Actual_REX_ticker
    OCR_CORRECTIONS = {
        "NVDA": "NVII",  # REX NVDA Growth & Income ETF
        "TSLA": "TSII",  # REX TSLA Growth & Income ETF
        "MSTR": "MSII",  # REX MSTR Growth & Income ETF
        "COIN": "COII",  # REX COIN Growth & Income ETF
        "HOOD": "HOII",  # REX HOOD Growth & Income ETF
        "HOON": "HOII",  # OCR sometimes reads HOOD as "Hoon"
        "CRWY": "CWII",  # REX CRWY Growth & Income ETF
        "PLTR": "PLTI",  # REX PLTR Growth & Income ETF
        "LLY": "LLII",  # REX LLY Growth & Income ETF
        "WMT": "WMTI",  # REX WMT Growth & Income ETF
    }

    def extract_data(self):
        results = {}
        lines = self.text.split("\n")

        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue

            # Strategy 1: Image-based table format
            # Extract Fund Ticker and Distribution Per Share from table rows
            # Pattern: "REX TICKER ... $0.xxxx" or "REX TICKER ... 0.xxxx"

            # Find ALL tickers in the line (3-4 letters)
            ticker_matches = re.findall(r"\b([A-Z]{3,4})\b", line)
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
            amt_match = re.search(r"\$(\d+\.\d+)", line)
            if not amt_match:
                # Fallback: decimal without $ (must have 4 decimals to avoid percentages)
                amt_match = re.search(r"\b(\d+\.\d{4})\b", line)

            if amt_match:
                amount = float(amt_match.group(1))

                # Fix OCR error: sometimes leading 0 is dropped (9.0491 → 0.0491)
                # If amount > 5.0 and has 4 decimals, likely missing leading 0
                if amount > 5.0:
                    # Try replacing first digit with 0
                    amt_str = amt_match.group(1)
                    if "." in amt_str:
                        # e.g., "9.0491" → "0.0491"
                        fixed_amt_str = "0" + amt_str[1:]
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
            if re.match(r"^[A-Z]{4}$", line):
                ticker = line
                # Filter out potential false positives
                if ticker in ["DATE", "RATE", "YIELD"]:
                    continue

                # Look forward for price (e.g. "$0.2075")
                for offset in range(1, 5):
                    if i + offset >= len(lines):
                        break
                    next_line = lines[i + offset].strip()
                    if not next_line:
                        continue

                    # Match $0.xxxx
                    amt_match = re.match(r"^\$(\d+\.\d+)", next_line)
                    if amt_match:
                        results[ticker] = float(amt_match.group(1))
                        break
        return results


# Graniteshares Parser
class GranitesharesParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Pattern: Ticker (first word) ... $Amount
            # Handle OCR noise: |OYY -> IOYY, _YieldBOOST -> YieldBOOST

            parts = line.split()
            if not parts:
                continue

            raw_ticker = parts[0]

            # Clean ticker
            clean_ticker = raw_ticker
            if "|" in clean_ticker:
                clean_ticker = clean_ticker.replace("|", "I")

            # Special case for QBy -> QBY
            if clean_ticker == "QBy":
                clean_ticker = "QBY"

            clean_ticker = clean_ticker.upper()

            # Filter: Must be 3-5 uppercase letters
            if not re.match(r"^[A-Z]{3,5}$", clean_ticker):
                continue

            # Look for $0.xxxx
            amount_match = re.search(r"\$(\d+\.\d+)", line)
            if amount_match:
                amount = float(amount_match.group(1))
                results[clean_ticker] = amount

        return results


# Defiance Parser
class DefianceParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split("\n")

        def get_ticker_from_line(line):
            line_lower = line.lower()
            line_lower = line_lower.replace("—", "").replace("@", "q")  # e.g. —@lpy -> qlpy

            if "r2000" in line_lower or "r200" in line_lower or "russell" in line_lower:
                return "IWMY"
            if "nasdaq 100 weekly" in line_lower or "n100 weekly" in line_lower:
                return "QQQY"
            if "s&p 500 weekly" in line_lower or "sp500 weekly" in line_lower:
                return "JEPY"
            if "gold" in line_lower:
                return "GLDY"
            if "oil" in line_lower:
                return "USOY"
            if (
                "lightningspread" in line_lower
                or "lightning spread" in line_lower
                or "qldy" in line_lower
                or "lpy" in line_lower
            ):
                return "QLDY"
            if "nasdaq 100 income" in line_lower or "qqqt" in line_lower:
                return "QQQT"
            if "s&p 500 income" in line_lower or "spyt" in line_lower or "tnammd" in line_lower:
                return "SPYT"
            if "mstr" in line_lower or "mst" in line_lower or "mets" in line_lower:
                return "MST"
            if "ybmn" in line_lower or "bmnr" in line_lower or "beene" in line_lower:
                return "YBMN"
            if "wdte" in line_lower:
                return "WDTE"
            return None

        def extract_amount_from_line(line):
            line_clean = re.sub(r"\b\d+(?:\.\d+)?%", "", line)
            line_clean = re.sub(r"\b\d{2}[-_./]\d{2}[-_./]\d{4}\b", "", line_clean)

            float_matches = re.findall(r"\$?(\d+\.\d+)", line_clean)
            for m in float_matches:
                val = float(m)
                if 0.01 <= val <= 2.0:
                    return val

            digit_matches = re.findall(r"\b(\d{4,5})\b", line_clean)
            if not digit_matches:
                digit_matches = re.findall(r"(\d{4,5})", line_clean)

            for m in digit_matches:
                if m in ["100", "500", "2000", "2024", "2025", "2026", "2027"]:
                    continue
                if len(m) == 5 and m.startswith("9"):
                    val = float("0." + m[1:])
                    if 0.01 <= val <= 2.0:
                        return val
                elif len(m) == 4:
                    val = float("0." + m)
                    if 0.01 <= val <= 2.0:
                        return val
            return None

        current_ticker = None
        tickers_list = []
        amounts_list = []

        # Strategy 1: Inline & Interleaved Extraction
        for line in lines:
            line = line.strip()
            if not line:
                continue

            ticker = get_ticker_from_line(line)
            if ticker:
                current_ticker = ticker
                if ticker not in tickers_list:
                    tickers_list.append(ticker)

            amount = extract_amount_from_line(line)
            if amount is not None:
                amounts_list.append(amount)
                if current_ticker:
                    results[current_ticker] = amount
                    current_ticker = None

        # Strategy 2: Columnar format mapping (if len(tickers_list) == len(amounts_list))
        if (not results or len(results) < len(tickers_list)) and len(tickers_list) == len(amounts_list) and tickers_list:
            results = {}
            for i in range(len(tickers_list)):
                results[tickers_list[i]] = amounts_list[i]

        return results


# Neos Parser
class NeosParser(BaseParser):
    def extract_data(self):
        results = {}
        lines = self.text.split("\n")

        # NEOS distribution announcements often have Tickers as standalone lines,
        # or followed by their name, then the amount on another line or same line.

        # Valid Neos tickers are usually 4 or 5 uppercase characters.
        # Examples from screenshot: SPYI, QQQI, IWMI, NIHI, BTCI, NEHI, IYRI, IAUI, MLPI, XSPI, XQQI, XBCI, QQQH, SPYH, NLSI, HYBI, BNDI, TLTI, CSHI

        current_ticker = None
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Pattern for Ticker: standalone 4-5 uppercase chars that aren't common words
            ticker_match = re.search(r"\b([A-Z]{4,5})\b", line)

            # Pattern for amount: $0.xxxx (at least 4 decimals)
            amount_match = re.search(r"\$?(\d+\.\d{4,})", line)

            if ticker_match and not amount_match:
                candidate = ticker_match.group(1)
                # Exclusion list for non-tickers
                if candidate not in [
                    "NEOS",
                    "FUND",
                    "DATE",
                    "RATE",
                    "YIELD",
                    "DIST",
                    "NAV",
                    "PAY",
                    "REC",
                    "TEST",
                    "NET",
                    "ASSET",
                    "ROC",
                    "MONTH",
                    "YEAR",
                    "HIGH",
                    "BOND",
                    "MARKET",
                    "DAILY",
                    "SHAR[...",
                ]:
                    current_ticker = candidate

            if amount_match:
                amount = float(amount_match.group(1))
                if ticker_match:
                    results[ticker_match.group(1)] = amount
                    current_ticker = None
                elif current_ticker:
                    results[current_ticker] = amount
                    current_ticker = None

        return results


def find_json_path(ticker):
    pattern = str(DATA_DIR / "**" / f"{ticker.lower()}.json")
    matches = glob.glob(pattern, recursive=True)
    if matches:
        return Path(matches[0])
    return None


def update_json(path, date_str, amount, *, dry_run=False):
    """Validate before writing; confirmed values always take precedence."""
    ticker = path.stem.upper()
    try:
        if not math.isfinite(amount) or amount < 0:
            return UpdateOutcome(ticker, "data_error", "invalid incoming amount", amount)
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, list):
            rows = data
        else:
            rows = next((data[key] for key in ("backtestData", "dividend_history", "dividends")
                         if key in data), None)
        if not isinstance(rows, list):
            return UpdateOutcome(ticker, "data_error", "unsupported dividend history shape", amount)
        matches = [row for row in rows if row.get("date") == date_str]
        if not matches:
            return UpdateOutcome(ticker, "missing_distribution_row",
                                 f"date={date_str} does not exist", amount)
        if len(matches) != 1:
            return UpdateOutcome(ticker, "ambiguous_mapping",
                                 f"duplicate distribution rows for date={date_str}", amount)
        entry = matches[0]
        # Even expected=true must never bypass an existing confirmed amount.
        if "amountFixed" in entry:
            if Decimal(str(entry["amountFixed"])) != Decimal(str(amount)):
                return UpdateOutcome(
                    ticker, "conflicting_confirmed_amount",
                    f"existing={entry['amountFixed']}; incoming={amount}; date={date_str}", amount
                )
            return UpdateOutcome(ticker, "already_applied", f"date={date_str}", amount)
        if not dry_run:
            entry.pop("expected", None)
            entry["amountFixed"] = amount
            with path.open("w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=2, ensure_ascii=False)
            print(f"  [+] {path.name}: {date_str} -> {amount}")
        return UpdateOutcome(ticker, "updated", f"date={date_str}", amount)
    except Exception as exc:
        return UpdateOutcome(ticker, "data_error", f"read/write error: {exc}", amount)


def write_review_summary(outcomes, skip_missing_distribution_row=False):
    """Write CI-visible machine and human review summaries outside public/data.

    Returns (payload, skipped) where skipped is a list of UpdateOutcome objects
    with status == 'missing_distribution_row' (for use in step summaries).
    """
    def is_blocking(outcome):
        if skip_missing_distribution_row and outcome.status == "missing_distribution_row":
            return False
        return outcome.status in BLOCKING_REVIEW_STATUSES

    payload = {
        "outcomes": [
            {
                "ticker": outcome.ticker,
                "status": outcome.status,
                "detail": outcome.detail,
                "amount": outcome.amount,
                "source": outcome.source,
                "date": outcome.date,
                "raw_text": outcome.raw_text,
            }
            for outcome in outcomes
        ],
        "blocking": any(is_blocking(outcome) for outcome in outcomes),
    }
    Path("distribution-update-review.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    lines = ["## Distribution OCR review", ""]
    for outcome in outcomes:
        amount = "" if outcome.amount is None else f"; amount={outcome.amount}"
        context = f"; source={outcome.source}; date={outcome.date}" if outcome.source else ""
        lines.append(f"- `{outcome.status}` `{outcome.ticker}` — {outcome.detail}{amount}{context}")
        if outcome.raw_text:
            lines.append("  OCR: " + outcome.raw_text.replace("\n", " | ").replace("\r", ""))
    Path("distribution-update-review.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    skipped = [o for o in outcomes if o.status == "missing_distribution_row"]
    return payload, skipped


def main():
    parser_args = argparse.ArgumentParser()
    parser_args.add_argument("--ticker-output", type=Path,
                             help="Discover canonical tickers without changing data.")
    parser_args.add_argument("--skip-missing-distribution-row", action="store_true",
                             help="Skip missing dates only; mapping and confirmed-value conflicts still block.")
    args = parser_args.parse_args()
    if not SCREENSHOT_DIR.is_dir():
        raise SystemExit(f"Screenshot directory not found: {SCREENSHOT_DIR}")
    image_files = sorted(
        (path for path in SCREENSHOT_DIR.iterdir()
         if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS),
        key=lambda path: path.name.lower(),
    )
    if not image_files:
        raise SystemExit("No supported screenshots found")
    if any(path.suffix.lower() != ".txt" for path in image_files) and not setup_tesseract():
        raise SystemExit("Tesseract OCR not found")

    OCR_DEBUG_PATH.unlink(missing_ok=True)
    outcomes = []
    pending = []
    symbols = set()
    seen_events = {}
    recognized = 0
    extracted = 0
    for img_path in image_files:
        parser_type = next((kind for provider, kind in PARSER_TYPES.items()
                            if provider in img_path.name.lower()), None)
        if parser_type is None:
            continue
        recognized += 1
        text = ""
        try:
            if img_path.suffix.lower() == ".txt":
                text = img_path.read_text(encoding="utf-8")
            else:
                config = "--psm 6" if parser_type is YieldMaxParser else ""
                with Image.open(img_path) as image:
                    text = pytesseract.image_to_string(image, config=config)
            parser = parser_type(text, img_path.name)
            date_str = parser.parse_date()
            if date_str:
                date.fromisoformat(date_str)
            data_map = parser.extract_data()
            # Sparse tables may defeat PSM 6. Recovery must establish a unique
            # visual row for every ticker and amount; it never uses roster order.
            if (parser_type is YieldMaxParser and parser.issues
                    and img_path.suffix.lower() != ".txt"
                    and "target 12" not in text.lower()):
                with Image.open(img_path) as image:
                    recovered_text = recover_yieldmax_visual_rows(image)
                if recovered_text:
                    recovered = parser_type(recovered_text, img_path.name)
                    recovered_map = recovered.extract_data()
                    required = set(data_map) | {issue["ticker"] for issue in parser.issues}
                    if (not recovered.issues and required <= recovered_map.keys()
                            and all(recovered_map[key] == value for key, value in data_map.items())):
                        parser, data_map = recovered, recovered_map
                        text += "\n--- coordinate-verified rows ---\n" + recovered_text
            with OCR_DEBUG_PATH.open("a", encoding="utf-8") as handle:
                handle.write(f"\n--- {img_path.name} ---\n{text}\n")
        except Exception as exc:
            outcomes.append(UpdateOutcome(
                "", "extraction_failed", str(exc), source=img_path.name, raw_text=text
            ))
            continue

        for issue in parser.issues:
            outcomes.append(UpdateOutcome(
                issue["ticker"], issue["status"], issue["detail"],
                source=img_path.name, date=date_str, raw_text=issue.get("raw_text", text)
            ))
        if not date_str or not data_map:
            outcomes.append(UpdateOutcome(
                "", "extraction_failed", "Missing date or no safely paired distribution rows",
                source=img_path.name, date=date_str, raw_text=text
            ))
            continue
        extracted += len(data_map)
        for raw_ticker, amount in data_map.items():
            ticker = normalize_provider_ticker(parser_type, raw_ticker)
            symbols.add(ticker)
            raw_text = parser.raw_rows.get(raw_ticker, text)
            event_key = (ticker, date_str)
            if event_key in seen_events and seen_events[event_key] != amount:
                outcomes.append(UpdateOutcome(
                    ticker, "ambiguous_mapping", "Screenshots disagree on the same ticker/date",
                    amount, img_path.name, date_str, raw_text
                ))
                continue
            seen_events[event_key] = amount
            if args.ticker_output:
                continue
            path = find_json_path(ticker)
            if path is None:
                outcomes.append(UpdateOutcome(
                    ticker, "missing_registration", "No registered public/data JSON",
                    amount, img_path.name, date_str, raw_text
                ))
                continue
            outcome = update_json(path, date_str, amount, dry_run=True)
            outcome.source, outcome.date, outcome.raw_text = img_path.name, date_str, raw_text
            outcomes.append(outcome)
            pending.append((path, date_str, amount, outcome))

    if not recognized:
        outcomes.append(UpdateOutcome("", "extraction_failed", "No recognized provider inputs"))
    if args.ticker_output:
        args.ticker_output.write_text(
            "\n".join(sorted(symbols)) + ("\n" if symbols else ""), encoding="utf-8"
        )
    # Preflight every screenshot and data row before changing any ticker file.
    review, skipped = write_review_summary(outcomes, args.skip_missing_distribution_row)
    if not args.ticker_output:
        if review["blocking"]:
            for outcome in outcomes:
                if outcome.status == "updated":
                    outcome.status = "not_applied"
                    outcome.detail += "; batch blocked before any data write"
        else:
            for path, date_str, amount, outcome in pending:
                if outcome.status != "updated":
                    continue
                applied = update_json(path, date_str, amount)
                outcome.status, outcome.detail = applied.status, applied.detail
        review, skipped = write_review_summary(outcomes, args.skip_missing_distribution_row)

    print(f"Screenshots: {recognized}; extracted rows: {extracted}; "
          f"updated: {sum(o.status == 'updated' for o in outcomes)}; blocking: {review['blocking']}")
    github_step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if github_step_summary and skipped:
        with open(github_step_summary, "a", encoding="utf-8") as handle:
            handle.write("\n## Skipped: missing distribution rows\n\n")
            for outcome in skipped:
                handle.write(f"- `{outcome.ticker}` {outcome.date}: {outcome.detail}\n")
    # Discovery may still hydrate known files. The update invocation must block
    # before the workflow can format, upload to R2, or commit unsafe results.
    if not args.ticker_output and review["blocking"]:
        raise SystemExit(2)


PARSER_TYPES.update(
    {
        "roundhill": RoundHillParser,
        "yieldmax": YieldMaxParser,
        "rex": RexParser,
        "graniteshares": GranitesharesParser,
        "defiance": DefianceParser,
        "neos": NeosParser,
    }
)


def normalize_provider_ticker(parser_type, ticker):
    """Apply issuer-scoped OCR aliases at the workflow boundary as well."""
    normalized = ticker.upper().strip()
    if parser_type is YieldMaxParser:
        return normalize_yieldmax_ticker(normalized) or normalized
    return normalized


if __name__ == "__main__":
    main()
