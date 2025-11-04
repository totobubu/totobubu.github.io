# R2 업로드 스크립트 가이드

## 📁 스크립트 개요

### 1. `upload_changed_to_r2.py` (⭐ 기본 사용)

**용도**: Git 변경사항 기반 빠른 업로드

```bash
python scripts/upload_changed_to_r2.py
```

**특징**:
- ⚡ **매우 빠름** (10-30초)
- Git에서 변경된 파일만 업로드
- R2 API 호출 최소화
- MD5 해시 계산 불필요

**언제 사용**:
- ✅ 일반적인 모든 경우 (기본값)
- ✅ GitHub Actions 워크플로우
- ✅ 로컬에서 스크립트 실행 후 업로드

**작동 조건**:
- Git 저장소 필요
- 변경된 파일이 Git에 의해 추적됨

---

### 2. `upload_full_sync_to_r2.py` (🔧 수동 동기화)

**용도**: R2 전체 동기화 및 검증

```bash
python scripts/upload_full_sync_to_r2.py
```

**특징**:
- 🐌 **느림** (3-15분)
- R2의 모든 파일과 비교
- 모든 파일의 MD5 해시 계산
- 누락/변경된 파일 자동 감지

**언제 사용**:
- 🆕 초기 전체 업로드
- 🔄 R2-로컬 동기화 검증 필요 시
- 🚨 R2에서 파일이 누락된 것으로 의심될 때
- 🔧 Git 히스토리 없는 환경

**작동 조건**:
- R2 인증 정보 필요
- boto3 설치 필요

---

## 🎯 사용 가이드

### 시나리오 1: 일반적인 데이터 업데이트

```bash
# 1. 스크립트 실행 (데이터 변경)
python scripts/update_dividends.py

# 2. R2 업로드
python scripts/upload_changed_to_r2.py  # ⚡ 빠름!

# 3. 커밋
git add .
git commit -m "Update dividends"
```

**예상 시간**: ~30초

---

### 시나리오 2: 초기 프로젝트 설정

```bash
# 1. 저장소 클론
git clone https://github.com/user/repo.git
cd repo

# 2. 데이터 생성
npm run generate-nav
python scripts/update_data.py

# 3. R2 전체 동기화
python scripts/upload_full_sync_to_r2.py  # 🐌 느림 (초기만)

# 4. 이후부터는 빠른 업로드 사용
python scripts/upload_changed_to_r2.py  # ⚡ 빠름!
```

**초기 시간**: ~10분  
**이후 시간**: ~30초

---

### 시나리오 3: R2 동기화 검증

```bash
# R2에 파일이 제대로 업로드되었는지 확인
python scripts/upload_full_sync_to_r2.py

# 출력 예시:
# [INFO] 누락된 파일: 0개
# [INFO] 변경된 파일: 0개
# [OK] 모든 파일이 R2에 동기화되었습니다!
```

---

### 시나리오 4: 워크플로우 실행 (자동)

```yaml
# .github/workflows/update_data.yml

- name: Update data
  run: python scripts/update_data.py

- name: Upload to R2
  run: python scripts/upload_changed_to_r2.py  # ⚡ 자동으로 빠른 방식 사용
```

---

## 📊 성능 비교

| 항목 | upload_changed | upload_full_sync |
|------|----------------|------------------|
| **R2 API 호출** | 없음 | 전체 목록 조회 |
| **MD5 해시 계산** | 없음 | 1500개 전체 |
| **변경 감지** | Git | MD5 비교 |
| **50개 파일** | ~15초 | ~3분 |
| **1500개 파일** | ~10분 | ~15분 |
| **변경 없음** | ~1초 | ~30초 |

---

## 🔧 문제 해결

### Q: "Git이 설치되어 있지 않습니다" 오류

```bash
# upload_changed_to_r2.py는 Git 필요
# 해결: upload_full_sync_to_r2.py 사용
python scripts/upload_full_sync_to_r2.py
```

### Q: 파일이 변경되었는데 업로드 안 됨

```bash
# Git이 변경사항을 추적하는지 확인
git status

# 추적되지 않은 파일이면 먼저 add
git add public/data/new-file.json

# 그 후 업로드
python scripts/upload_changed_to_r2.py
```

### Q: R2에서 파일이 누락된 것 같음

```bash
# 전체 동기화로 검증 및 복구
python scripts/upload_full_sync_to_r2.py

# 누락된 파일 자동 감지 및 업로드
```

### Q: 너무 오래 걸림

```bash
# upload_changed_to_r2.py 사용 중인지 확인
# 만약 upload_full_sync_to_r2.py를 사용 중이면 교체

# Before (느림)
python scripts/upload_full_sync_to_r2.py

# After (빠름)
python scripts/upload_changed_to_r2.py
```

---

## 🚀 권장 사항

### ✅ 기본적으로 사용
```bash
python scripts/upload_changed_to_r2.py
```

### ⚠️ 특수한 경우에만 사용
```bash
python scripts/upload_full_sync_to_r2.py
```

---

## 📝 요약

| 상황 | 사용할 스크립트 | 이유 |
|------|---------------|------|
| 일반적인 경우 | `upload_changed_to_r2.py` | 빠름 (10배) |
| 초기 업로드 | `upload_full_sync_to_r2.py` | 전체 동기화 |
| R2 검증 | `upload_full_sync_to_r2.py` | 누락 파일 감지 |
| 워크플로우 | `upload_changed_to_r2.py` | 이미 설정됨 |
| Git 없음 | `upload_full_sync_to_r2.py` | Git 불필요 |

**기억하세요**: 99%의 경우 `upload_changed_to_r2.py`를 사용하세요! 🚀

