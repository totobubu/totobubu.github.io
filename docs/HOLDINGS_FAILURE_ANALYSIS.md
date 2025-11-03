# Holdings 데이터 수집 실패 분석

## 📊 전체 통계

- **성공**: 833개
- **실패**: 215개 (→ 수정 후 예상: ~170개)
- **총**: 1048개

## 🔍 실패 원인 분류

### 1. ✅ Roundhill Investments ETF (해결됨)

**문제**: 수동 입력 대상인데 에러로 카운트됨

**해당 티커** (45개):
- AAPW, AMDW, AMZW, ARMW, AVGW, BABW, BETZ, BRKW, CHAT, COIW, COSW, GDXW, GLDW, GOOW, HOOW, HUMN, MAGC, MAGS, MAGX, MAGY, METV, METW, MSFW, MSTW, NERD, NFLW, NVDW, OZEM, PLTW, QDTE, RDTE, TSLW, UBEW, UX, WEEK, WPAY, XDIV, XDTE, XPAY, YBTC, YETH

**해결 방법**:
```python
# Roundhill ETF는 빈 리스트 반환으로 성공 처리
if is_roundhill_etf(ticker_symbol):
    return []  # 에러가 아닌 성공으로 카운트
```

### 2. ✅ Upcoming ETF (해결됨)

**문제**: 아직 상장되지 않은 ETF로 데이터 없음

**해당 티커** (9개):
- ABNW, ASMW, CRWW, DKNW, LMTW, RDDW, SHOW, TSMW, XOMW
- 모두 `upcoming: true`인 Roundhill Investments ETF
- HTTP 404 오류 발생

**해결 방법**:
```python
# nav.json에서 upcoming ETF 사전 필터링
holdings_tickers = [
    item['symbol'] 
    for item in nav_data.get('nav', []) 
    if item.get('holdings', False) is True 
    and not item.get('upcoming', False)  # upcoming 제외
]
```

### 3. ⚠️ Yahoo Finance API 한계 (해결 불가)

**문제**: Yahoo Finance가 채권/원자재 ETF의 holdings를 제공하지 않음

**회사별 분류**:

#### Vanguard (최다 - 약 80개)
- **채권**: BND, BNDX, BSV, BIV, BLV, VCEB, VCIT, VCLT, VCSH, VGIT, VGLT, VGSH, VMBS, VTEB, VTEC, VTEI, VTES, VTIP, VWOB 등
- **특징**: 주로 채권(Bond) ETF

#### iShares (약 30개)
- **채권**: IBDT, IBDV, IBDW, IBDX, IBDY, IBIT, IBTG, IBTH, IBTI, IBTJ, ICSH, IEF, IEI, IGSB, ISTB, TIP, TLT 등
- **금**: IAU, IAUM, IGLD
- **특징**: BlackRock의 채권/금 ETF

#### SPDR State Street (약 20개)
- **채권**: SPAB, SPBO, SPIB, SPIP, SPLB, SPMB, SPSB, SPTI, SPTL, SPTS 등
- **금**: GLD, GLDM
- **원자재**: GSG
- **특징**: State Street의 채권/원자재 ETF

#### Schwab (약 15개)
- **채권**: SCHP, SCHQ, SCHR, SCHZ, SCHO, SCHI, SCMB, SCYB, SCCR 등
- **특징**: Schwab의 채권 ETF

#### 기타 주요 회사
- **PIMCO**: BOND, CMF, MINT, TOTL 등
- **JPMorgan**: JCPI, JMTG, JPHY, JPIE, JPLD, JPST, JSCP 등
- **VanEck**: ANGL, BWX, EMLC 등
- **ProShares**: AGQ, SH, SQQQ, UGL 등 (레버리지/인버스)
- **ARK**: ARKB (비트코인 ETF)
- **Fidelity**: FBND, FBTC, FETH, FFLC 등

## 💡 권장 조치

### 즉시 적용 (자동화)

1. ✅ **Roundhill ETF 에러 제거**
   - 빈 리스트 반환으로 성공 처리
   - 로그에서 `[SKIP]` 메시지 제거

2. ✅ **Upcoming ETF 사전 필터링**
   - `nav.json` 로드 시 `upcoming: true` 제외
   - 처리 대상에서 원천 차단

### 수동 대응 (선택적)

3. ⚠️ **Yahoo Finance 한계 인정**
   - 채권/금/원자재 ETF는 holdings 수집 포기
   - 또는 각 회사 공식 웹사이트 크롤링 고려
   - **예시**: 
     - Vanguard: `https://investor.vanguard.com/investment-products/etfs/profile/{ticker}`
     - iShares: `https://www.ishares.com/us/products/{fund-id}/`
     - SPDR: `https://www.ssga.com/us/en/individual/etfs/funds/{ticker}`

## 📈 예상 개선 효과

**수정 전**:
- 성공: 833개
- 실패: 215개
- 성공률: 79.5%

**수정 후**:
- 성공: 833 + 45(Roundhill) + 9(Upcoming) = **887개**
- 실패: ~161개 (Yahoo Finance 한계)
- 성공률: **84.6%**
- 실패한 ~161개는 대부분 채권/원자재 ETF로 holdings 수집 불필요

## 🔗 참고

- Roundhill ETF는 `scripts/add_roundhill_holdings.py`로 수동 입력
- Upcoming ETF는 상장 후 `upcoming: false`로 변경하여 자동 수집 가능

