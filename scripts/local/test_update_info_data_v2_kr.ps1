# Update Info Data v2 (KR) 워크플로우 로컬 테스트

# UTF-8 인코딩 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

Write-Host "=== Update Info Data v2 (KR) 워크플로우 로컬 테스트 ===" -ForegroundColor Cyan
Write-Host ""

# 환경 변수 설정
$env:DATA_LAYOUT_MODE = "market"
$env:MARKET_FILTER = "KR"
$env:EXCLUDE_PATHS = "public/data/nasdaq public/data/nyse"

Write-Host "1. Node.js 의존성 확인..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js가 설치되어 있지 않습니다." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js 확인 완료" -ForegroundColor Green
Write-Host ""

Write-Host "2. Python 의존성 확인..." -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python이 설치되어 있지 않습니다." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python 확인 완료" -ForegroundColor Green
Write-Host ""

Write-Host "3. npm install 확인..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️ node_modules가 없습니다. npm install을 실행합니다..." -ForegroundColor Yellow
    npm install
}
Write-Host "✅ npm 의존성 확인 완료" -ForegroundColor Green
Write-Host ""

Write-Host "4. KR 티커 심볼 동기화..." -ForegroundColor Yellow
python scripts/utils/sync_nav_symbols_with_data.py --no-sync-nav-files
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 티커 심볼 동기화 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 티커 심볼 동기화 완료" -ForegroundColor Green
Write-Host ""

Write-Host "5. 환율 데이터 업데이트..." -ForegroundColor Yellow
node scripts/exchange/fetch_all_exchange_rates.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 환율 데이터 업데이트 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 환율 데이터 업데이트 완료" -ForegroundColor Green
Write-Host ""

Write-Host "6. IPO 날짜 동기화..." -ForegroundColor Yellow
npm run add-ipo-dates
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ IPO 날짜 동기화 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ IPO 날짜 동기화 완료" -ForegroundColor Green
Write-Host ""

Write-Host "7. nav.json 생성..." -ForegroundColor Yellow
npm run generate-nav
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ nav.json 생성 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ nav.json 생성 완료" -ForegroundColor Green
Write-Host ""

Write-Host "8. 정보 데이터 업데이트 (KR only) - 건너뛰기 옵션" -ForegroundColor Yellow
$skipInfoData = Read-Host "정보 데이터 업데이트를 건너뛰시겠습니까? (y/N) - 시간이 오래 걸릴 수 있습니다"
if ($skipInfoData -ne "y" -and $skipInfoData -ne "Y") {
    Write-Host "정보 데이터 업데이트 실행 중... (시간이 오래 걸릴 수 있습니다)" -ForegroundColor Cyan
    python scripts/data_pipeline/info_data_pipeline_kr.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 정보 데이터 업데이트 실패" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ 정보 데이터 업데이트 완료" -ForegroundColor Green
} else {
    Write-Host "⏭️ 정보 데이터 업데이트 건너뜀" -ForegroundColor Gray
}
Write-Host ""

Write-Host "9. 배당 이력 처리 및 보강 (KR only) - 건너뛰기 옵션" -ForegroundColor Yellow
$skipDividend = Read-Host "배당 이력 처리를 건너뛰시겠습니까? (y/N) - 시간이 오래 걸릴 수 있습니다"
if ($skipDividend -ne "y" -and $skipDividend -ne "Y") {
    Write-Host "배당 이력 처리 실행 중..." -ForegroundColor Cyan
    python scripts/data_pipeline/scraper_dividend.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 배당 이력 처리 실패" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ 배당 이력 처리 완료" -ForegroundColor Green
} else {
    Write-Host "⏭️ 배당 이력 처리 건너뜀" -ForegroundColor Gray
}
Write-Host ""

Write-Host "10. 배당 스플릿 조정 적용 (KR only)..." -ForegroundColor Yellow
python scripts/data_processing/apply_split_adjustments.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 배당 스플릿 조정 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 배당 스플릿 조정 완료" -ForegroundColor Green
Write-Host ""

Write-Host "11. 캘린더 이벤트 데이터 생성..." -ForegroundColor Yellow
npm run generate-calendar-events
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 캘린더 이벤트 생성 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 캘린더 이벤트 생성 완료" -ForegroundColor Green
Write-Host ""

Write-Host "12. 변경된 파일 포맷팅 (nasdaq, nyse 제외)..." -ForegroundColor Yellow
npm run format:changed
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ 포맷팅 경고 (계속 진행)" -ForegroundColor Yellow
}
Write-Host "✅ 포맷팅 완료" -ForegroundColor Green
Write-Host ""

Write-Host "13. Git 상태 확인..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "변경된 파일:" -ForegroundColor Cyan
    Write-Host $gitStatus
} else {
    Write-Host "변경된 파일 없음" -ForegroundColor Gray
}
Write-Host ""

Write-Host "=== 테스트 완료 ===" -ForegroundColor Green
Write-Host "참고: R2 업로드와 git push는 로컬 테스트에서 제외되었습니다." -ForegroundColor Gray

