# scripts/format_changed_files.ps1
# Git에서 변경된 파일만 Prettier로 포맷하는 스크립트 (Windows용)

Write-Host "📝 변경된 파일만 포맷 중..." -ForegroundColor Cyan

# Git에서 변경된 파일 가져오기
$gitStatus = git status --porcelain
$changedFiles = $gitStatus | Where-Object { $_ -match '^\s*[AM].*\.(json|js|ts|vue)$' } | ForEach-Object {
    $_.Trim() -replace '^\s*[AM]\s+', ''
}

# 변경된 파일이 없으면 종료
if ($changedFiles.Count -eq 0) {
    Write-Host "✅ 변경된 파일이 없습니다. 포맷 건너뜀." -ForegroundColor Green
    exit 0
}

Write-Host "📊 변경된 파일: $($changedFiles.Count)개" -ForegroundColor Yellow

# 파일 타입별 분류
$jsonFiles = $changedFiles | Where-Object { $_ -match '\.json$' }
$jsFiles = $changedFiles | Where-Object { $_ -match '\.(js|ts|vue)$' }

# JSON 파일 포맷
if ($jsonFiles.Count -gt 0) {
    Write-Host "  └─ JSON: $($jsonFiles.Count)개" -ForegroundColor Gray
    $jsonFiles | ForEach-Object { npx prettier --write --log-level=silent $_ }
}

# JS/TS/Vue 파일 포맷
if ($jsFiles.Count -gt 0) {
    Write-Host "  └─ JS/TS/Vue: $($jsFiles.Count)개" -ForegroundColor Gray
    $jsFiles | ForEach-Object { npx prettier --write --log-level=silent $_ }
}

Write-Host "✅ 포맷 완료!" -ForegroundColor Green

