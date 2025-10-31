# Market Cap 데이터 수집 가이드

## 📊 개요

### 현재 데이터 (모든 티커)
- **소스**: Yahoo Finance
- **대상**: 전체 3,041개 티커 (한국 + 미국)
- **제한**: 없음 (무료)
- **워크플로우**: `update_all_data.yml`
- **실행**: 매일 2회 (한국/미국 증시 마감 후)

### 과거 데이터 (미국 티커만)
- **소스**: Financial Modeling Prep API
- **대상**: 미국 시장만 (NASDAQ, NYSE)
- **제한**: 250 requests/day (무료 플랜)
- **워크플로우**: `backfill_market_cap.yml`
- **실행**: 매일 1회 (UTC 09:00)

## 🚀 설정 방법

### 1단계: 현재 데이터 수집 (자동 실행 중)
✅ **이미 작동 중!** 별도 설정 불필요

### 2단계: 과거 데이터 채우기 (선택사항)

#### API 키 발급
1. https://financialmodelingprep.com/developer/docs/ 방문
2. 무료 가입
3. API Key 복사

#### GitHub Secret 추가
```
Settings > Secrets and variables > Actions > New repository secret
Name: FMP_API_KEY
Secret: [발급받은 API 키]
```

#### 확인
- Actions 탭에서 "Backfill Historical Market Cap" 워크플로우 확인
- 매일 자동으로 미국 티커 200개씩 처리

## ⚠️ 중요 사항

### FMP API 제한
- **미국 시장만 지원**: NASDAQ, NYSE
- **한국 시장 미지원**: KOSPI, KOSDAQ는 403 오류 발생
- **해결**: 한국 티커는 Yahoo Finance로만 현재 데이터 수집

### 데이터 수집 전략
```
┌─────────────────────────────────┐
│ 한국 티커 (KOSPI, KOSDAQ)         │
│ ─────────────────────────────  │
│ ✅ 현재 데이터: Yahoo Finance   │
│ ❌ 과거 데이터: 불가능           │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 미국 티커 (NASDAQ, NYSE)         │
│ ─────────────────────────────  │
│ ✅ 현재 데이터: Yahoo Finance   │
│ ✅ 과거 데이터: FMP API         │
└─────────────────────────────────┘
```

## 💻 수동 실행

### 현재 데이터 업데이트 (모든 티커)
```bash
python scripts/update_market_cap.py
```

### 과거 데이터 채우기 (미국 티커만)
```bash
export FMP_API_KEY=your_key
npm run backfill-market-cap 0 200    # 첫 200개
npm run backfill-market-cap 200 200  # 다음 200개
```

## 🔍 문제 해결

### 403 Forbidden 오류
**원인**: FMP API가 한국 티커를 지원하지 않음
**해결**: 정상 동작. 미국 티커만 처리됨.

### API 키 오류
**원인**: FMP_API_KEY가 설정되지 않았거나 잘못됨
**해결**: GitHub Secrets 확인

### 데이터가 업데이트되지 않음
1. Actions 탭에서 워크플로우 실행 로그 확인
2. `update_all_data.yml`: 현재 데이터 (매일)
3. `backfill_market_cap.yml`: 과거 데이터 (미국만)

## 📊 예상 결과

### 한국 티커 (`aapw.json`)
```json
{
  "backtestData": [
    {
      "date": "2025-10-30",
      "close": 42.79,
      "volume": 27351,
      "marketCap": 2450000000000  // ← Yahoo Finance (현재만)
    }
  ]
}
```

### 미국 티커 (`aapl.json`)
```json
{
  "backtestData": [
    {
      "date": "2020-01-15",
      "close": 310.50,
      "volume": 45678900,
      "marketCap": 1350000000000  // ← FMP API (과거 데이터)
    },
    {
      "date": "2025-10-30",
      "close": 185.25,
      "volume": 52341000,
      "marketCap": 2850000000000  // ← Yahoo Finance (현재 데이터)
    }
  ]
}
```

## 🛠️ 관련 파일
- `scripts/update_market_cap.py` - 현재 데이터 (Yahoo Finance)
- `tasks/backfillMarketCap.js` - 과거 데이터 (FMP, 미국만)
- `.github/workflows/update_all_data.yml` - 매일 현재 데이터
- `.github/workflows/backfill_market_cap.yml` - 매일 과거 데이터 (미국)

