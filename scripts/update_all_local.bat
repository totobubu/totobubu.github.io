@echo off
REM 로컬에서 전체 데이터 업데이트 스크립트 (배치 파일)
REM GitHub Actions의 update_all_data.yml와 동일한 작업을 로컬에서 수행

echo 🚀 전체 데이터 업데이트 시작...
echo.

REM 3. 환율 데이터 업데이트
echo 💱 3. 환율 데이터 업데이트 중...
node scripts/fetch_all_exchange_rates.js
if errorlevel 1 goto error
echo ✅ 환율 데이터 업데이트 완료
echo.

REM 4. IPO 날짜 및 상태 동기화
echo 📅 4. IPO 날짜 동기화 중...
call npm run add-ipo-dates
if errorlevel 1 goto error
echo ✅ IPO 날짜 동기화 완료
echo.

REM 5. 배당 빈도 분석
echo 📊 5. 배당 빈도 분석 중...
python scripts/analyze_dividend_frequency.py
if errorlevel 1 goto error
echo ✅ 배당 빈도 분석 완료
echo.

REM 6. nav.json 생성
echo 🗂️ 6. nav.json 생성 중...
call npm run generate-nav
if errorlevel 1 goto error
echo ✅ nav.json 생성 완료
echo.

REM 6.5. Holdings 자동 감지
echo 🔍 6.5. Holdings 자동 감지 중...
python scripts/auto_detect_holdings.py --api --exclude-kr --yes
if errorlevel 1 goto error
echo ✅ Holdings 자동 감지 완료
echo.

REM 6.6. ETF Holdings 데이터 수집
echo 📊 6.6. ETF Holdings 데이터 수집 중...
echo y | python scripts/fetch_holdings.py
if errorlevel 1 goto error
echo ✅ ETF Holdings 데이터 수집 완료
echo.

REM 7. 히스토리 가격 데이터 업데이트
echo 📈 7. 히스토리 가격 데이터 업데이트 중...
call npm run update-data
if errorlevel 1 goto error
echo ✅ 히스토리 가격 데이터 업데이트 완료
echo.

REM 7.5. 시가총액 업데이트
echo 💰 7.5. 시가총액 업데이트 중...
python scripts/update_market_cap.py
if errorlevel 1 goto error
echo ✅ 시가총액 업데이트 완료
echo.

REM 8. 배당 데이터 업데이트
echo 💵 8. 배당 데이터 업데이트 중...
python scripts/update_dividends.py
if errorlevel 1 goto error
echo ✅ 배당 데이터 업데이트 완료
echo.

REM 9. 배당 히스토리 처리 및 보강
echo 📝 9. 배당 히스토리 처리 중...
python scripts/scraper_dividend.py
if errorlevel 1 goto error
echo ✅ 배당 히스토리 처리 완료
echo.

REM 9.5. 히스토리 데이터 정리
echo 🧹 9.5. 히스토리 데이터 정리 중...
python scripts/clean_data.py
if errorlevel 1 goto error
echo ✅ 히스토리 데이터 정리 완료
echo.

REM 10. 최신 티커 정보 업데이트
echo ℹ️ 10. 최신 티커 정보 업데이트 중...
python scripts/scraper_info.py
if errorlevel 1 goto error
echo ✅ 최신 티커 정보 업데이트 완료
echo.

REM 11. 북마크 인기도 집계 (FIRESTORE_SA_KEY 필요 - 옵션)
echo ⭐ 11. 북마크 인기도 집계 중...
if defined FIRESTORE_SA_KEY (
    python scripts/aggregate_popularity.py
    if errorlevel 1 goto error
    echo ✅ 북마크 인기도 집계 완료
) else (
    echo ⚠️ FIRESTORE_SA_KEY 환경변수가 설정되지 않아 건너뜁니다.
)
echo.

REM 11.5. 미래 배당 날짜 예측
echo 🔮 11.5. 미래 배당 날짜 예측 중...
python scripts/project_future_dividends.py
if errorlevel 1 goto error
echo ✅ 미래 배당 날짜 예측 완료
echo.

REM 12. 캘린더 이벤트 데이터 생성
echo 📆 12. 캘린더 이벤트 생성 중...
call npm run generate-calendar-events
if errorlevel 1 goto error
echo ✅ 캘린더 이벤트 생성 완료
echo.

REM 13. 사이드바 티커 데이터 생성
echo 📋 13. 사이드바 티커 생성 중...
python scripts/generate_sidebar_tickers.py
if errorlevel 1 goto error
echo ✅ 사이드바 티커 생성 완료
echo.

REM 14. 생성된 데이터 파일 포맷팅
echo ✨ 14. 데이터 파일 포맷팅 중...
call npm run format:data
call npm run format:nav
call npm run format:public
if errorlevel 1 goto error
echo ✅ 데이터 파일 포맷팅 완료
echo.

echo 🎉 전체 데이터 업데이트 완료!
echo.
echo 📝 변경된 파일을 확인하려면:
echo    git status
echo.
echo 💾 변경사항을 커밋하려면:
echo    git add .
echo    git commit -m "⚙️ Update all ticker data (local)"
echo.
goto end

:error
echo.
echo ❌ 오류가 발생했습니다!
echo.
exit /b 1

:end

