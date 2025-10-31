# Market Cap 데이터 수집 - 빠른 시작 가이드

## 📊 현황
- **총 티커 수**: 3,041개
- **현재 데이터**: Yahoo Finance (무료, 제한 없음) ✅
- **과거 데이터**: Financial Modeling Prep (250 requests/day) ⏰

## 🚀 빠른 시작

### 1. 현재 데이터 자동 수집 ✅
✅ **이미 작동 중!** Yahoo Finance로 매일 모든 티커의 현재 marketCap 자동 수집
- 📅 하루 2회 실행 (한국/미국 증시 마감 후)
- 🆓 무료, 제한 없음
- 📊 3,041개 전체 티커 처리

### 2. 과거 데이터 채우기 (선택사항) ⏰

과거 데이터는 FMP API 사용 (무료 플랜 250/day 제한):

**옵션 A: GitHub Secret 추가 → 자동 백필**
```
Settings > Secrets > Actions > New repository secret
Name: FMP_API_KEY
Secret: [발급받은 키]
```
→ 매일 자동으로 200개씩 과거 데이터 채움 (약 16일 소요)

**옵션 B: 수동 백필 (로컬)**
아래 "로컬 실행" 참고

## 📖 상세 가이드
자세한 내용은 [`docs/MARKET_CAP_SETUP.md`](docs/MARKET_CAP_SETUP.md) 참고

## 💻 로컬 실행 (선택사항)

### 현재 데이터 업데이트 (Yahoo Finance - 무료)
```bash
# 전체 3,041개 티커 현재 marketCap 업데이트
python scripts/update_market_cap.py
```

### 과거 데이터 채우기 (FMP API - 제한적)
```bash
# 1일차: 0~199번 (데이터 없는 티커만)
export FMP_API_KEY=your_key
npm run backfill-market-cap 0 200

# 2일차: 200~399번
npm run backfill-market-cap 200 200

# 3일차: 400~599번
npm run backfill-market-cap 400 200
# ... (필요한 만큼)
```

**💡 Tip**: 이미 과거 데이터가 있는 티커는 자동 스킵됩니다!

## 📊 결과 데이터 구조
```json
{
  "backtestData": [
    {
      "date": "2025-10-30",
      "close": 42.79,
      "volume": 27351,
      "marketCap": 2450000000000  // ← NEW!
    }
  ]
}
```

## ❓ FAQ

**Q: 현재 marketCap은 어떻게 가져오나요?**
A: Yahoo Finance 사용 (무료, 제한 없음). 매일 자동으로 모든 티커 업데이트.

**Q: 과거 데이터는 왜 느리게 채워지나요?**
A: FMP API 무료 플랜이 하루 250 requests로 제한. 약 16일이면 전체 완료.

**Q: 이미 과거 데이터가 있는 티커는?**
A: 자동으로 스킵됩니다. 새로운 티커나 데이터 없는 티커만 처리.

**Q: 더 빨리 과거 데이터를 채울 수 있나요?**
A: FMP 유료 플랜($14/month)으로 업그레이드하면 가능합니다.

## 🛠️ 관련 파일
- `scripts/update_market_cap.py` - 현재 데이터 업데이트 (Yahoo Finance)
- `tasks/backfillMarketCap.js` - 과거 데이터 채우기 (FMP API)
- `.github/workflows/update_all_data.yml` - 매일 현재 데이터 수집
- `.github/workflows/backfill_market_cap.yml` - 매일 과거 데이터 200개씩 채우기

## 📞 문제 해결
문제가 발생하면 [`docs/MARKET_CAP_SETUP.md`](docs/MARKET_CAP_SETUP.md)의 "문제 해결" 섹션을 참고하세요.

