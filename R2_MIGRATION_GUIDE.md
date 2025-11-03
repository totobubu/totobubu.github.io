# Cloudflare R2 마이그레이션 가이드

## 📋 개요

이 프로젝트는 Cloudflare R2를 사용하여 데이터 파일(약 2.5GB)을 호스팅합니다.
- **개발 환경**: 로컬 `public/` 폴더 사용
- **프로덕션 환경**: Cloudflare R2 사용

---

## 🚀 초기 설정 (완료됨)

### ✅ 1. R2 버킷 생성
- Bucket: `divgrow-data`
- Location: APAC
- Public URL: `https://pub-cdda6824954243b49965012b33c29bd6.r2.dev`

### ✅ 2. 환경 변수 설정
- `.env.r2`: Python 스크립트용 (Git에 커밋되지 않음)
- `.env.production`: Vue 프로덕션 빌드용
- `.env.development`: Vue 개발 환경용

---

## 📝 사용 방법

### 1️⃣ 데이터 업데이트 (Python 스크립트)

기존과 동일하게 스크립트를 실행하면 **자동으로 로컬과 R2 둘 다 저장**됩니다:

```bash
# 티커 정보 업데이트
python scripts/scraper_info.py

# 배당 데이터 업데이트
python scripts/scraper_dividend.py

# Live 데이터 생성
python scripts/generate_live_data.py
```

**변경 사항**:
- 로컬 `public/data/` 폴더에 저장 ✅
- 동시에 R2에도 자동 업로드 ✅
- Git push 없이 즉시 프로덕션에 반영 🎉

### 2️⃣ 전체 데이터 일괄 업로드

처음 설정할 때 또는 대량 업로드가 필요할 때:

```bash
python scripts/upload_all_to_r2.py
```

업로드되는 파일:
- `public/data/*.json` (3,052개 파일)
- `public/nav.json`
- `public/sidebar/*.json`
- `public/calendar-events.json`

### 3️⃣ 프론트엔드 개발

#### 개발 환경 (로컬 데이터 사용)
```bash
npm run dev
# .env.development 사용 → 로컬 public/ 폴더에서 데이터 로드
```

#### 프로덕션 빌드 (R2 데이터 사용)
```bash
npm run build
# .env.production 사용 → R2에서 데이터 로드
```

---

## 🔧 주요 파일 설명

### Python
- `scripts/r2_config.py`: R2 연결 및 업로드 헬퍼 함수
- `scripts/utils.py`: 
  - `save_json_with_r2()`: 로컬 + R2 동시 저장
  - `load_json_with_r2()`: R2 우선, fallback 로컬
- `scripts/upload_all_to_r2.py`: 전체 파일 일괄 업로드

### Vue
- `src/utils/dataUrl.js`: 환경에 따라 로컬/R2 URL 선택
- `.env.production`: 프로덕션 환경변수
  ```env
  VITE_R2_PUBLIC_URL=https://pub-cdda6824954243b49965012b33c29bd6.r2.dev
  VITE_USE_R2=true
  ```
- `.env.development`: 개발 환경변수
  ```env
  VITE_USE_R2=false
  ```

---

## 🎯 장점

### 1. **Git 레포지토리 경량화**
- ❌ 이전: 2.5GB 데이터 파일이 Git에 포함
- ✅ 이후: Git에서 제외, R2에만 저장
- 결과: `git clone`, `git pull` 속도 대폭 향상

### 2. **즉시 배포**
```bash
# 이전 워크플로우:
python scraper_info.py
git add public/data/
git commit -m "Update data"
git push                    # ← 느림 (2.5GB)
# GitHub Pages 빌드 대기... # ← 느림

# 현재 워크플로우:
python scraper_info.py      # ← R2에 즉시 업로드
# 끝! 바로 반영됨 ✨
```

### 3. **무료 + 빠른 CDN**
- 저장: 2.5GB < 10GB 무료 티어
- 다운로드: 무제한 무료
- CDN: Cloudflare 전 세계 네트워크

---

## ⚠️ 주의사항

### 1. `.env.r2` 파일 보안
```bash
# ❌ 절대 커밋하지 마세요!
.env.r2

# ✅ .gitignore에 이미 추가됨
```

### 2. R2 Public URL 변경 시
`.env.production` 파일 수정:
```env
VITE_R2_PUBLIC_URL=https://새로운-URL.r2.dev
```

### 3. 개발 중에는 로컬 데이터 사용
- `npm run dev` 실행 시 자동으로 로컬 데이터 사용
- R2 업로드 실패해도 개발에 영향 없음

---

## 🔍 테스트

### R2 연결 테스트
```bash
python scripts/r2_config.py
```

출력:
```
[OK] R2 설정 로드 성공
   Bucket: divgrow-data
   Public URL: https://pub-cdda6824954243b49965012b33c29bd6.r2.dev
[OK] R2 클라이언트 생성 성공
[OK] R2 버킷 접근 성공
```

### 데이터 확인
브라우저에서 열어보기:
- https://pub-cdda6824954243b49965012b33c29bd6.r2.dev/nav.json
- https://pub-cdda6824954243b49965012b33c29bd6.r2.dev/data/005930-ks.json

---

## 📊 비용 (참고)

현재 사용량 (2.5GB):
- **저장**: $0/월 (무료 티어 10GB)
- **다운로드**: $0/월 (무제한 무료)
- **API 요청**: $0/월 (무료 티어 충분)

**총 비용: $0/월** 🎉

---

## 🆘 문제 해결

### 문제: "R2 설정이 누락되었습니다"
**해결**: `.env.r2` 파일이 프로젝트 루트에 있는지 확인

### 문제: R2 업로드 실패
**해결**: 
1. API 토큰이 만료되지 않았는지 확인
2. 인터넷 연결 확인
3. 로컬 파일은 정상 저장되므로 개발 진행 가능

### 문제: 프론트엔드에서 404 에러
**해결**:
1. R2에 파일이 업로드되었는지 확인: `python scripts/upload_all_to_r2.py`
2. Public URL이 올바른지 확인: `.env.production` 파일 체크
3. 개발 모드에서 테스트: `npm run dev` (로컬 데이터 사용)

---

## 📞 지원

문제가 발생하면:
1. `python scripts/r2_config.py`로 연결 테스트
2. R2 대시보드에서 버킷 상태 확인
3. 개발 모드(`npm run dev`)에서 로컬 데이터로 테스트

---

**마이그레이션 완료! 🎉**

