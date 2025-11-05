# 📚 프로젝트 문서 모음

이 폴더에는 프로젝트의 모든 문서와 가이드가 정리되어 있습니다.

---

## 🚀 워크플로우 관련

- **[WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md)** - 워크플로우 개요, 통합 파이프라인, 최적화 내역 ⭐
- **[V1_V2_COMPARISON.md](./V1_V2_COMPARISON.md)** - V1 vs V2 상세 비교 (참고용, 통합 완료)
- **[DEPLOY_WORKFLOW_GUIDE.md](./DEPLOY_WORKFLOW_GUIDE.md)** - Deploy 워크플로우 & 자동 R2 업로드
- **[LOCAL_VS_GITHUB_WORKFLOWS.md](./LOCAL_VS_GITHUB_WORKFLOWS.md)** - 로컬 스크립트 vs GitHub Actions 비교 🔄

---

## 📝 Format & Update 정책

- **[FORMAT_GUIDE.md](./FORMAT_GUIDE.md)** - Git 기반 스마트 포맷 가이드 ⭐
- **[UPDATE_POLICY.md](./UPDATE_POLICY.md)** - tickerInfo Update 필드 관리 정책 (데이터 변경 시에만 갱신)

---

## ☁️ R2 (Cloudflare) 관련

- **[R2_GUIDE.md](./R2_GUIDE.md)** - R2 업로드 통합 가이드 (스크립트, 최적화, 워크플로우) ⭐

---

## 💰 시가총액 (Market Cap)

- **[MARKET_CAP_GUIDE.md](./MARKET_CAP_GUIDE.md)** - 시가총액 데이터 통합 가이드 ⭐
- **[RATE_LIMIT_ISSUE.md](./RATE_LIMIT_ISSUE.md)** - Yahoo Finance Rate Limit 문제 해결 🔧

---

## 📊 Holdings (보유 자산)

- **[README_HOLDINGS.md](./README_HOLDINGS.md)** - ETF Holdings 데이터 수집 가이드 (통합 완료)

---

## 🎫 티커 관리

- **[TICKER_MANAGEMENT_GUIDE.md](./TICKER_MANAGEMENT_GUIDE.md)** - 새로운 주식/ETF 추가 가이드 ⭐

---

## 💼 거래 데이터

- **[README_TRANSACTION_UPLOAD.md](./README_TRANSACTION_UPLOAD.md)** - 거래 내역 업로드 가이드

---

## 🔍 기타

- **[FINAL_CHECK.md](./FINAL_CHECK.md)** - 최종 점검 체크리스트

---

## 📂 문서 카테고리별 바로가기

### 🎯 빠른 시작
처음 프로젝트를 시작하는 경우:
1. [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) - 워크플로우 이해 ⭐
2. [R2_GUIDE.md](./R2_GUIDE.md) - R2 업로드 이해
3. [UPDATE_POLICY.md](./UPDATE_POLICY.md) - 업데이트 정책 이해

### ⚡ 최적화 가이드
성능 개선에 관심이 있는 경우:
1. [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) - 워크플로우 최적화 ⭐
2. [V1_V2_COMPARISON.md](./V1_V2_COMPARISON.md) - V1 vs V2 비교 (참고용)
3. [FORMAT_GUIDE.md](./FORMAT_GUIDE.md) - 포맷 최적화
4. [R2_GUIDE.md](./R2_GUIDE.md) - 업로드 최적화

### 🔧 운영 가이드
일상적인 운영과 관리:
1. [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) - 워크플로우 운영
2. [R2_GUIDE.md](./R2_GUIDE.md) - R2 업로드 관리
3. [UPDATE_POLICY.md](./UPDATE_POLICY.md) - 업데이트 규칙

### 📊 데이터 관리
데이터 수집 및 관리:
1. [TICKER_MANAGEMENT_GUIDE.md](./TICKER_MANAGEMENT_GUIDE.md) - 티커 추가 ⭐
2. [MARKET_CAP_GUIDE.md](./MARKET_CAP_GUIDE.md) - 시가총액 데이터
3. [README_HOLDINGS.md](./README_HOLDINGS.md) - Holdings 데이터
4. [README_TRANSACTION_UPLOAD.md](./README_TRANSACTION_UPLOAD.md) - 거래 데이터

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
4. **Holdings 분리**: 별도 워크플로우로 분리 (주 1회 실행)

---

## 📞 문의 및 기여

문서에 대한 질문이나 개선 제안은 이슈로 등록해주세요.

