# 📊 토스 증권 거래내역서 자동 등록 시스템

## 🎯 개요

토스 증권 거래내역서 PDF를 업로드하면 자동으로 계좌와 자산을 등록하는 시스템입니다.

## 🔄 전체 플로우

```
1. 사용자가 "거래내역서 업로드" 버튼 클릭
   ↓
2. 증권사 선택 (토스증권, KB증권 등)
   ↓
3. PDF 파일 업로드
   ↓
4. Python 스크립트로 PDF 파싱
   ↓
5. 계좌번호 자동 추출 및 계좌 등록
   ↓
6. 종목명 매핑 (토스 종목명 → 시스템 티커)
   ↓
7. 거래내역을 자산으로 등록
   ↓
8. 완료!
```

## 📁 파일 구조

### 1. 컴포넌트

#### `src/components/asset/BrokerageUploadDialog.vue`
- **역할**: 증권사 선택 및 PDF 업로드
- **3단계 구성**:
  - Step 1: 증권사 선택
  - Step 2: PDF 파일 업로드
  - Step 3: 추출된 계좌 정보 확인

#### `src/components/asset/StockMappingDialog.vue`
- **역할**: 토스 종목명을 시스템 티커와 매핑
- **특징**:
  - 자동 종목 검색
  - 매핑 정보는 Firestore에 공유 저장
  - A 사용자가 매핑하면 B 사용자는 확인만 필요

### 2. API

#### `api/parsePdfTransaction.js`
- **역할**: PDF 파일을 받아서 파싱
- **지원 증권사**: 토스증권
- **처리 과정**:
  1. formidable로 파일 파싱
  2. Python 스크립트 호출
  3. JSON 결과 반환

### 3. Python 스크립트

#### `scripts/extract_toss_transactions.py`
- **역할**: 토스 증권 PDF에서 거래 데이터 추출
- **추출 정보**:
  - 계좌번호, 발급번호, 거래 기간
  - 거래 내역 (날짜, 종목명, 수량, 단가 등)
- **모드**:
  - API 모드: JSON만 출력
  - 로컬 모드: 통계 및 샘플 출력

### 4. Composables

#### `src/composables/useStockMapping.js`
- **역할**: 종목명 매핑 관리
- **Firestore 구조**:
```javascript
stockMappings/{brokerage}_{stockName}/
  - brokerage: "toss"
  - brokerageStockName: "일드맥스 M7 옵션 인컴 ETF"
  - brokerageTicker: "US88636J6423"
  - systemTicker: "YMAG"
  - stockInfo: { name, exchange }
  - createdAt: timestamp
  - createdBy: userId
```

- **주요 함수**:
  - `getStockMapping()`: 매핑 조회
  - `saveStockMapping()`: 매핑 저장 (공용)
  - `deleteStockMapping()`: 매핑 삭제
  - `searchSymbol()`: 티커 검색
  - `batchGetStockMappings()`: 배치 조회

### 5. 통합

#### `src/pages/AssetView.vue`
- **추가된 기능**:
  - "거래내역서 업로드" 버튼
  - `handleTransactionUploadComplete()`: 계좌 자동 등록
  - `handleMappingComplete()`: 거래내역을 자산으로 등록

## 🔐 Firestore 데이터 구조

### 사용자 계좌 구조
```
userAssets/{userId}/familyMembers/{memberId}/
  brokerages/{brokerageId}/
    - name: "토스증권"
    accounts/{accountId}/
      - name: "미국주식 계좌"
      - accountNumber: "130-01-006341"
      assets/{assetId}/
        - type: "주식"
        - symbol: "YMAG"
        - amount: 184
        - currency: "USD"
        - notes: "일드맥스 M7 옵션 인컴 ETF\n자동 등록됨"
```

### 공유 매핑 구조
```
stockMappings/{mappingId}/
  - brokerage: "toss"
  - brokerageStockName: "일드맥스 M7 옵션 인컴 ETF"
  - brokerageTicker: "US88636J6423"
  - systemTicker: "YMAG"
  - stockInfo: { name, exchange }
  - createdAt: timestamp
  - createdBy: userId
  - updatedAt: timestamp
```

## 🚀 사용 방법

### 1. 사전 준비
```bash
# Python 패키지 설치
pip install pdfplumber tabulate

# Node 패키지 설치
npm install formidable
```

### 2. PDF 업로드
1. 자산관리 페이지에서 가족 구성원 선택
2. "거래내역서 업로드" 버튼 클릭
3. "토스증권" 선택
4. PDF 파일 업로드
5. 추출된 계좌 정보 확인 후 "등록하기"

### 3. 종목명 매핑
1. 자동으로 종목명 매핑 화면 표시
2. 각 종목에 대해 시스템 티커 검색
3. 올바른 티커 선택 후 "매핑"
4. 모든 종목 매핑 완료 후 "완료"

### 4. 완료
- 자산 목록에서 자동 등록된 자산 확인
- TreeTable에서 계층 구조 확인

## 🛠️ 개발자 가이드

### 새로운 증권사 추가하기

1. **파싱 스크립트 작성**
```python
# scripts/extract_{brokerage}_transactions.py
def extract_transactions_from_pdf(pdf_path):
    # PDF 파싱 로직
    return {
        'metadata': {...},
        'transactions': [...]
    }
```

2. **API 핸들러 추가**
```javascript
// api/parsePdfTransaction.js
case 'kb':
    result = await parseKbPdf(file.filepath);
    break;
```

3. **증권사 옵션 추가**
```javascript
// src/components/asset/BrokerageUploadDialog.vue
const brokerageOptions = [
    { label: '토스증권', value: 'toss' },
    { label: 'KB증권', value: 'kb' },  // 추가
];
```

## 📊 추출 가능한 데이터

### 토스증권 거래내역서
- ✅ 계좌번호
- ✅ 발급번호
- ✅ 거래 기간
- ✅ 거래 일자
- ✅ 거래 구분 (구매/판매)
- ✅ 종목명 (한글)
- ✅ 종목 티커 (US...)
- ✅ 환율
- ✅ 거래 수량
- ✅ 거래 대금 (원화/달러)
- ✅ 단가 (원화/달러)
- ✅ 수수료, 제세금
- ✅ 잔고, 잔액

## 🎨 주요 특징

### 1. 자동 계좌 등록
- PDF에서 추출한 계좌번호로 자동 생성
- 증권사가 없으면 자동으로 추가
- 계좌 이름은 사용자가 수정 가능

### 2. 종목명 매핑 공유
- Firestore에 공용 컬렉션으로 저장
- A 사용자가 매핑하면 B 사용자도 활용
- 매핑 정보는 언제든 수정/삭제 가능

### 3. 거래내역 자동 등록
- 종목별로 그룹화하여 자산 등록
- 총 보유 수량 자동 계산
- 거래 메모에 원본 종목명 기록

### 4. 에러 처리
- 파싱 실패 시 사용자 친화적 메시지
- 매핑 스킵 가능 (나중에 수동 등록)
- 부분 실패 시 성공한 항목만 등록

## 🐛 트러블슈팅

### PDF 파싱 실패
- Python이 설치되어 있는지 확인
- pdfplumber 패키지가 설치되어 있는지 확인
- PDF 파일 형식이 올바른지 확인 (스캔 PDF는 지원 안함)

### 종목 검색 안됨
- searchSymbol API가 정상 작동하는지 확인
- 정확한 티커 또는 회사명으로 검색

### 자산 등록 실패
- Firestore 권한 확인
- 네트워크 연결 확인
- 브라우저 콘솔에서 에러 메시지 확인

## 📝 향후 개선 사항

- [ ] 다른 증권사 지원 (KB, 미래에셋, 삼성 등)
- [ ] 배당 내역 자동 등록
- [ ] 매도 거래 처리 (수량 차감)
- [ ] 거래 히스토리 관리
- [ ] Excel 파일 지원
- [ ] CSV 파일 지원
- [ ] 자동 매핑 추천 (AI 활용)

## 🙏 감사의 말

이 기능은 사용자의 자산 관리 편의성을 높이기 위해 만들어졌습니다.
피드백과 개선 제안은 언제든 환영합니다!

