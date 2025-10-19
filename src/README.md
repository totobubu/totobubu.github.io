# 배당 모아 (Div Grow) - 프로젝트 설정 가이드

## 1. 초기 환경 설정

### # 1-1. Python 가상 환경 설정

프로젝트 루트에서 아래 명령어를 실행하여 파이썬 가상 환경을 생성하고 활성화합니다.

#```bash

# '.venv' 라는 이름의 가상 환경 생성

python3 -m venv .venv

# 가상 환경 활성화 (Windows - Git Bash or WSL)

source .venv/bin/activate

# 가상 환경 활성화 (Windows - Command Prompt)

# .venv\Scripts\activate

# 1-2. 필수 라이브러리 설치

프로젝트에 필요한 Node.js와 Python 라이브러리를 설치합니다.

# Python 라이브러리 설치

pip install -r requirements.txt

# Node.js 라이브러리 설치

npm install

# 2. 데이터 업데이트 파이프라인

데이터를 최신 상태로 유지하기 위한 스크립트 실행 순서입니다. GitHub Actions에서 매일 자동으로 실행되지만, 로컬에서 수동으로 실행할 수도 있습니다.

# 1. (선택) KOSPI, NASDAQ 등 대표 지수 종목 추가/업데이트

python scripts/fetch_top_tickers.py
python scripts/fetch_top_etfs.py

# 2. (선택) 특정 운용사의 모든 ETF 종목 추가

npm run add:etf "Roundhill"

# 3. (선택) 한국 주식 전체 목록 업데이트

python scripts/fetch_kr_tickers.py

# 4. 환율 데이터 업데이트

node scripts/fetch_all_exchange_rates.js

# 5. IPO 날짜 동기화 및 'upcoming' 상태 업데이트

npm run add-ipo-dates

# 6. 배당 주기(frequency) 및 그룹(group) 자동 분석

python scripts/analyze_dividend_frequency.py

# 7. 최종 nav.json 파일 생성

npm run generate-nav

# 8. 주가 데이터 증분 업데이트 (Node.js)

npm run update-data

# 9. 배당 데이터 증분 업데이트 (Python)

python scripts/update_dividends.py

# 10. 배당 내역 상세 정보(주가, 배당률 등) 가공

python scripts/scraper_dividend.py

# 11. 최신 기업 정보(시가총액 등) 업데이트

python scripts/scraper_info.py

# 13. 북마크 인기 데이터 집계 (FIRESTORE_SA_KEY 환경 변수 필요)

python scripts/aggregate_popularity.py

# 14. 달력 이벤트 데이터 생성

npm run generate-calendar-events

# 15. 사이드바 목록 데이터 생성

python scripts/generate_sidebar_tickers.py

# 16. 생성된 모든 JSON 파일 포맷팅

npm run format:data

3. 개발 서버 실행
   npm run dev

python sort*json_keys*.py
