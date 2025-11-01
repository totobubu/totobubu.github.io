# 로컬에서 전체 데이터 업데이트 스크립트
# GitHub Actions의 update_all_data.yml와 동일한 작업을 로컬에서 수행

Write-Host "🚀 전체 데이터 업데이트 시작..." -ForegroundColor Green
Write-Host ""

# 에러 발생 시 중단
$ErrorActionPreference = "Stop"

try {
    # 3. 환율 데이터 업데이트
    Write-Host "💱 3. 환율 데이터 업데이트 중..." -ForegroundColor Cyan
    node scripts/fetch_all_exchange_rates.js
    Write-Host "✅ 환율 데이터 업데이트 완료" -ForegroundColor Green
    Write-Host ""

    # 4. IPO 날짜 및 상태 동기화
    Write-Host "📅 4. IPO 날짜 동기화 중..." -ForegroundColor Cyan
    npm run add-ipo-dates
    Write-Host "✅ IPO 날짜 동기화 완료" -ForegroundColor Green
    Write-Host ""

    # 5. 배당 빈도 분석
    Write-Host "📊 5. 배당 빈도 분석 중..." -ForegroundColor Cyan
    python scripts/analyze_dividend_frequency.py
    Write-Host "✅ 배당 빈도 분석 완료" -ForegroundColor Green
    Write-Host ""

    # 6. nav.json 생성
    Write-Host "🗂️ 6. nav.json 생성 중..." -ForegroundColor Cyan
    npm run generate-nav
    Write-Host "✅ nav.json 생성 완료" -ForegroundColor Green
    Write-Host ""

    # 6.5. Holdings 자동 감지
    Write-Host "🔍 6.5. Holdings 자동 감지 중..." -ForegroundColor Cyan
    python scripts/auto_detect_holdings.py --api --exclude-kr --yes
    Write-Host "✅ Holdings 자동 감지 완료" -ForegroundColor Green
    Write-Host ""

    # 6.6. ETF Holdings 데이터 수집
    Write-Host "📊 6.6. ETF Holdings 데이터 수집 중..." -ForegroundColor Cyan
    Write-Host "y" | python scripts/fetch_holdings.py
    Write-Host "✅ ETF Holdings 데이터 수집 완료" -ForegroundColor Green
    Write-Host ""

    # 7. 히스토리 가격 데이터 업데이트
    Write-Host "📈 7. 히스토리 가격 데이터 업데이트 중..." -ForegroundColor Cyan
    npm run update-data
    Write-Host "✅ 히스토리 가격 데이터 업데이트 완료" -ForegroundColor Green
    Write-Host ""

    # 7.5. 시가총액 업데이트
    Write-Host "💰 7.5. 시가총액 업데이트 중..." -ForegroundColor Cyan
    python scripts/update_market_cap.py
    Write-Host "✅ 시가총액 업데이트 완료" -ForegroundColor Green
    Write-Host ""

    # 8. 배당 데이터 업데이트
    Write-Host "💵 8. 배당 데이터 업데이트 중..." -ForegroundColor Cyan
    python scripts/update_dividends.py
    Write-Host "✅ 배당 데이터 업데이트 완료" -ForegroundColor Green
    Write-Host ""

    # 9. 배당 히스토리 처리 및 보강
    Write-Host "📝 9. 배당 히스토리 처리 중..." -ForegroundColor Cyan
    python scripts/scraper_dividend.py
    Write-Host "✅ 배당 히스토리 처리 완료" -ForegroundColor Green
    Write-Host ""

    # 9.5. 히스토리 데이터 정리
    Write-Host "🧹 9.5. 히스토리 데이터 정리 중..." -ForegroundColor Cyan
    python scripts/clean_data.py
    Write-Host "✅ 히스토리 데이터 정리 완료" -ForegroundColor Green
    Write-Host ""

    # 10. 최신 티커 정보 업데이트
    Write-Host "ℹ️ 10. 최신 티커 정보 업데이트 중..." -ForegroundColor Cyan
    python scripts/scraper_info.py
    Write-Host "✅ 최신 티커 정보 업데이트 완료" -ForegroundColor Green
    Write-Host ""

    # 11. 북마크 인기도 집계 (FIRESTORE_SA_KEY 필요 - 옵션)
    Write-Host "⭐ 11. 북마크 인기도 집계 중..." -ForegroundColor Cyan
    if ($env:FIRESTORE_SA_KEY) {
        python scripts/aggregate_popularity.py
        Write-Host "✅ 북마크 인기도 집계 완료" -ForegroundColor Green
    } else {
        Write-Host "⚠️ FIRESTORE_SA_KEY 환경변수가 설정되지 않아 건너뜁니다." -ForegroundColor Yellow
    }
    Write-Host ""

    # 11.5. 미래 배당 날짜 예측
    Write-Host "🔮 11.5. 미래 배당 날짜 예측 중..." -ForegroundColor Cyan
    python scripts/project_future_dividends.py
    Write-Host "✅ 미래 배당 날짜 예측 완료" -ForegroundColor Green
    Write-Host ""

    # 12. 캘린더 이벤트 데이터 생성
    Write-Host "📆 12. 캘린더 이벤트 생성 중..." -ForegroundColor Cyan
    npm run generate-calendar-events
    Write-Host "✅ 캘린더 이벤트 생성 완료" -ForegroundColor Green
    Write-Host ""

    # 13. 사이드바 티커 데이터 생성
    Write-Host "📋 13. 사이드바 티커 생성 중..." -ForegroundColor Cyan
    python scripts/generate_sidebar_tickers.py
    Write-Host "✅ 사이드바 티커 생성 완료" -ForegroundColor Green
    Write-Host ""

    # 14. 생성된 데이터 파일 포맷팅
    Write-Host "✨ 14. 데이터 파일 포맷팅 중..." -ForegroundColor Cyan
    npm run format:data
    npm run format:nav
    npm run format:public
    Write-Host "✅ 데이터 파일 포맷팅 완료" -ForegroundColor Green
    Write-Host ""

    Write-Host "🎉 전체 데이터 업데이트 완료!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 변경된 파일을 확인하려면:" -ForegroundColor Yellow
    Write-Host "   git status" -ForegroundColor White
    Write-Host ""
    Write-Host "💾 변경사항을 커밋하려면:" -ForegroundColor Yellow
    Write-Host "   git add ." -ForegroundColor White
    Write-Host "   git commit -m '⚙️ Update all ticker data (local)'" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "❌ 오류 발생: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "스택 트레이스:" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}

