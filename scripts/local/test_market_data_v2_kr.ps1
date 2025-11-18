# Market Data v2 KR 워크플로우 로컬 테스트

Write-Host "=== Market Data v2 KR 워크플로우 로컬 테스트 ===" -ForegroundColor Cyan
Write-Host ""

# 환경 변수 설정 (필요시 수정)
$env:DATA_LAYOUT_MODE = "market"

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

Write-Host "4. 가격 데이터 업데이트 (KR only) - 건너뛰기 옵션" -ForegroundColor Yellow
$skipPriceUpdate = Read-Host "가격 데이터 업데이트를 건너뛰시겠습니까? (y/N)"
if ($skipPriceUpdate -ne "y" -and $skipPriceUpdate -ne "Y") {
    Write-Host "가격 데이터 업데이트 실행 중..." -ForegroundColor Cyan
    node tasks/updateHistoricalKrData.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 가격 데이터 업데이트 실패" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ 가격 데이터 업데이트 완료" -ForegroundColor Green
} else {
    Write-Host "⏭️ 가격 데이터 업데이트 건너뜀" -ForegroundColor Gray
}
Write-Host ""

Write-Host "5. Sidebar 생성 (popularity 100%) - 건너뛰기 옵션" -ForegroundColor Yellow
$skipSidebar = Read-Host "Sidebar 생성을 건너뛰시겠습니까? (y/N)"
if ($skipSidebar -ne "y" -and $skipSidebar -ne "Y") {
    Write-Host "Sidebar 생성 실행 중..." -ForegroundColor Cyan
    npm run generate-sidebar-tickers
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Sidebar 생성 실패" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Sidebar 생성 완료" -ForegroundColor Green
} else {
    Write-Host "⏭️ Sidebar 생성 건너뜀" -ForegroundColor Gray
}
Write-Host ""

Write-Host "6. 변경된 파일 포맷팅..." -ForegroundColor Yellow
npm run format:changed
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ 포맷팅 경고 (계속 진행)" -ForegroundColor Yellow
}
Write-Host "✅ 포맷팅 완료" -ForegroundColor Green
Write-Host ""

Write-Host "7. Git 상태 확인..." -ForegroundColor Yellow
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

