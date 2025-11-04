#!/bin/bash
# scripts/format_changed_files.sh
# Git에서 변경된 파일만 Prettier로 포맷하는 스크립트

set -e

echo "📝 변경된 파일만 포맷 중..."

# Git에서 변경된 파일 가져오기
CHANGED_FILES=$(git status --porcelain | grep -E '^\s*[AM].*\.(json|js|ts|vue)$' | awk '{print $2}')

# 변경된 파일이 없으면 종료
if [ -z "$CHANGED_FILES" ]; then
    echo "✅ 변경된 파일이 없습니다. 포맷 건너뜀."
    exit 0
fi

# 변경된 파일 개수 세기
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
echo "📊 변경된 파일: ${FILE_COUNT}개"

# 파일 타입별 분류
JSON_FILES=$(echo "$CHANGED_FILES" | grep '\.json$' || true)
JS_FILES=$(echo "$CHANGED_FILES" | grep -E '\.(js|ts|vue)$' || true)

# JSON 파일 포맷
if [ -n "$JSON_FILES" ]; then
    JSON_COUNT=$(echo "$JSON_FILES" | wc -l | tr -d ' ')
    echo "  └─ JSON: ${JSON_COUNT}개"
    echo "$JSON_FILES" | xargs prettier --write --log-level=silent
fi

# JS/TS/Vue 파일 포맷
if [ -n "$JS_FILES" ]; then
    JS_COUNT=$(echo "$JS_FILES" | wc -l | tr -d ' ')
    echo "  └─ JS/TS/Vue: ${JS_COUNT}개"
    echo "$JS_FILES" | xargs prettier --write --log-level=silent
fi

echo "✅ 포맷 완료!"

