# Roundhill ETF Holdings 자동 스크래핑 가이드

## 📋 개요

Roundhill 웹사이트는 JavaScript 동적 로딩을 사용하여 BeautifulSoup으로는 스크래핑이 불가능합니다.
Puppeteer 또는 Playwright를 사용하면 JavaScript가 렌더링된 후의 데이터를 자동으로 수집할 수 있습니다.

---

## 🚀 빠른 시작

### 1. 패키지 설치

**Puppeteer (선택 1):**
```bash
npm install puppeteer
```

**Playwright (선택 2 - 더 빠르고 안정적):**
```bash
npm install playwright
npx playwright install chromium
```

### 2. 테스트 실행

**단일 ETF 테스트 (Puppeteer):**
```bash
node scripts/scrape_roundhill_holdings.js AAPW
```

**단일 ETF 테스트 (Playwright):**
```bash
node scripts/scrape_roundhill_holdings_playwright.js AAPW
```

### 3. 데이터 등록

스크래핑이 성공하면 배치 파일이 생성됩니다:
```bash
python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_YYMMDD_auto.txt
```

---

## 📊 스크립트 비교

| 항목 | Puppeteer | Playwright |
|------|-----------|------------|
| **파일** | `scrape_roundhill_holdings.js` | `scrape_roundhill_holdings_playwright.js` |
| **설치 크기** | ~300MB | ~500MB |
| **속도** | 보통 | 빠름 ⚡ |
| **안정성** | 좋음 | 매우 좋음 ✅ |
| **디버깅** | 쉬움 | 쉬움 |
| **권장** | 시작용 | Production용 |

---

## 🔧 사용법

### Puppeteer 버전

```bash
# 단일 ETF
node scripts/scrape_roundhill_holdings.js AAPW

# 여러 ETF
node scripts/scrape_roundhill_holdings.js AAPW NFLW TSLW

# 전체 Roundhill ETF (41개)
node scripts/scrape_roundhill_holdings.js --all
```

### Playwright 버전

```bash
# 단일 ETF
node scripts/scrape_roundhill_holdings_playwright.js AAPW

# 여러 ETF
node scripts/scrape_roundhill_holdings_playwright.js AAPW NFLW TSLW

# 전체 Roundhill ETF (41개)
node scripts/scrape_roundhill_holdings_playwright.js --all
```

---

## 📁 출력 파일

### 1. 배치 파일 (Python 스크립트 호환)

**경로**: `public/holdings/roundhill_YYMMDD_auto.txt` (Puppeteer)  
**경로**: `public/holdings/roundhill_YYMMDD_playwright.txt` (Playwright)

**형식**:
```
AAPW
as of 2/19/25

Ticker	Name	Identifier	ETF Weight	Shares	Market Value
037833100 TRS 031926 NM	APPLE INC WEEKLYPAY SWAP NM	037833100 TRS 031926 NM	100.17%	195,925	$52,972,242
AAPL	Apple Inc	037833100	20.03%	39,184	$10,594,178

--------------------------

NFLW
as of 2/19/25

...
```

**사용**:
```bash
python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_YYMMDD_auto.txt
```

### 2. 개별 JSON 파일 (디버깅용)

**경로**: `public/holdings/scraped/{ticker}_{timestamp}.json`

**형식**:
```json
{
  "ticker": "AAPW",
  "asOfDate": "2/19/25",
  "holdings": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc",
      "identifier": "037833100",
      "weight": "20.03%",
      "shares": "39,184",
      "marketValue": "$10,594,178"
    }
  ],
  "scrapedAt": "2025-11-05T10:30:00.000Z"
}
```

---

## 🐛 디버깅

### 스크린샷 저장

스크래핑 실패 시 자동으로 스크린샷이 저장됩니다:

**Puppeteer**: `debug_{ticker}.png`  
**Playwright**: `debug_playwright_{ticker}.png`

스크린샷을 확인하여 페이지 구조를 파악하세요.

### Selector 수정

웹사이트 구조가 변경된 경우 `possibleSelectors` 배열을 수정:

```javascript
const possibleSelectors = [
    'table.holdings-table',           // 클래스 이름
    '.holdings-table',                // CSS 클래스
    'table[class*="holdings"]',       // 부분 매칭
    '.fund-holdings table',           // 부모 요소
    '#holdings table',                // ID
    'table tbody tr',                 // 일반 테이블
];
```

### 날짜 추출 실패

날짜 정규식을 수정:

```javascript
const match = bodyText.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
```

다른 형식으로 변경 예시:
```javascript
// "Updated: MM/DD/YYYY" 형식
const match = bodyText.match(/Updated:\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);

// "Last Updated MM-DD-YYYY" 형식
const match = bodyText.match(/Last Updated\s+(\d{1,2}-\d{1,2}-\d{4})/i);
```

---

## ⚠️ 주의사항

### 1. Rate Limiting

Roundhill 웹사이트가 Rate Limiting을 적용할 수 있습니다.

**대응**:
- 요청 사이 2초 대기 (기본값)
- 전체 ETF 스크래핑 시 시간 증가 (41개 × 2초 = 82초 + 스크래핑 시간)

**수동 대기 시간 조정**:
```javascript
// 5초로 변경
await new Promise(resolve => setTimeout(resolve, 5000));
```

### 2. 웹사이트 구조 변경

Roundhill이 웹사이트 구조를 변경하면 스크립트를 수정해야 합니다.

**확인 방법**:
1. 디버깅 스크린샷 확인
2. 브라우저 개발자 도구로 페이지 검사
3. Selector 수정

### 3. Timeout 오류

네트워크가 느리거나 페이지 로드가 오래 걸리는 경우:

```javascript
// Timeout 증가 (Puppeteer)
await page.goto(url, { 
    waitUntil: 'networkidle2', 
    timeout: 60000  // 30초 → 60초
});

// Timeout 증가 (Playwright)
await page.goto(url, { 
    waitUntil: 'networkidle',
    timeout: 60000
});
```

---

## 🔄 워크플로우 통합 (완료!)

### GitHub Actions 자동 실행 ✅

**파일**: `.github/workflows/update_holdings.yml`

**실행**: 매일 새벽 3시 30분 (KST)

**워크플로우 구조:**

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4

- name: Install Node.js dependencies
  run: npm install

- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Scrape Roundhill holdings (Playwright)
  run: |
      node scripts/scrape_roundhill_holdings_playwright.js --all
      
      # 스크래핑한 데이터를 자동으로 등록
      BATCH_FILE=$(ls -t public/holdings/roundhill_*_playwright.txt | head -1)
      if [ -f "$BATCH_FILE" ]; then
        python scripts/add_roundhill_holdings.py --batch "$BATCH_FILE"
      fi
```

**결과**: 완전 자동화! 수동 작업 0% 🎉

---

## 📊 성능 비교

### 수동 작업 (현재)

```
시간: 약 5-10분
작업: 
  1. 41개 ETF 웹사이트 접속
  2. Holdings 테이블 수동 복사
  3. 텍스트 파일에 붙여넣기
  4. Python 스크립트 실행
```

### 자동 스크래핑 (Puppeteer/Playwright)

```
시간: 약 3-5분 (전체 자동)
작업:
  1. 스크립트 실행 1회
  2. 자동으로 모든 데이터 수집
  3. 배치 파일 자동 생성
  4. Python 스크립트로 등록
```

**시간 절약: 50-70%** ⚡

---

## 🎯 권장 워크플로우

### 옵션 1: 완전 수동 (현재)

```bash
# 웹사이트에서 수동 복사 → 텍스트 파일 생성
python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_251105.txt
```

**장점**: 간단, 의존성 없음  
**단점**: 시간 소요, 실수 가능

### 옵션 2: 반자동 (권장)

```bash
# 1. 자동 스크래핑 (1회)
node scripts/scrape_roundhill_holdings_playwright.js --all

# 2. 데이터 검증 (수동)
cat public/holdings/roundhill_YYMMDD_playwright.txt

# 3. 데이터 등록 (1회)
python scripts/add_roundhill_holdings.py --batch public/holdings/roundhill_YYMMDD_playwright.txt
```

**장점**: 빠름, 정확, 검증 가능  
**단점**: Node.js 의존성 필요

### 옵션 3: 완전 자동 (선택)

```bash
# GitHub Actions에서 주기적으로 자동 실행
```

**장점**: 완전 자동화  
**단점**: 워크플로우 시간 증가, Rate Limiting 위험

---

## 💡 베스트 프랙티스

1. **테스트 먼저**: 단일 ETF로 먼저 테스트
   ```bash
   node scripts/scrape_roundhill_holdings_playwright.js AAPW
   ```

2. **데이터 검증**: 배치 파일을 확인한 후 등록
   ```bash
   cat public/holdings/roundhill_YYMMDD_playwright.txt
   ```

3. **정기적 업데이트**: 월 1회 실행 권장
   - Roundhill Holdings는 자주 변경되지 않음
   - 너무 자주 실행하면 Rate Limiting 위험

4. **에러 처리**: 일부 ETF가 실패해도 계속 진행
   - 실패한 ETF는 수동으로 처리

---

## 🔗 관련 문서

- [README_HOLDINGS.md](./README_HOLDINGS.md) - Holdings 시스템 전체 가이드
- [add_roundhill_holdings.py](../scripts/add_roundhill_holdings.py) - Python 등록 스크립트

---

## 📞 문의

- 스크래핑 실패 시: 디버깅 스크린샷 확인
- Selector 수정 필요 시: 브라우저 개발자 도구 사용
- Rate Limiting 발생 시: 대기 시간 증가

---

**Last Updated**: 2025-11-06  
**Version**: 2.0.0 (워크플로우 통합 완료, 완전 자동화 달성)

