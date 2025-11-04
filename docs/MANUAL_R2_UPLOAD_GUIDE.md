# Manual R2 Upload 워크플로우 가이드

## 📋 개요

GitHub Actions에서 수동으로 R2에 파일을 업로드할 수 있는 워크플로우입니다.
**3가지 모드**를 선택할 수 있습니다.

---

## 🎯 3가지 업로드 모드

### 1. ⚡ **Changed Files** (변경된 파일만 - 기본값)

**가장 빠른 방식!** Git 변경사항 기반 업로드

```
예상 시간: 10-30초
용도: 일반적인 모든 경우
```

**언제 사용**:
- ✅ 기본적으로 이 모드 사용
- ✅ 일반적인 데이터 업데이트 후
- ✅ 빠른 업로드가 필요할 때

---

### 2. 🔧 **Full Sync** (전체 동기화)

R2와 로컬을 전체 비교하여 동기화

```
예상 시간: 3-15분
용도: 초기 설정, R2 검증
```

**언제 사용**:
- 🆕 프로젝트 초기 설정
- 🔍 R2 파일 누락 의심 시
- 🚨 전체 검증이 필요할 때

---

### 3. 🎯 **Specific Files** (특정 파일만)

원하는 파일만 선택해서 업로드

```
예상 시간: 5-10초
용도: 특정 파일만 업데이트
```

**언제 사용**:
- 📄 nav.json만 업로드
- 📊 특정 티커 파일만 업로드
- 🎨 로고 파일만 업로드

---

## 🚀 사용 방법

### GitHub Actions에서 실행

1. **GitHub 저장소** → **Actions** 탭 이동
2. 왼쪽에서 **"Manual Upload to R2"** 선택
3. **"Run workflow"** 버튼 클릭
4. **옵션 선택**:

---

### 모드 1: Changed Files (⚡ 권장)

```yaml
업로드 모드: changed
특정 파일: (비워둠)
```

**실행 후**:
```
📤 [모드: 변경된 파일만] Git 기반 빠른 업로드...

[1/3] Git 변경사항 확인 중...
   ✓ Git 변경된 파일: 50개

[2/3] 업로드 대상 필터링 중...
   ✓ 업로드 대상: 50개
   
   [업로드 대상 상세]
     - data: 48개
     - nav.json: 1개
     - sidebar: 1개

[3/3] R2에 업로드 중...
Uploading: 100%|████████████| 50/50 [00:15<00:00]

✅ 성공: 50개
⏱️  총 소요 시간: 15초
```

---

### 모드 2: Full Sync (🔧 신중히 사용)

```yaml
업로드 모드: full_sync
특정 파일: (비워둠)
```

**실행 후**:
```
📤 [모드: 전체 동기화] R2와 로컬 전체 비교 & 업로드...

[1/5] public/data 폴더 비교 중...
[OK] 로컬에 1500개 파일 발견
[OK] R2에 1450개 파일 발견
[INFO] 누락된 파일: 50개
[INFO] 변경된 파일: 20개
[INFO] 업로드 대상: 70개

Uploading files: 100%|████████████| 70/70 [02:30<00:00]

✅ 전체 동기화 완료
⏱️  총 소요 시간: 5분
```

---

### 모드 3: Specific Files (🎯 정밀 타겟)

#### 예시 1: nav.json만 업로드

```yaml
업로드 모드: specific
특정 파일: public/nav.json
```

#### 예시 2: 여러 파일 업로드

```yaml
업로드 모드: specific
특정 파일: public/nav.json public/calendar-events.json public/popularity.json
```

#### 예시 3: 특정 티커들만 업로드

```yaml
업로드 모드: specific
특정 파일: public/data/aapl.json public/data/tsla.json public/data/nvda.json
```

#### 예시 4: 사이드바 파일들 업로드

```yaml
업로드 모드: specific
특정 파일: public/sidebar/sidebar-tickers-us-etfs.json public/sidebar/sidebar-tickers-us-stocks.json
```

**실행 후**:
```
📤 [모드: 특정 파일] 지정된 파일만 업로드...

[1/2] 업로드 대상 확인 중...
   ✓ 업로드 대상: 3개
   
   [업로드 대상 상세]
     - nav.json: 1개
     - data: 2개

[2/2] R2에 업로드 중...
Uploading: 100%|████████████| 3/3 [00:03<00:00]

✅ 성공: 3개
⏱️  총 소요 시간: 3초
```

---

## 📊 모드 비교표

| 모드 | 속도 | 용도 | 언제 사용 |
|------|------|------|----------|
| **Changed** ⚡ | 매우 빠름 (10-30초) | 일반 업로드 | 기본값, 99%의 경우 |
| **Full Sync** 🔧 | 느림 (3-15분) | 전체 동기화 | 초기 설정, 검증 필요 시 |
| **Specific** 🎯 | 매우 빠름 (5-10초) | 특정 파일만 | nav.json, 로고 등 개별 파일 |

---

## 💡 실제 사용 시나리오

### 시나리오 1: 일반적인 데이터 업데이트

```
상황: update_dividends.py 실행 후 R2에 반영
선택: Changed Files ⚡
결과: 15초 만에 완료
```

### 시나리오 2: 프로젝트 초기 설정

```
상황: 새 프로젝트 클론 후 전체 업로드
선택: Full Sync 🔧
결과: 10분 소요 (1500개 파일)
```

### 시나리오 3: nav.json만 업데이트

```
상황: nav.json 수동 수정 후 빠르게 반영
선택: Specific Files 🎯
입력: public/nav.json
결과: 3초 만에 완료
```

### 시나리오 4: 로고 이미지 추가

```
상황: 새 로고 파일 추가
선택: Specific Files 🎯
입력: public/logos/aapl.png public/logos/tsla.png
결과: 5초 만에 완료
```

### 시나리오 5: R2 파일 누락 의심

```
상황: 사용자가 파일이 안 보인다고 제보
선택: Full Sync 🔧
결과: 5분 소요, 누락된 50개 파일 자동 업로드
```

---

## 🎨 GitHub Actions UI 예시

```
╔════════════════════════════════════════╗
║  Run workflow                          ║
╠════════════════════════════════════════╣
║                                        ║
║  Use workflow from                     ║
║  Branch: main               ▼          ║
║                                        ║
║  업로드 모드 *                         ║
║  ○ changed (기본값)        ▼          ║
║  ○ full_sync                           ║
║  ○ specific                            ║
║                                        ║
║  특정 파일                             ║
║  (모드가 specific일 때만 입력)        ║
║  ┌────────────────────────────────┐   ║
║  │ public/nav.json                │   ║
║  └────────────────────────────────┘   ║
║                                        ║
║  [ Run workflow ]                      ║
║                                        ║
╚════════════════════════════════════════╝
```

---

## 🔍 로컬에서 테스트

워크플로우와 동일한 스크립트를 로컬에서도 사용 가능:

### Changed Files 모드
```bash
python scripts/upload_changed_to_r2.py
```

### Full Sync 모드
```bash
python scripts/upload_full_sync_to_r2.py
```

### Specific Files 모드
```bash
# 단일 파일
python scripts/upload_specific_to_r2.py public/nav.json

# 여러 파일
python scripts/upload_specific_to_r2.py public/nav.json public/data/aapl.json

# Glob 패턴 (따옴표 필수)
python scripts/upload_specific_to_r2.py "public/data/0*.json"
python scripts/upload_specific_to_r2.py "public/sidebar/*.json"
```

---

## ⚠️ 주의사항

### 1. Changed Files 모드
- Git 히스토리에 의존
- 커밋 전에 실행해야 변경사항 감지
- Git이 없는 환경에서는 작동 안 함

### 2. Full Sync 모드
- 시간이 오래 걸림 (3-15분)
- 모든 파일 MD5 해시 계산
- 불필요하게 자주 사용하지 말 것

### 3. Specific Files 모드
- 파일 경로는 `public/` 포함
- 여러 파일은 **공백**으로 구분
- 존재하지 않는 파일은 경고만 출력

---

## 🎯 권장 사용 패턴

```
일상적 업로드     → Changed Files ⚡ (99%)
초기 설정         → Full Sync 🔧 (1회)
개별 파일 수정    → Specific Files 🎯 (가끔)
R2 검증/복구      → Full Sync 🔧 (필요시)
```

---

## 📌 요약

| 원하는 작업 | 선택할 모드 | 예상 시간 |
|-------------|-------------|----------|
| 일반 업로드 | Changed ⚡ | 15초 |
| 전체 업로드 | Full Sync 🔧 | 10분 |
| nav.json만 | Specific 🎯 | 3초 |
| 특정 티커만 | Specific 🎯 | 5초 |
| R2 검증 | Full Sync 🔧 | 5분 |

**대부분의 경우**: Changed Files ⚡ 사용!

