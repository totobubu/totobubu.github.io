# 로컬에서 enrich_kr_market_info.py 테스트용 스크립트

Write-Host "=== 한국 시장 정보 보강 스크립트 로컬 테스트 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 소수의 티커만 테스트 (--limit 옵션 사용)
Write-Host "1. 소수 티커 테스트 (5개만)" -ForegroundColor Yellow
python scripts/utils/enrich_kr_market_info.py --limit 5 --dry-run
Write-Host ""

# 2. 특정 티커만 테스트
Write-Host "2. 특정 티커 테스트" -ForegroundColor Yellow
python scripts/utils/enrich_kr_market_info.py --symbol 000080.KQ --dry-run
Write-Host ""

# 3. market 값이 없는 티커만 테스트 (작은 샘플)
Write-Host "3. market 값이 없는 티커만 테스트 (10개)" -ForegroundColor Yellow
python scripts/utils/enrich_kr_market_info.py --only-missing --limit 10 --dry-run --skip-on-high-failure
Write-Host ""

# 4. 실제 업데이트 (작은 샘플)
Write-Host "4. 실제 업데이트 테스트 (3개만, 실제 파일 수정)" -ForegroundColor Yellow
$response = Read-Host "실제 파일을 수정하시겠습니까? (y/N)"
if ($response -eq "y" -or $response -eq "Y") {
    python scripts/utils/enrich_kr_market_info.py --limit 3 --skip-on-high-failure
} else {
    Write-Host "건너뜀" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== 테스트 완료 ===" -ForegroundColor Green

