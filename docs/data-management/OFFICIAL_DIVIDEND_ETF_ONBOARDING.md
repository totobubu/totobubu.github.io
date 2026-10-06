# 공식 배당 ETF 온보딩

신규 배당 ETF는 발견과 공개 등록을 분리한다. 탐색 작업은 `public/`을
변경하지 않으며, 승인된 항목만 PR에서 기존 신규 티커 수집 절차를 실행한다.

## 후보 탐색

GitHub Actions의 **Discover Official Dividend ETF Candidates**는 매주 월요일
UTC 00:00에 실행된다. 수동 실행 시 `provider`에 운용사 slug를 넣어 범위를
줄일 수 있다. 결과물 `official-dividend-etf-candidates` 아티팩트에는 공식 URL,
상품명 근거, 등록 상태, 공식 기초자산 후보 및 Yahoo 보조 후보가 들어 있다.

현재 공식 목록 대상은 Amplify, GraniteShares, Kurv, First Trust, iShares,
SPDR, Invesco, Vanguard, WisdomTree, JPMorgan, Schwab, ProShares, YieldMax,
Defiance, Roundhill, Global X, NEOS, REX, Direxion, T-Rex이다.

Yahoo 결과는 검토용일 뿐 `underlying` 자동 등록에 사용하지 않는다. 공식
카탈로그에 단일 기초자산이 명시되지 않은 항목은 `needs_review` 상태로 남는다.

로컬 점검은 다음과 같다.

```powershell
python scripts/ticker_onboarding/discover_official_dividend_etfs.py --provider yieldmax
```

기본 결과는 Git에서 제외되는 `tmp/official-dividend-etf-candidates.json`이다.

## 승인과 PR

검토자가 공식 근거를 확인한 뒤 **Open PR for Approved Dividend ETFs**에
쉼표로 구분한 ETF 심볼을 입력한다. 작업은 공식 원천을 다시 읽어 후보가
바뀌었거나 단일 기초자산 근거가 없으면 실패한다.

누락된 미국 상장 기초자산은 ETF보다 먼저 등록하고, 이후 ETF의 nav/data,
가격·배당·캘린더·사이드바 데이터를 생성한다. 업로드나 main 직접 커밋은 하지
않으며, 결과는 `automation/onboard-approved-dividend-etfs` PR로만 제안된다.
