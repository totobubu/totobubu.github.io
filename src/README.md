# 배당 모아

# 1. 루트 폴더로 이동

node -v 18이상

# 2. 시스템 파이썬에 설치된 라이브러리들 제거

pip uninstall -y undetected-chromedriver beautifulsoup4 yfinance

관리자 권한으로 PowerShell 실행:
시작 메뉴를 엽니다.
PowerShell을 검색합니다.
Windows PowerShell 앱에 마우스 오른쪽 버튼을 클릭하고 **"관리자 권한으로 실행"**을 선택합니다.
"이 앱이 디바이스를 변경하도록 허용하시겠어요?"라는 창이 뜨면 "예"를 누릅니다.
현재 실행 정책 확인 (선택 사항):
관리자 PowerShell 창에 아래 명령어를 입력하여 현재 설정을 확인합니다. 아마 Restricted라고 나올 것입니다.
code
Powershell
Get-ExecutionPolicy
실행 정책 변경:
아래 명령어를 입력하고 엔터를 누릅니다.
code
Powershell
Set-ExecutionPolicy RemoteSigned
확인 프롬프트:
실행 정책을 변경할 것인지 묻는 메시지가 나타납니다. Y 또는 A를 입력하고 엔터를 누릅니다.
[Y] 예(Y): 이번 한 번만 변경을 허용합니다. (추천)
[A] 예(모두)(A): 앞으로도 계속 이 설정을 유지합니다.
code
Code
실행 정책 변경
실행 정책은 사용자를 신뢰하지 않는 스크립트로부터 보호합니다. 실행 정책을 변경하면 about_Execution_Policies
도움말 항목에 설명된 보안 위험에 노출될 수 있습니다. 실행 정책을 변경하시겠습니까?
[Y] 예(Y) [A] 예(모두)(A) [N] 아니요(N) [L] 모두 아니요(L) [S] 일시 중단(S) [?] 도움말 (기본값: "N"): Y
설정 완료: 이제 관리자 PowerShell 창을 닫아도 됩니다.

# 1. Vue 프로젝트 폴더로 이동

# 2. 'venv' 라는 이름의 가상 환경 생성

python3 -m venv venv

# 3. 생성된 가상 환경 활성화

source venv/bin/activate

pip install undetected-chromedriver beautifulsoup4 yfinance setuptools

스크립트별 역할
tasks/updateHistoricalData.js (Node.js)
대상: backtestData.prices
역할: yahoo-finance2를 사용하여 과거 일별 주가 데이터를 가져와 이 필드를 채웁니다. 증분 업데이트(Incremental Update) 방식으로 효율적으로 작동합니다.

scripts/scraper_info.py (Python)
대상: tickerInfo
역할: yfinance를 사용하여 최신 시세 정보와 기업 개요(시가총액, 거래량 등)를 가져와 이 필드를 업데이트합니다. 이전 데이터와 비교하여 ...Change 객체를 생성합니다.

scripts/scraper_dividend.py (Python)
대상: dividendHistory
역할: backtestData에 저장된 주가와 배당금 데이터를 읽어, 사용자가 보는 상세한 배당 내역(전일/당일/익일 종가, 배당률 등)을 계산하여 이 필드를 채웁니다.

# 3-1. 크롬 없을때

로컬서버

sudo apt-get update

sudo apt-get install -y wget gnupg

wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -

sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

sudo apt-get update

sudo apt-get install -y google-chrome-stable

# 4. 개발환경 셋팅

npm install

npm run build

npm run deploy

npm run dev

vercel dev --listen 5000

# 5. 권장 실행 순서

node scripts/fetch_all_exchange_rates.js
npm run add-ipo-dates
npm run generate-nav
npm run update-data
python scripts/update_dividends.py
python scripts/scraper_dividend.py
python scripts/scraper_info.py
python scripts/generate_live_data.py
python scripts/aggregate_popularity.py
npm run generate-calendar-events
npm run generate-sidebar-tickers
npm run format:data
