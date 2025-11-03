# 선택사항: public/data를 Git에서 제외하기

## ⚠️ 주의사항

이 작업은 선택사항입니다. 다음과 같은 변경이 발생합니다:

### 장점
- ✅ Git 레포지토리 크기 대폭 감소 (2.5GB 제거)
- ✅ git clone, git pull 속도 향상
- ✅ GitHub Actions에서도 정상 작동 (R2에서 다운로드)

### 단점
- ❌ 로컬 개발 시 데이터 파일을 R2에서 다운로드해야 함
- ❌ 새로운 개발자가 clone 후 초기 설정 필요

---

## 🚀 설정 방법

### 1. .gitignore에 추가

```bash
# public/data 폴더를 Git에서 제외
public/data/*.json
!public/data/.gitkeep
```

### 2. 초기 데이터 다운로드 스크립트 생성

새로운 개발자나 클론 후 데이터를 다운로드할 수 있도록:

```python
# scripts/download_data_from_r2.py
# R2에서 로컬로 데이터 다운로드
```

### 3. GitHub Actions 수정

워크플로우 시작 시 R2에서 데이터 다운로드:

```yaml
- name: Download data from R2
  run: python scripts/download_data_from_r2.py
```

---

## 💡 권장사항

**현재는 그대로 두는 것을 권장합니다:**

1. 개발 환경에서 로컬 파일을 사용하는 것이 편리
2. Git에 데이터가 있어서 히스토리 추적 가능
3. R2가 잘 작동하는지 확인 후 나중에 제거 가능

**나중에 제거를 원하면:**
- 위의 설정 방법대로 진행
- 또는 언제든 요청하시면 도와드리겠습니다!

