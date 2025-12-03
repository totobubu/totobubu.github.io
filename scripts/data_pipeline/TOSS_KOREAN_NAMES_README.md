# 토스증권에서 한국어 종목명 수집하기

## 개요

이 스크립트는 Playwright를 사용하여 토스증권(https://tossinvest.com)에서 미국 주식의 한국어 종목명을 자동으로 수집합니다.

## 설치

### 1. 필요한 패키지 설치

```bash
# Playwright 패키지 설치
pip install playwright

# aiohttp 패키지 설치 (API 호출용)
pip install aiohttp

# 브라우저 드라이버 설치
playwright install chromium
```

### 2. 의존성 확인

```bash
# Playwright가 제대로 설치되었는지 확인
python -c "from playwright.async_api import async_playwright; print('Playwright installed!')"

# aiohttp 확인
python -c "import aiohttp; print('aiohttp installed!')"
```

## 사용법

### 테스트 모드 (처음 10개만)

```bash
python scripts/data_pipeline/fetch_korean_names_from_toss.py
```

테스트 모드에서는 처음 10개의 심볼만 가져와서 스크립트가 정상 작동하는지 확인합니다.

### 전체 실행

스크립트 파일을 열어서 `TEST_MODE = False`로 변경:

```python
# fetch_korean_names_from_toss.py 파일에서
TEST_MODE = False  # True -> False로 변경
```

그런 다음 실행:

```bash
python scripts/data_pipeline/fetch_korean_names_from_toss.py
python scripts/data_pipeline/fetch_korean_names_from_toss.py --symbol VOO

python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/l.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/m.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/o.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/p.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/q.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/r.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/s.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/t.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/u.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/v.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/w.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/x.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/y.json
python scripts/data_pipeline/fetch_korean_names_from_toss.py --nav-file public/nav/NYSE/z.json
```

## 출력

### 결과 파일

`scripts/data_pipeline/korean_names_from_toss.json`:

```json
{
    "AAPL": {
        "koName": "애플",
        "market": "NASDAQ",
        "source": "toss"
    },
    "TSLA": {
        "koName": "테슬라",
        "market": "NASDAQ",
        "source": "toss"
    }
}
```

## 작동 원리

1. **NAV 파일 스캔**: `public/nav/NASDAQ`, `public/nav/NYSE` 디렉터리에서 `koName`이 없는 심볼 찾기
2. **API 시도 (빠름)**: 토스증권 검색 API를 통해 한국어 이름 조회
3. **Playwright 스크래핑 (대체)**: API 실패 시 검색 → 클릭 → 회사정보 섹션에서 추출
4. **결과 저장**: JSON 파일로 저장

### 2단계 접근법

- **1단계**: 토스증권 API 호출 (빠르고 효율적)
- **2단계**: Playwright로 페이지 검색 및 스크래핑 (느리지만 확실)

이 방법으로 성공률을 높이고 실행 시간을 최적화합니다.

## 성능 최적화

- **동시 실행 수**: 기본 3개 (토스증권 서버 부하 방지)
- **요청 간격**: 0.5초 딜레이

설정을 변경하려면 스크립트에서 다음 값 수정:

```python
# 동시 실행 수 변경 (기본: 3)
results = await fetch_korean_names_batch(symbols_to_fetch, max_concurrent=5)

# 딜레이 변경 (기본: 0.5초)
await asyncio.sleep(1.0)  # 1초로 증가
```

## 주의사항

1. **서버 부하**: 너무 많은 동시 요청은 토스증권 서버에 부하를 줄 수 있습니다
2. **Rate Limiting**: 토스증권에서 Rate Limiting을 적용할 수 있으니 천천히 실행하세요
3. **HTML 구조 변경**: 토스증권 웹사이트 구조가 변경되면 선택자(selector) 업데이트 필요

## 다음 단계

결과 JSON 파일을 NAV 파일에 병합하는 스크립트:

```python
# TODO: NAV 파일 업데이트 스크립트 작성
# scripts/data_pipeline/update_nav_with_korean_names.py
```

## 문제 해결

### Playwright 설치 오류

```bash
# Windows에서 권한 문제 발생 시
playwright install chromium --with-deps
```

### 한국어 이름을 찾지 못하는 경우

1. 토스증권에 해당 종목이 없을 수 있음
2. HTML 구조가 변경되었을 수 있음 (선택자 업데이트 필요)
3. 페이지 로딩이 느릴 수 있음 (timeout 증가 필요)

선택자 업데이트:

```python
# fetch_korean_names_from_toss.py에서
selectors = [
    # 새로운 선택자 추가
    'your-new-selector',
    'span.tw3f-1r5dc8g0[style*="font-weight: bold"]',
    ...
]
```

## 예상 실행 시간

- 10개 심볼: 약 30초
- 100개 심볼: 약 5분
- 1000개 심볼: 약 50분

실제 시간은 네트워크 속도와 토스증권 서버 응답 시간에 따라 다릅니다.
