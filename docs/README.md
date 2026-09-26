# 📚 프로젝트 문서 모음

이 폴더에는 프로젝트의 모든 문서와 가이드가 카테고리별로 정리되어 있습니다.

---

## 📂 문서 구조

```
docs/
├── README.md                          # 이 파일
├── workflows/                         # 워크플로우 관련 문서
├── data-management/                   # 데이터 관리 관련 문서
├── infrastructure/                    # 인프라 설정 관련 문서
└── development/                       # 개발 참고 문서
```

---

## 🚀 워크플로우 관련 (`workflows/`)

- **[EVENT_DETECTION_WORKFLOW.md](./workflows/EVENT_DETECTION_WORKFLOW.md)** - 이벤트 감지 워크플로우

---

## 📊 데이터 관리 (`data-management/`)

### 티커 & 심볼 관리
- **[TICKER_MANAGEMENT_GUIDE.md](./data-management/TICKER_MANAGEMENT_GUIDE.md)** - 새로운 주식/ETF 추가 가이드 ⭐
- **[ADD_NEW_SYMBOLS_GUIDE.md](./data-management/ADD_NEW_SYMBOLS_GUIDE.md)** - 새 심볼 추가 스크립트 가이드

### 데이터 수집 & 업데이트
- **[MARKET_CAP_GUIDE.md](./data-management/MARKET_CAP_GUIDE.md)** - 시가총액 데이터 통합 가이드 ⭐

### 데이터 정책 & 포맷
- **[FORMAT_GUIDE.md](./data-management/FORMAT_GUIDE.md)** - Git 기반 스마트 포맷 가이드 ⭐

### 거래 데이터
- **[README_TRANSACTION_UPLOAD.md](./data-management/README_TRANSACTION_UPLOAD.md)** - 거래 내역 업로드 가이드

---

## ☁️ 인프라 설정 (`infrastructure/`)

- **[FIRESTORE_INDEX.md](./infrastructure/FIRESTORE_INDEX.md)** - Firestore 인덱스 설정
- **[WEB3FORMS_SETUP.md](./infrastructure/WEB3FORMS_SETUP.md)** - Web3Forms 설정 가이드

---

## 🔧 개발 참고 (`development/`)

- **[RATE_LIMIT_ISSUE.md](./development/RATE_LIMIT_ISSUE.md)** - Yahoo Finance Rate Limit 문제 해결 🔧
- **[mapping_process.md](./development/mapping_process.md)** - 매핑 프로세스 설명
- **[stockMappings.md](./development/stockMappings.md)** - Stock Mappings 구조

---

## 🎯 빠른 시작 가이드

### 새로운 티커 추가하기
1. [data-management/TICKER_MANAGEMENT_GUIDE.md](./data-management/TICKER_MANAGEMENT_GUIDE.md) - 티커 추가 가이드 ⭐
2. [data-management/ADD_NEW_SYMBOLS_GUIDE.md](./data-management/ADD_NEW_SYMBOLS_GUIDE.md) - 스크립트 사용법

### 데이터 수집 및 관리
1. [data-management/MARKET_CAP_GUIDE.md](./data-management/MARKET_CAP_GUIDE.md) - 시가총액 데이터
3. [data-management/README_TRANSACTION_UPLOAD.md](./data-management/README_TRANSACTION_UPLOAD.md) - 거래 데이터

### 워크플로우 운영 및 최적화
1. [data-management/FORMAT_GUIDE.md](./data-management/FORMAT_GUIDE.md) - 포맷 최적화

---

## 🎯 주요 개선사항 요약

### 워크플로우 최적화 (2025-11-05)
- ✅ **속도**: 순수 처리 시간 **57% 단축** (56분 → 24분)
- ✅ **효율성**: 통합 파이프라인으로 중복 API 호출 제거
- ✅ **비용**: GitHub Actions 사용량 **57% 절감**
- ✅ **안정성**: Git 기반 안정적 변경사항 추적

### 핵심 기능
1. **통합 파이프라인**: 5개 스크립트를 1개로 통합 (68% 단축)
2. **Git 기반 처리**: 변경된 파일만 선택적 처리 (90% 빠름)
3. **스마트 업데이트**: 데이터 변경 시에만 Update 필드 갱신

---

## 📞 문의 및 기여

문서에 대한 질문이나 개선 제안은 이슈로 등록해주세요.
