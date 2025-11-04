# 📊 티커 관리 가이드

> 새로운 주식/ETF를 시스템에 추가하는 방법

## 📑 목차

- [개요](#개요)
- [스크립트 종류](#스크립트-종류)
- [사용법](#사용법)
- [실행 순서](#실행-순서)
- [문제 해결](#문제-해결)

---

## 개요

이 시스템은 3가지 스크립트를 통해 새로운 티커를 추가할 수 있습니다:

| 스크립트 | 용도 | 대상 |
|---------|------|------|
| `fetch_top_tickers.py` | 주요 지수 종목 자동 추가 | S&P 500, NASDAQ 100, KOSPI 200, KOSDAQ 150 |
| `fetch_us_etfs.py` | 미국 ETF 수동 추가 | 미국 상장 ETF |
| `fetch_kr_etfs.py` | 한국 ETF 수동 추가 | 한국 상장 ETF |

---

## 스크립트 종류

### 1. `fetch_top_tickers.py` - 주요 지수 종목 자동 추가

**특징:**
- 웹 스크래핑으로 자동 수집
- 별도 입력 불필요
- 주요 지수의 모든 종목 한 번에 추가

**수집 대상:**
```
미국:
  - S&P 500 (약 500개)
  - NASDAQ 100 (100개)

한국:
  - KOSPI 시가총액 상위 200개
  - KOSDAQ 시가총액 상위 150개
```

**실행 방법:**
```bash
python scripts/fetch_top_tickers.py
```

**출력 예시:**
```
--- Starting to Fetch Top Market Tickers ---
Fetching S&P 500 tickers from Wikipedia...
  -> Found 503 S&P 500 tickers.
Fetching NASDAQ 100 tickers from Wikipedia...
  -> Found 100 NASDAQ 100 tickers.

Verifying exchanges for US tickers...
Fetching yfinance details: 100%|████████| 603/603

Fetching KOSPI top 200 tickers from FinanceDataReader...
  -> Found top 200 KOSPI tickers.

🎉 Finished fetching and updating top tickers.
```

---

### 2. `fetch_us_etfs.py` - 미국 ETF 수동 추가

**특징:**
- 티커 심볼을 직접 입력
- yfinance로 자동으로 상세 정보 수집
- 거래소 자동 판별 (NYSE/NASDAQ)

**사용 방법:**

#### 1단계: 스크립트 열기
```python
# scripts/fetch_us_etfs.py

PREDEFINED_ETF_TEXT = """
KYLD
IONQ
TSLL
IREM
"""
```

#### 2단계: 티커 추가
```python
PREDEFINED_ETF_TEXT = """
KYLD
IONQ
TSLL
IREM
VOO     # 새로 추가
VTI     # 새로 추가
QQQ     # 새로 추가
"""
```

#### 3단계: 실행
```bash
python scripts/fetch_us_etfs.py
```

**출력 예시:**
```
--- Starting to Fetch Top US ETFs from Predefined List ---
Found 1234 existing symbols in nav directories.
  -> Parsed 50 ETFs from the predefined list.

Enriching ETF data with yfinance for exchange info...
Fetching yfinance details: 100%|████████| 50/50

📊 Exchange Distribution:
  - NYSE: 30
  - NASDAQ: 18
  - Unknown exchange: 2
  - Failed to fetch: 0

  -> Found 3 new US ETFs to add.

📁 Files to update by market:
  ✓ public/nav/NYSE/v.json (+2 tickers)
  ✓ public/nav/NASDAQ/q.json (+1 tickers)

📊 Market Distribution:
  - NYSE: 2 ETFs
  - NASDAQ: 1 ETFs

🎉 Finished fetching and updating top US ETFs.
Please run 'npm run generate-nav' to apply changes.
```

---

### 3. `fetch_kr_etfs.py` - 한국 ETF 수동 추가

**특징:**
- ETF 이름 또는 코드로 검색
- FinanceDataReader로 자동 검색
- 여러 개 발견 시 가장 관련도 높은 것 선택

**사용 방법:**

#### 1단계: 스크립트 열기
```python
# scripts/fetch_kr_etfs.py

PREDEFINED_ETF_TEXT = """
TIGER미국S&P500
KODEX200
"""
```

#### 2단계: ETF 이름 추가 (한글/영문 모두 가능)
```python
PREDEFINED_ETF_TEXT = """
TIGER미국S&P500
KODEX200
ARIRANG고배당주        # 새로 추가
KODEX차이나전기차       # 새로 추가
ACE미국빅테크TOP7      # 새로 추가
"""
```

또는 **코드로 직접 입력:**
```python
PREDEFINED_ETF_TEXT = """
360750    # TIGER미국S&P500
069500    # KODEX200
161510    # ARIRANG고배당주
"""
```

#### 3단계: 실행
```bash
python scripts/fetch_kr_etfs.py
```

**출력 예시:**
```
======================================================================
  한국 ETF 자동 추가 스크립트
======================================================================
기존 심볼: 1234개
검색할 ETF: 5개

FinanceDataReader로 한국 ETF 정보 가져오는 중...
  -> 총 620개 한국 ETF 발견

ETF 검색 중...
Searching: 100%|████████| 5/5

✅ 찾은 ETF: 5개
   - 360750: TIGER 미국S&P500 (KOSPI)
   - 069500: KODEX 200 (KOSPI)
   - 161510: ARIRANG 고배당주 (KOSPI)
   - 305720: KODEX 2차전지산업 (KOSPI)
   - 453810: ACE 미국빅테크TOP7 (KOSPI)

새로운 ETF: 3개

3개 ETF를 nav 파일에 추가 중...
Processing: 100%|████████| 3/3

📁 업데이트할 파일:
  ✓ public/nav/KOSPI/3.json (+2 ETFs)
  ✓ public/nav/KOSPI/4.json (+1 ETFs)

📊 시장별 분포:
  - KOSPI: 3개 ETF
  - KOSDAQ: 0개 ETF

======================================================================
🎉 완료!
======================================================================
다음 명령어를 실행하여 변경사항을 적용하세요:
  npm run generate-nav
```

---

## 실행 순서

### 🎯 권장 실행 순서

```bash
# 1. 주요 지수 종목 추가 (자동)
python scripts/fetch_top_tickers.py

# 2. 미국 ETF 추가 (수동)
#    → scripts/fetch_us_etfs.py 편집 후
python scripts/fetch_us_etfs.py

# 3. 한국 ETF 추가 (수동)
#    → scripts/fetch_kr_etfs.py 편집 후
python scripts/fetch_kr_etfs.py

# 4. nav.json 생성 (필수!)
npm run generate-nav

# 5. 변경사항 확인
git status
git diff public/nav/

# 6. 커밋 및 푸시
git add .
git commit -m "feat: Add new tickers"
git push
```

---

## 파일 구조

티커 추가 후 다음과 같이 파일이 생성/수정됩니다:

```
public/
  nav/
    NYSE/
      a.json         # A로 시작하는 NYSE 종목
      q.json         # Q로 시작하는 NYSE 종목
      v.json         # V로 시작하는 NYSE 종목
    NASDAQ/
      q.json         # Q로 시작하는 NASDAQ 종목
    KOSPI/
      0.json         # 0으로 시작하는 KOSPI 종목
      3.json         # 3으로 시작하는 KOSPI 종목
    KOSDAQ/
      2.json         # 2로 시작하는 KOSDAQ 종목
  nav.json           # ⭐ 최종 통합 파일 (npm run generate-nav로 생성)
```

---

## 문제 해결

### ❌ 문제: "No module named 'FinanceDataReader'"

**해결:**
```bash
pip install FinanceDataReader
```

---

### ❌ 문제: "No module named 'yfinance'"

**해결:**
```bash
pip install yfinance
```

---

### ❌ 문제: "403 Forbidden" 오류 (NASDAQ 100 수집 시)

**원인:** Wikipedia가 봇 요청을 차단

**해결:** 스크립트가 이미 User-Agent 헤더를 설정하므로 보통 문제 없음. 계속 발생 시 재시도.

---

### ❌ 문제: "ETF를 찾을 수 없습니다" (한국 ETF)

**원인:** ETF 이름이 정확하지 않거나 상장폐지됨

**해결:**
1. ETF 이름을 더 정확하게 입력
2. 코드로 직접 입력
3. 네이버 증권에서 정확한 이름 확인

**예시:**
```python
# ❌ 잘못된 이름
"TIGER 미국 S&P500"  # 띄어쓰기 주의

# ✅ 올바른 이름
"TIGER미국S&P500"    # 띄어쓰기 없이

# ✅ 또는 코드로
"360750"              # 확실함
```

---

### ❌ 문제: 추가했는데 웹사이트에 안 보임

**원인:** `npm run generate-nav` 실행 안 함

**해결:**
```bash
npm run generate-nav
```

이 명령어를 실행해야 개별 nav 파일들이 `public/nav.json`으로 통합됩니다.

---

## 💡 팁

### 1. 여러 개 한 번에 추가

**미국 ETF:**
```python
PREDEFINED_ETF_TEXT = """
VOO
VTI
QQQ
SPY
IVV
VEA
IEMG
BND
AGG
VWO
VTV
VUG
"""
```

**한국 ETF:**
```python
PREDEFINED_ETF_TEXT = """
TIGER미국S&P500
KODEX200
ARIRANG고배당주
KODEX차이나전기차
ACE미국빅테크TOP7
TIGER차이나전기차SOLACTIVE
KODEX2차전지산업
TIGER미국나스닥100
KODEX인버스
TIGER코스피
"""
```

---

### 2. 빠른 검증

추가 후 바로 확인:
```bash
# nav.json 생성
npm run generate-nav

# 추가된 티커 확인
cat public/nav.json | grep "VOO"
cat public/nav.json | grep "360750"
```

---

### 3. 실수로 잘못 추가했을 때

```bash
# 변경사항 되돌리기
git checkout public/nav/

# 다시 시도
python scripts/fetch_us_etfs.py
npm run generate-nav
```

---

## 📚 참고 자료

- **yfinance 문서:** https://pypi.org/project/yfinance/
- **FinanceDataReader 문서:** https://github.com/FinanceData/FinanceDataReader
- **S&P 500 목록:** https://en.wikipedia.org/wiki/List_of_S%26P_500_companies
- **NASDAQ 100 목록:** https://en.wikipedia.org/wiki/NASDAQ-100
- **한국 ETF 목록:** 네이버 증권 ETF 섹션

---

## 🔄 자동화

GitHub Actions에서 정기적으로 실행하려면 워크플로우에 추가:

```yaml
# .github/workflows/update_tickers.yml
name: Update Tickers Weekly

on:
  schedule:
    - cron: '0 0 * * 0'  # 매주 일요일 자정
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Fetch top tickers
        run: python scripts/fetch_top_tickers.py
      
      - name: Generate nav
        run: npm run generate-nav
      
      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "actions@github.com"
          git add .
          git commit -m "chore: Update tickers" || echo "No changes"
          git push
```

---

**마지막 업데이트:** 2025-01-01

