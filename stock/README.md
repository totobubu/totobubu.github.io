# 배당 추적기


# 1. 루트 폴더로 이동
cd /workspaces/etf

# 2. 시스템 파이썬에 설치된 라이브러리들 제거
pip uninstall -y undetected-chromedriver beautifulsoup4 yfinance

# 1. Vue 프로젝트 폴더로 이동
cd /workspaces/etf/stock

# 2. 'venv' 라는 이름의 가상 환경 생성
python3 -m venv venv


# 3. 생성된 가상 환경 활성화
source venv/bin/activate

pip install undetected-chromedriver beautifulsoup4 yfinance setuptools

python scripts/scraper.py



# 3-1. 크롬 없을때

cd /workspaces/etf/stock

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

