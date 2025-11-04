# 워크플로우 버전 비교 (V1 vs V2)

## 개요

GitHub Actions 워크플로우를 최적화하여 V2 버전을 생성했습니다.
기존 V1과 새로운 V2를 병렬로 실행하여 속도와 효율성을 비교할 수 있습니다.

---

## 📊 Info Data 워크플로우 비교

### **V1 (기존)**: `update_info_data.yml`

- **실행 시간**: KST 새벽 1시 (UTC 16:00)
- **총 스텝 수**: 약 15개
- **주요 특징**:
    - 각 스크립트를 개별적으로 순차 실행
    - `yfinance` 라이브러리를 매번 import
    - `nav.json`을 각 스크립트에서 반복 로드
    - 개별 스크립트: `update_dividends.py`, `scraper_info.py`, `analyze_dividend_frequency.py`, `project_future_dividends.py` 등

```yaml
- update exchange rate data
- sync IPO dates
- analyze dividend frequency
- generate nav.json
- auto-detect holdings
- fetch holdings
- update historical dividend data # 개별 스크립트
- process dividend history # 개별 스크립트
- clean data
- update ticker info # 개별 스크립트
- project future dividends # 개별 스크립트
- generate calendar events
- format data
- upload to R2
- commit & push
```

### **V2 (최적화)**: `update_info_data_v2.yml`

- **실행 시간**: KST 새벽 2시 (UTC 17:00) - 1시간 차이
- **총 스텝 수**: 약 11개 (27% 감소)
- **주요 특징**:
    - **통합 파이프라인**: `info_data_pipeline.py` 하나로 4개 작업 처리
    - `yfinance`를 한 번만 import하여 메모리에서 재사용
    - `nav.json`을 한 번만 로드
    - 배치 처리 최적화

```yaml
- update exchange rate data
- sync IPO dates
- generate nav.json
- auto-detect holdings
- fetch holdings
- [통합 파이프라인] 4-in-1 작업:          # ⭐ 핵심 개선
  ├─ update dividends
  ├─ update ticker info
  ├─ analyze frequency
  └─ project future dividends
- process dividend history
- clean data
- generate calendar events
- format data
- upload to R2
- commit & push
```

**예상 개선 효과**:

- ✅ yfinance API 호출 최적화 (배치 처리)
- ✅ 파일 I/O 감소 (nav.json 1회 로드)
- ✅ 메모리 효율성 향상
- ✅ 전체 실행 시간 20-40% 단축 예상

---

## 📈 Market Data 워크플로우 비교

### **V1 (기존)**: `update_market_data.yml`

- **실행 시간**:
    - 미국 장 마감: UTC 21:00 / 22:00 (서머타임 고려)
    - 한국 장 마감: UTC 07:30
- **총 스텝 수**: 약 8개
- **주요 특징**:
    - 각 스크립트를 개별적으로 순차 실행
    - `yfinance`를 매번 import
    - 개별 스크립트: `update_market_cap.py`, `aggregate_popularity.py`, `generate_sidebar_tickers.py`

```yaml
- update historical price data
- update market cap # 개별 스크립트
- aggregate popularity # 개별 스크립트
- generate sidebar tickers # 개별 스크립트
- format data
- upload to R2
- commit & push
```

### **V2 (최적화)**: `update_market_data_v2.yml`

- **실행 시간**:
    - 미국 장 마감: UTC 21:30 / 22:30 (30분 차이)
    - 한국 장 마감: UTC 08:00 (30분 차이)
- **총 스텝 수**: 약 5개 (38% 감소)
- **주요 특징**:
    - **통합 파이프라인**: `market_data_pipeline.py` 하나로 3개 작업 처리
    - `yfinance`를 한 번만 import
    - 메모리에서 데이터 공유

```yaml
- update historical price data
- [통합 파이프라인] 3-in-1 작업:          # ⭐ 핵심 개선
  ├─ update market cap
  ├─ aggregate popularity
  └─ generate sidebar tickers
- format data
- upload to R2
- commit & push
```

**예상 개선 효과**:

- ✅ yfinance 배치 호출로 API 효율성 극대화
- ✅ Firebase 연결 1회로 감소
- ✅ 데이터 파일 읽기/쓰기 최적화
- ✅ 전체 실행 시간 30-50% 단축 예상

---

## 🔑 핵심 개선사항

### 1. **통합 파이프라인 스크립트**

| 항목            | V1 (기존)         | V2 (최적화)       |
| --------------- | ----------------- | ----------------- |
| info 데이터     | 4개 개별 스크립트 | 1개 통합 스크립트 |
| market 데이터   | 3개 개별 스크립트 | 1개 통합 스크립트 |
| yfinance import | 매 스크립트마다   | 1회만             |
| nav.json 로드   | 매 스크립트마다   | 1회만             |

### 2. **메모리 효율성**

```python
# V1: 각 스크립트마다 반복
import yfinance as yf
nav_data = json.load(open("nav.json"))

# V2: 한 번만 로드, 메모리에서 재사용
import yfinance as yf  # 1회
nav_data = load_once()  # 1회
# → 이후 모든 함수에서 재사용
```

### 3. **배치 처리 최적화**

```python
# V1: 티커별로 개별 호출
for ticker in tickers:
    yf.Ticker(ticker).info  # API 호출 N회

# V2: 배치로 한 번에 처리
yf.Tickers(all_tickers).info  # API 호출 1회
```

---

## 📝 실행 방법

### 수동 실행으로 테스트

GitHub Actions에서 "Run workflow" 버튼으로 수동 실행 가능:

1. **기존 버전 (V1)**:
    - `update_info_data.yml` → 수동 실행
    - `update_market_data.yml` → 수동 실행

2. **최적화 버전 (V2)**:
    - `update_info_data_v2.yml` → 수동 실행
    - `update_market_data_v2.yml` → 수동 실행

### 자동 실행 (스케줄)

두 버전이 다른 시간에 실행되어 충돌하지 않습니다:

- **Info Data**: V1은 새벽 1시, V2는 새벽 2시
- **Market Data**: V1은 정각, V2는 30분 차이

---

## 📊 성능 측정 지표

워크플로우 실행 시 다음을 확인하세요:

1. **총 실행 시간** (Actions 탭에서 확인)
    - V1: `update_info_data.yml` 실행 시간
    - V2: `update_info_data_v2.yml` 실행 시간

2. **개별 스텝 시간**
    - V1: 각 Python 스크립트 실행 시간 합계
    - V2: 통합 파이프라인 실행 시간

3. **로그 출력**
    - V2 파이프라인은 각 단계별 소요 시간과 업데이트 파일 수를 출력

---

## 🎯 예상 결과

| 워크플로우  | V1 예상 시간 | V2 예상 시간 | 개선율  |
| ----------- | ------------ | ------------ | ------- |
| Info Data   | 10-15분      | 6-10분       | ~30-40% |
| Market Data | 5-8분        | 3-5분        | ~30-50% |

---

## 🚀 다음 단계

1. **테스트 실행**: 양쪽 워크플로우를 수동으로 실행하여 결과 비교
2. **성능 검증**: 실행 시간과 결과물의 정확성 확인
3. **마이그레이션**: V2가 안정적이면 V1을 비활성화하고 V2로 전환
4. **정리**: 기존 개별 스크립트 보관 또는 제거

---

## 📌 주의사항

- 두 버전이 동시에 실행되지 않도록 실행 시간을 조정했습니다
- V2는 기존 스크립트와 동일한 결과를 생성하지만, 처리 방식이 다릅니다
- 충분한 테스트 후 V1을 제거하는 것을 권장합니다
- 기존 개별 스크립트들은 유지되므로 필요시 개별 실행 가능합니다

---

## 💡 기술 스택

- **Python**: 통합 파이프라인 로직
- **yfinance**: 주식/ETF 데이터 API
- **GitHub Actions**: CI/CD 자동화
- **Firebase**: 인기도 데이터 (선택적)
