# Market Cap 데이터 수집

## 📊 개요

**Yahoo Finance**를 사용하여 모든 티커의 현재 시가총액(marketCap)을 매일 자동으로 수집합니다.

### ✅ 특징
- **완전 무료**: API 키 불필요
- **제한 없음**: 모든 티커 처리 가능
- **자동 실행**: 매일 2회 (한국/미국 증시 마감 후)
- **전체 지원**: 한국(KOSPI, KOSDAQ) + 미국(NASDAQ, NYSE)

### ⏰ 과거 데이터
- 과거 시가총액 데이터는 **시간이 지나면서 자연스럽게 누적**됩니다
- 매일 현재 값을 저장하므로, 1년 후에는 1년치 과거 데이터가 쌓입니다

## 🚀 자동 실행

### 워크플로우: `update_all_data.yml`

**실행 시점:**
- 한국 증시 마감 후: UTC 07:30 (KST 16:30)
- 미국 증시 마감 후: UTC 21:00/22:00 (서머타임 여부에 따라)

**처리 내용:**
```python
# scripts/update_market_cap.py
1. Yahoo Finance에서 전체 티커의 현재 marketCap 조회
2. 각 티커의 오늘 날짜 backtestData에 marketCap 추가
3. 파일 저장
```

## 💻 수동 실행

로컬에서 직접 실행하려면:

```bash
# Python 환경 필요
python scripts/update_market_cap.py
```

**실행 결과:**
```
======================================================================
📈 Daily Market Cap Update (Yahoo Finance)
======================================================================
📊 Total active tickers: 3041
📅 Today's date: 2025-10-31
💡 Using Yahoo Finance (free, no limits)

Fetching market caps in batches: 100%|████████████| 31/31 [00:45<00:00]

======================================================================
✅ Successfully updated: 2845 tickers
⏭️  Skipped: 196 tickers
======================================================================
```

## 📊 데이터 구조

`public/data/{ticker}.json`:

```json
{
  "tickerInfo": {
    "Symbol": "AAPL",
    "marketCap": 2850000000000,  // ← tickerInfo의 현재 값
    ...
  },
  "backtestData": [
    {
      "date": "2025-10-28",
      "open": 180.50,
      "high": 182.30,
      "low": 179.80,
      "close": 181.50,
      "volume": 52341000,
      "marketCap": 2800000000000  // ← 해당 날짜의 marketCap
    },
    {
      "date": "2025-10-29",
      "open": 181.50,
      "high": 183.20,
      "low": 181.00,
      "close": 182.75,
      "volume": 48567000,
      "marketCap": 2820000000000
    },
    {
      "date": "2025-10-30",
      "open": 182.75,
      "high": 185.50,
      "low": 182.30,
      "close": 185.25,
      "volume": 55432000,
      "marketCap": 2850000000000
    }
  ]
}
```

## ⚠️ 주의사항

### 스킵되는 경우
- 해당 날짜의 가격 데이터(close)가 없는 경우
- Yahoo Finance에서 marketCap을 제공하지 않는 경우
- 이미 해당 날짜에 marketCap이 있는 경우

### 데이터 신뢰성
- Yahoo Finance는 대부분의 상장 주식/ETF에 대해 신뢰할 수 있는 데이터를 제공합니다
- 일부 소형주나 특수 종목은 데이터가 없을 수 있습니다

## 🔍 확인 방법

### 특정 티커의 marketCap 확인

```bash
# Windows (PowerShell)
Get-Content public/data/aapl.json | ConvertFrom-Json | 
  Select-Object -ExpandProperty backtestData | 
  Select-Object -Last 5

# Linux/Mac
cat public/data/aapl.json | jq '.backtestData[-5:]'
```

### 워크플로우 실행 로그 확인

```
GitHub > Actions 탭 > "Update All Ticker Data" > 최근 실행 > 
"7.5. Update daily market capitalization (Yahoo Finance)" 스텝
```

## 📈 데이터 누적 예시

### 1일차 (2025-10-30)
```json
{
  "backtestData": [
    {"date": "2025-10-30", "close": 185.25, "marketCap": 2850000000000}
  ]
}
```

### 7일 후 (2025-11-06)
```json
{
  "backtestData": [
    {"date": "2025-10-30", "close": 185.25, "marketCap": 2850000000000},
    {"date": "2025-10-31", "close": 186.50, "marketCap": 2870000000000},
    {"date": "2025-11-01", "close": 187.25, "marketCap": 2885000000000},
    {"date": "2025-11-04", "close": 188.00, "marketCap": 2900000000000},
    {"date": "2025-11-05", "close": 186.75, "marketCap": 2880000000000},
    {"date": "2025-11-06", "close": 189.50, "marketCap": 2920000000000}
  ]
}
```

### 1년 후 (2026-10-30)
→ 약 250개의 거래일 데이터가 쌓여 있을 것입니다!

## 🛠️ 문제 해결

### marketCap이 업데이트되지 않음
1. Actions 탭에서 워크플로우 실행 로그 확인
2. "7.5. Update daily market capitalization" 스텝에서 오류 확인
3. 해당 티커의 데이터 파일이 존재하는지 확인

### 일부 티커만 업데이트됨
- 정상 동작입니다
- 가격 데이터가 없는 날은 marketCap도 업데이트되지 않습니다
- 장이 열리는 날에만 데이터가 쌓입니다

## 📚 관련 파일

- `scripts/update_market_cap.py` - 메인 스크립트
- `.github/workflows/update_all_data.yml` - 자동 실행 워크플로우 (스텝 7.5)
- `public/data/{ticker}.json` - 티커별 데이터 파일

## 💡 FAQ

**Q: 과거 데이터를 빠르게 채울 수 없나요?**
A: 현재 무료 API로는 불가능합니다. FMP API도 2025년 8월 31일 이후 무료 플랜에서 과거 데이터를 제공하지 않습니다.

**Q: 언제부터 데이터가 쌓이나요?**
A: 이 기능이 활성화된 날부터 매일 누적됩니다.

**Q: 휴일이나 주말에는?**
A: 워크플로우는 실행되지만, 시장이 열리지 않아 새 데이터가 없으면 자동으로 스킵됩니다.

**Q: API 키가 필요한가요?**
A: 아니요! Yahoo Finance는 완전 무료이며 API 키가 필요 없습니다.

