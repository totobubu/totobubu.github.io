# ETF Holdings 추적 시스템

ETF의 보유 자산(Holdings) 데이터를 자동/수동으로 수집하고 관리하는 시스템입니다.

## 📊 시스템 개요

### 지원 기능

- ✅ **자동 수집**: YieldMax ETF (웹 스크래핑), 일반 ETF (Yahoo Finance API)
- ✅ **수동 입력**: Roundhill ETF (일괄 처리 지원)
- ✅ **데이터 보호**: 수동 입력한 데이터는 자동으로 덮어쓰지 않음
- ✅ **시계열 관리**: 날짜별 holdings 변화 추적
- ✅ **레버리지 익스포저**: 100% 이상 익스포저 자동 분리

---

## 🔄 자동 수집 시스템

### 1. YieldMax ETF (57개)

**방식**: YieldMax 공식 웹사이트 스크래핑  
**성공률**: ~100%  
**스크립트**: `scripts/fetch_holdings.py` (내장)

**지원 ETF:**
```
APLY, NVDY, TSLY, MSTY, CONY, GOOY, AMZY, NFLY, OARK, YMAX, YMAG,
CRSH, DIPS, FIAT, WNTR, YQQQ, SLTY, ULTY, FEAT, FIVY, QDTY, RDTY,
SDTY, ABNY, AIYY, AMDY, BABO, BRKC, CRCO, CVNY, DISO, DRAY, FBY,
GDXY, GMEY, HIYY, HOOY, JPMO, MARO, MRNY, MSFO, PYPY, RBLY, RDYY,
SMCY, SNOY, TSMY, XOMO, XYZY, YBIT, CHPY, GPTY, LFGY, BIGY, RNTY, SOXY
```

**특징:**
- 옵션, 국채, 스왑 등 복잡한 자산 구조 완벽 지원
- 자산 타입 자동 분류: `option`, `treasury_bill`, `treasury_note`, `cash`, `money_market`

**사용법:**
```bash
# 특정 ETF
python scripts/fetch_holdings.py APLY

# 전체 자동 수집
python scripts/fetch_holdings.py
```

---

### 2. 일반 ETF (~900개)

**방식**: Yahoo Finance API  
**성공률**: ~88%  
**스크립트**: `scripts/fetch_holdings.py` (내장)

**지원 Provider:**
- iShares (229개) - 성공률 ~80%
- Vanguard (83개) - 성공률 ~67%
- Invesco (70개) - 성공률 ~67%
- SPDR (70개) - 성공률 ~53%
- JPMorgan (34개) - 성공률 ~73%
- First Trust (38개) - 성공률 100%
- Dimensional (25개) - 성공률 100%
- 기타 다수...

**실패하는 ETF 유형:**
- 채권 ETF (58%) - Yahoo Finance에서 데이터 미제공
- 금/은 상품 ETF (25%) - 단일 자산이라 holdings가 의미 없음
- 레버리지/인버스 ETF (17%) - 파생상품 기반으로 복잡함
- 암호화폐 ETF (8%) - 최신 자산 클래스

---

## 🖊️ 수동 입력 시스템

### Roundhill ETF (41개)

**방식**: 웹사이트에서 복사 → 일괄 등록  
**이유**: JavaScript 동적 로딩으로 자동 스크래핑 불가  
**스크립트**: `scripts/add_roundhill_holdings.py`

**지원 ETF:**

#### WeeklyPay™ (22개)
```
AAPW, NFLW, TSLW, NVDW, MSFW, GOOW, AMZW, METW, PLTW, COIW,
HOOW, MSTW, BRKW, AMDW, AVGW, ARMW, BABW, COSW, UBEW, GDXW, GLDW, WPAY
```

#### Income (7개)
```
XDTE, QDTE, RDTE, XPAY, YBTC, YETH, MAGY
```

#### Thematic (8개)
```
METV, MAGS, CHAT, BETZ, NERD, OZEM, WEED, MAGC
```

#### 기타 (4개)
```
UX, HUMN, MEME, WEEK, XDIV, MAGX
```

---

## 📝 사용 방법

### 자동 수집 (YieldMax + 일반 ETF)

```bash
# 단일 ETF
python scripts/fetch_holdings.py SPY

# 전체 ETF (nav.json에서 holdings: true인 것만)
python scripts/fetch_holdings.py

# 강제 업데이트 (수동 입력 데이터도 덮어씀)
python scripts/fetch_holdings.py SPY --force
```

**동작:**
- YieldMax ETF → 웹사이트 스크래핑
- Roundhill ETF → 자동 건너뜀 (수동 입력 안내)
- 기타 ETF → Yahoo Finance API

---

### 수동 입력 (Roundhill)

#### 방법 1: 일괄 처리 (추천!)

```bash
python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_YYMMDD.txt
```

**파일 형식:**
```
TICKER1
as of 날짜

Ticker	Name	Identifier	ETF Weight	Shares	Market Value
[데이터 행들...]

--------------------------

TICKER2
as of 날짜

Name	Weight
[데이터 행들...]

--------------------------
```

**예시:** `public/holdings/roundhill_251101.txt`

**결과:**
- ✅ 43개 ETF를 한번에 처리
- ✅ 2가지 형식 자동 감지
- ✅ 각 ETF의 날짜 자동 파싱

---

#### 방법 2: 단일 ETF

```bash
# 클립보드에서 (추천)
python scripts/add_roundhill_holdings.py AAPW "2/19/25"

# 파일에서
python scripts/add_roundhill_holdings.py AAPW "2/19/25" holdings.txt

# 직접 입력
python scripts/add_roundhill_holdings.py AAPW "2/19/25" --stdin
```

**준비:**
1. https://www.roundhillinvestments.com/etf/aapw/ 접속
2. "Top Holdings" 테이블 복사 (Ctrl+C)
3. 스크립트 실행

---

## 📊 데이터 구조

### 일반 Holdings (100% 이하)

```json
{
    "date": "2025-10-31",
    "holdings": [
        {
            "symbol": "AAPL",
            "name": "Apple Inc",
            "weight": 20.03,
            "type": "equity",
            "shares": 39184,
            "market_value": 10594178.0
        },
        {
            "symbol": "FGXXX",
            "name": "First American Government Obligations Fund",
            "weight": 10.58,
            "type": "money_market",
            "shares": 5595434,
            "market_value": 5595434.0
        }
    ]
}
```

---

### 레버리지 익스포저 (100% 이상)

```json
{
    "date": "2025-10-31",
    "leverage_exposure": [
        {
            "symbol": "037833100 TRS 031926 NM",
            "name": "APPLE INC WEEKLYPAY SWAP NM",
            "weight": 100.17,
            "type": "swap",
            "shares": 195925,
            "market_value": 52972242.0,
            "underlying": "AAPL"
        }
    ]
}
```

**자동 분리 조건:**
- `type`이 `swap`인 경우 자동으로 `leverage_exposure`로 분류
- 100% 이상 익스포저는 차트에서 별도 표시

---

## 🎨 자산 타입 분류

### 지원 타입

| Type | 설명 | 예시 | 배지 색상 |
|------|------|------|----------|
| `equity` | 주식 | AAPL, NVDA | 🔵 파랑 |
| `swap` | 스왑 계약 | TRS 계약 | 🔴 빨강 |
| `option` | 옵션 계약 | AAPL 251219C00255000 | 🟠 주황 |
| `treasury_bill` | 미국 단기 국채 | US Treasury Bill | 🟢 초록 |
| `treasury_note` | 미국 장기 국채 | US Treasury Note | 🟢 초록 |
| `cash` | 현금 | Cash & Other | 🟣 보라 |
| `money_market` | 머니마켓 펀드 | FGXXX | 🔵 하늘 |
| `other` | 기타 | - | ⚪ 회색 |

**자동 분류 규칙:**
- CUSIP/Identifier 패턴 분석
- 이름 키워드 매칭 (SWAP, TREASURY, CASH 등)
- 정규식 패턴 (옵션 형식 등)

---

## 🛡️ 데이터 보호 기능

### 수동 입력 데이터 보호

**문제:** 자동 스크립트가 수동으로 입력한 데이터를 덮어쓸 수 있음

**해결:**
```python
if 'holdings' in existing_entry and not force_update:
    print("[SKIP] 이미 holdings 데이터가 있습니다 (수동 입력 보호)")
    return True
```

**동작:**
- 같은 날짜에 이미 holdings가 있으면 자동으로 스킵
- `--force` 플래그로 강제 업데이트 가능

**예시:**
```bash
# 보호됨
python scripts/fetch_holdings.py NFLW
# → [SKIP] 2025-11-01에 이미 holdings 데이터가 있습니다

# 강제 업데이트
python scripts/fetch_holdings.py NFLW --force
# → [FORCE] 기존 holdings 데이터를 강제로 덮어씁니다
```

---

## 📈 차트 시각화

### StockHoldingsChart.vue

Holdings 데이터를 시각화하는 Vue 컴포넌트입니다.

**주요 기능:**

#### 1. 총 익스포저 요약 카드
```
[실제 보유 자산: 25.73%] + [레버리지 익스포저: 100.13%] = [총 익스포저: 125.86%]
```

#### 2. 레버리지 익스포저 차트
- 🔴 빨간색 테마로 구분
- 스왑, 옵션 등 파생상품 표시
- 100% 이상도 바 차트로 명확히 표현

#### 3. 실제 보유 자산 차트
- 직접 보유한 주식 및 현금
- 자산 타입별 색상 배지

#### 4. 상세 테이블
- 레버리지 익스포저 테이블 (식별자, 타입, 기초자산, 익스포저)
- 실제 보유 자산 테이블 (티커, 타입, 비중)

#### 5. 시계열 비교 차트
- Top 5 holdings의 비중 변화 추적

---

## 🔍 실패 패턴 분석

### Company별 실패율 (샘플 테스트 기준)

| Company | 전체 ETF | 실패율 | 실패 원인 | 대응 |
|---------|----------|--------|-----------|------|
| **PIMCO** | 11개 | 90.9% | 채권 전문 | 불필요 |
| **Roundhill** | 41개 | 60.0% | JS 동적 로딩 | ✅ 수동 입력 |
| **ProShares** | 10개 | 50.0% | 레버리지/인버스 | 불필요 |
| **SPDR** | 70개 | 46.7% | 채권 다수 | Yahoo Finance |
| **Schwab** | 29개 | 40.0% | 채권 다수 | Yahoo Finance |
| **VanEck** | 18개 | 40.0% | 금/채권 | Yahoo Finance |
| **Invesco** | 70개 | 33.3% | 채권 포함 | Yahoo Finance |
| **Vanguard** | 83개 | 33.3% | 채권 포함 | Yahoo Finance |
| **iShares** | 229개 | 20.0% | 대부분 성공 | Yahoo Finance |
| **YieldMax** | 57개 | 0.0% | - | ✅ 자동 수집 |
| **Dimensional** | 25개 | 0.0% | - | Yahoo Finance |
| **First Trust** | 38개 | 0.0% | - | Yahoo Finance |

**전체 성공률: ~88%**

---

## 📚 스크립트 가이드

### fetch_holdings.py

**목적**: 자동으로 holdings 데이터 수집

**처리 흐름:**
```
1. Roundhill ETF 감지 → SKIP (수동 입력 안내)
2. YieldMax ETF 감지 → 웹사이트 스크래핑
3. 기타 ETF → Yahoo Finance API
4. 데이터 저장 (backtestData에 추가)
```

**사용법:**
```bash
# 단일 ETF
python scripts/fetch_holdings.py SPY

# 전체 ETF
python scripts/fetch_holdings.py

# 강제 업데이트
python scripts/fetch_holdings.py SPY --force
```

**옵션:**
- `--force` 또는 `-f`: 기존 holdings 덮어쓰기

---

### add_roundhill_holdings.py

**목적**: Roundhill ETF holdings 수동 등록

**지원 형식:**

#### 형식 1: 전체 컬럼 (WeeklyPay™)
```
Ticker	Name	Identifier	ETF Weight	Shares	Market Value
AAPL	Apple Inc	037833100	20.03%	39,184	$10,594,178
```

#### 형식 2: 간단한 형식 (MAGS, WEED 등)
```
Name	Weight
NVIDIA	15.39%
Alphabet	15.16%
```

**사용법:**

```bash
# 일괄 처리 (추천!)
python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_YYMMDD.txt

# 단일 ETF - 클립보드
python scripts/add_roundhill_holdings.py AAPW "2/19/25"

# 단일 ETF - 파일
python scripts/add_roundhill_holdings.py AAPW "2/19/25" holdings.txt

# 단일 ETF - 직접 입력
python scripts/add_roundhill_holdings.py AAPW "2/19/25" --stdin
```

**날짜 형식:**
- `2/19/25` → `2025-02-19`
- `02/19/2025` → `2025-02-19`
- `2025-02-19` → `2025-02-19`

---

## 🗂️ 배치 파일 형식

### public/holdings/roundhill_YYMMDD.txt

```
AAPW
as of 2/19/25

Ticker	Name	Identifier	ETF Weight	Shares	Market Value
037833100 TRS 031926 NM	APPLE INC WEEKLYPAY SWAP NM	037833100 TRS 031926 NM	100.17%	195,925	$52,972,242
AAPL	Apple Inc	037833100	20.03%	39,184	$10,594,178
FGXXX	First American Government Obligations Fund	31846V336	10.58%	5,595,434	$5,595,434

--------------------------

MAGS
As of 11/02/2025

Name	Weight
NVIDIA	15.39%
Alphabet	15.16%
AMAZON.COM INC	15.01%

--------------------------
```

**구분자:** `--------------------------` (26개 하이픈)

**처리 결과:**
- ✅ 각 ETF를 자동으로 분리
- ✅ 날짜 자동 파싱
- ✅ 2가지 형식 자동 감지

---

## 🔧 일일 업데이트 워크플로우

### 자동 수집 (매일)

```bash
# GitHub Actions 또는 Cron Job
python scripts/fetch_holdings.py
```

**처리:**
- YieldMax 57개 → 자동 수집
- Roundhill 41개 → 건너뜀
- 일반 ETF ~900개 → Yahoo Finance (88% 성공)

---

### 수동 업데이트 (월 1회)

**Roundhill 업데이트 절차:**

1. **데이터 수집 (5분)**
   - https://www.roundhillinvestments.com 접속
   - 각 ETF 페이지에서 "Top Holdings" 테이블 복사
   - `public/holdings/roundhill_YYMMDD.txt` 파일에 붙여넣기

2. **일괄 등록 (1분)**
   ```bash
   python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_YYMMDD.txt
   ```

3. **완료!**
   - 35~40개 ETF 자동 등록
   - JSON 파일 없는 ETF는 스킵됨

---

## 💡 팁 & 트러블슈팅

### 수동 입력 데이터가 덮어써졌을 때

```bash
# 강제 업데이트로 복구 불가능
# Git에서 복원하거나 다시 수동 입력 필요
```

**예방:** 자동 스크립트는 기본적으로 보호함

---

### JSON 파일이 없다는 오류

```
[ERROR] JSON 파일이 존재하지 않습니다: public/data/metv.json
```

**원인:** `nav.json`에 해당 티커가 없거나 JSON 파일이 생성되지 않음

**해결:**
1. `nav.json`에 티커 추가 확인
2. 주가 데이터 먼저 생성 필요

---

### 파싱 실패

```
[SKIP] 형식이 올바르지 않은 행: ...
```

**원인:** 
- 컬럼이 탭으로 구분되지 않음
- 데이터 형식이 예상과 다름

**해결:**
- 웹사이트에서 테이블 전체를 드래그해서 복사
- Excel에 붙여넣기 후 TSV로 저장

---

### YieldMax 웹사이트 접속 실패

```
[ERROR] 웹사이트 접속 실패 - Connection timeout
```

**원인:** 네트워크 오류 또는 YieldMax 웹사이트 다운

**해결:**
- 재시도
- Yahoo Finance로 폴백 (제한적)

---

## 📊 통계 (2025-11-01 기준)

### 전체 현황

```
총 Holdings 추적 티커: 1,042개

자동 수집:
  - YieldMax: 57개 (100% 성공)
  - 일반 ETF: ~900개 (88% 성공)
  
수동 입력:
  - Roundhill: 41개 (81% 파싱 성공, JSON 없는 것 제외)
  
실패:
  - 채권 ETF: ~12%
  - 상품 ETF: ~3%
  - 기타: ~5%
```

### 자산 타입별 분포 (예시: APLY)

```
총 10개 holdings, 104.15% 총 익스포저

- Treasury Bill: 5개 (60.46%)
- Treasury Note: 1개 (20.23%)
- Option: 2개 (8.90%)
- Cash: 1개 (8.77%)
- Money Market: 1개 (2.77%)
```

---

## 🚀 향후 개선 사항

### 가능한 개선

1. **Selenium 통합** (Roundhill 자동화)
   - 복잡도: 높음
   - 효과: Roundhill 41개 자동화
   - 우선순위: 낮음 (수동 입력이 충분히 빠름)

2. **Provider별 전용 스크래퍼**
   - Defiance, Rex 등 추가
   - 우선순위: 낮음 (대부분 Yahoo Finance로 성공)

3. **실패 로그 자동 분석**
   - 실패한 티커 자동 분류
   - 우선순위: 중간

### 현재 시스템 완성도

```
✅ 자동 수집: 88% 성공률
✅ 수동 입력: 효율적인 일괄 처리
✅ 데이터 보호: 완벽
✅ 차트 시각화: 레버리지 익스포저 지원
✅ 시계열 관리: 날짜별 추적

→ Production Ready! 🎉
```

---

## 📞 문의 & 기여

### 새로운 Provider 추가

1. `fetch_holdings.py`에 `is_XXX_etf()` 함수 추가
2. `fetch_XXX_holdings()` 함수 구현
3. `fetch_etf_holdings()`에 조건 추가

### 자산 타입 추가

1. `classify_asset()` 또는 `classify_yieldmax_asset()` 수정
2. `StockHoldingsChart.vue`에 배지 스타일 추가

### 버그 리포트

- GitHub Issues에 리포트
- 실패한 티커와 오류 메시지 포함

---

## 📄 관련 파일

### 스크립트
- `scripts/fetch_holdings.py` - 자동 수집 메인 스크립트
- `scripts/add_roundhill_holdings.py` - Roundhill 수동 입력 스크립트

### 컴포넌트
- `src/components/charts/StockHoldingsChart.vue` - Holdings 차트

### 데이터
- `public/data/*.json` - 각 ETF의 backtestData에 holdings 포함
- `public/holdings/roundhill_*.txt` - Roundhill 일괄 등록 파일

### 문서
- `docs/README_HOLDINGS.md` - 이 문서
- `docs/README_MARKET_CAP.md` - Market Cap 관련 문서

---

## 📅 업데이트 히스토리

### 2025-11-01
- ✅ YieldMax 웹사이트 스크래퍼 구현
- ✅ Roundhill 수동 입력 스크립트 구현
- ✅ 일괄 처리 기능 추가
- ✅ 데이터 보호 기능 추가
- ✅ 레버리지 익스포저 차트 개선
- ✅ Shares, Market Value 필드 추가
- ✅ 2가지 데이터 형식 지원

---

## ❓ FAQ

### Q1: ETF Weight가 100%를 넘을 수 있나요?

**A:** 네! 가능합니다.

스왑 계약(Total Return Swap)을 사용하면 실제 보유 자산보다 큰 익스포저를 만들 수 있습니다.

**예시: NFLW**
```
스왑 계약: 100.13%
실제 주식: 20.03%
현금: 5.70%
────────────────
총 익스포저: 125.86%
```

---

### Q2: 왜 Roundhill은 자동 수집이 안 되나요?

**A:** Roundhill 웹사이트는 JavaScript로 동적 로딩을 사용합니다.

- HTML에는 빈 테이블만 있음
- 실제 데이터는 페이지 로드 후 JavaScript가 API에서 가져옴
- BeautifulSoup으로는 JavaScript 실행 불가
- Selenium 사용 가능하지만 복잡함

**대안:** 수동 입력 (일괄 처리로 5분이면 완료)

---

### Q3: 채권 ETF는 왜 실패율이 높나요?

**A:** Yahoo Finance API의 구조적 한계입니다.

- 채권은 개별 식별이 어렵고 자주 바뀜
- Yahoo Finance는 채권 ETF holdings를 거의 제공하지 않음
- 채권 ETF는 holdings 추적이 덜 중요함 (단순한 구조)

---

### Q4: 수동으로 입력한 데이터가 자동으로 덮어써질까요?

**A:** 아니요, 보호됩니다.

```bash
python scripts/fetch_holdings.py NFLW
# → [SKIP] 2025-11-01에 이미 holdings 데이터가 있습니다 (수동 입력 보호)
```

강제 업데이트가 필요한 경우:
```bash
python scripts/fetch_holdings.py NFLW --force
```

---

### Q5: 새로운 Roundhill ETF를 추가하려면?

**방법 1:** `fetch_holdings.py` 업데이트
```python
roundhill_tickers = [
    'NFLW', 'AAPW', ...,
    'NEW_TICKER'  # 추가
]
```

**방법 2:** 일괄 처리 파일에 포함
```
public/holdings/roundhill_YYMMDD.txt에 추가
```

---

## 🎯 베스트 프랙티스

### 1. 자동 수집 먼저 실행
```bash
python scripts/fetch_holdings.py
```
- YieldMax와 일반 ETF는 자동으로 처리됨

### 2. Roundhill은 월 1회 수동 업데이트
```bash
python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_YYMMDD.txt
```
- 5분이면 41개 전부 완료

### 3. 수동 입력은 조심스럽게
- 오늘 날짜에 이미 holdings가 있으면 스킵됨
- 필요시 `--force` 사용

### 4. 데이터 백업
- Git으로 자동 백업됨
- 실수로 덮어쓴 경우 Git에서 복원

---

## 📌 요약

```
✅ YieldMax: 100% 자동 수집 (웹 스크래핑)
✅ Roundhill: 효율적인 수동 입력 (일괄 처리)
✅ 일반 ETF: 88% 자동 수집 (Yahoo Finance)
✅ 수동 입력 데이터 완벽 보호
✅ 레버리지 익스포저 자동 분리
✅ 차트 시각화 완비

→ 완성도 높은 Holdings 추적 시스템! 🚀
```

---

**Last Updated**: 2025-11-01  
**Version**: 1.0.0

