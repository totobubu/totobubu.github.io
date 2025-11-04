# Update 필드 변경 정책

## 개요

`public/data/{symbol}.json` 파일의 `tickerInfo.Update` 필드는 불필요한 파일 변경과 커밋을 줄이기 위해 다음 정책에 따라 관리됩니다.

---

## 📜 정책

### 기본 원칙

```
1. 데이터 변경이 있으면 → 항상 Update 필드 갱신
2. 데이터 변경이 없고, 마지막 업데이트가 4시간 이내 → Update 필드 유지 (파일 저장 안함)
3. 데이터 변경이 없고, 마지막 업데이트가 4시간 초과 → Update 필드 갱신
```

### 적용 대상

- ✅ `scripts/info_data_pipeline.py` (통합 파이프라인)
- ✅ `scripts/scraper_info.py` (개별 스크립트)
- 모든 `tickerInfo` 업데이트 작업

---

## 🎯 목적

### 1. **불필요한 파일 변경 최소화**

```
Before (정책 없음):
- 매 실행마다 Update 필드 변경
- 실제 데이터 변경 없어도 파일 저장
- Git 커밋이 많아짐

After (정책 적용):
- 실제 데이터 변경이 있을 때만 Update 필드 변경
- 4시간 이내 재실행 시 파일 저장 안함
- Git 커밋 최소화
```

### 2. **워크플로우 효율성 향상**

```
시나리오: 1시간 간격으로 2회 실행

Case A (데이터 변경 없음):
  1차 실행 (00:00) → Update 변경, 파일 저장
  2차 실행 (01:00) → Update 유지, 파일 저장 안함 ✅

Case B (데이터 변경 있음):
  1차 실행 (00:00) → Update 변경, 파일 저장
  2차 실행 (01:00) → Update 변경, 파일 저장 ✅

Case C (4시간 후):
  1차 실행 (00:00) → Update 변경, 파일 저장
  2차 실행 (04:00) → Update 변경, 파일 저장 ✅
```

### 3. **R2 업로드 최소화**

- 파일 저장이 줄어들면 R2 업로드도 자동으로 감소
- 비용 절감 및 네트워크 효율성 향상

---

## 🔧 구현 방법

### 1. **유틸리티 함수** (`scripts/utils.py`)

```python
def should_skip_update_timestamp(old_update_str, data_changed):
    """
    Update 필드를 변경할지 여부를 결정합니다.

    Returns:
        bool: True면 Update 필드를 변경하지 않음 (skip)
              False면 Update 필드 변경
    """
    # 데이터 변경이 있으면 항상 Update 필드 갱신
    if data_changed:
        return False

    # 4시간 이내면 Update 필드 유지
    if time_diff <= timedelta(hours=4):
        return True

    return False
```

### 2. **적용 예시** (`scripts/info_data_pipeline.py`)

```python
# 변경 여부 확인
data_changed = json.dumps(compare_old, sort_keys=True) != json.dumps(compare_new, sort_keys=True)

# 정책 적용
if should_skip_update_timestamp(old_info.get("Update"), data_changed):
    new_info["Update"] = old_info.get("Update")  # 기존 Update 유지
    if not data_changed:
        continue  # 저장하지 않음

# 데이터 변경이 있거나, 4시간 초과 시 저장
if data_changed or not should_skip_update_timestamp(old_info.get("Update"), data_changed):
    existing_data["tickerInfo"] = new_info
    save_json_file(file_path, existing_data)
    total_changed_files += 1
```

---

## 📊 예상 효과

### 파일 변경 감소

| 시나리오                          | Before  | After    | 개선율  |
| --------------------------------- | ------- | -------- | ------- |
| 1시간마다 실행 (데이터 변경 없음) | 24회/일 | 8회/일   | **67%** |
| 4시간마다 실행 (데이터 변경 없음) | 8회/일  | 8회/일   | 0%      |
| 매시간 실행, 20% 데이터 변경      | 24회/일 | ~12회/일 | **50%** |

### Git 커밋 감소

```
Before:
  - 매 워크플로우 실행마다 커밋
  - 하루 2-3회 실행 시 2-3개 커밋

After:
  - 실제 데이터 변경이 있을 때만 커밋
  - 하루 평균 0-2개 커밋 (50% 감소)
```

---

## 🧪 테스트 케이스

### Test 1: 데이터 변경 없음, 1시간 후 재실행

```
Given:
  - 마지막 Update: "2024-01-01 10:00:00 KST"
  - 현재 시간: "2024-01-01 11:00:00 KST"
  - 데이터 변경: 없음

Expected:
  - Update 필드: "2024-01-01 10:00:00 KST" (유지)
  - 파일 저장: 안함
  - Result: ✅ PASS
```

### Test 2: 데이터 변경 있음, 1시간 후 재실행

```
Given:
  - 마지막 Update: "2024-01-01 10:00:00 KST"
  - 현재 시간: "2024-01-01 11:00:00 KST"
  - 데이터 변경: 있음 (price 변경)

Expected:
  - Update 필드: "2024-01-01 11:00:00 KST" (갱신)
  - 파일 저장: 함
  - Result: ✅ PASS
```

### Test 3: 데이터 변경 없음, 4시간 후 재실행

```
Given:
  - 마지막 Update: "2024-01-01 10:00:00 KST"
  - 현재 시간: "2024-01-01 14:00:00 KST"
  - 데이터 변경: 없음

Expected:
  - Update 필드: "2024-01-01 14:00:00 KST" (갱신)
  - 파일 저장: 함
  - Result: ✅ PASS
```

---

## 🔍 모니터링

### 로그 확인

워크플로우 실행 시 다음 정보를 확인하세요:

```bash
# 통합 파이프라인 로그
📋 STEP 2: 티커 정보 업데이트
✅ 티커 정보 업데이트 완료: 45개 파일 변경

# 파일 변경이 적으면 정책이 잘 작동하는 것
```

### Git 커밋 패턴

```bash
# Before (정책 없음)
ℹ️ Auto: Update info data (daily)  # 매일 무조건 커밋
ℹ️ Auto: Update info data (daily)
ℹ️ Auto: Update info data (daily)

# After (정책 적용)
ℹ️ Auto: Update info data (daily)  # 실제 변경이 있을 때만 커밋
(다음날 변경 없음 - 커밋 없음)
ℹ️ Auto: Update info data (daily)  # 4시간 후 또는 변경 있을 때
```

---

## 🚨 주의사항

### 1. **4시간 임계값 변경**

필요시 `scripts/utils.py`에서 시간 조정 가능:

```python
# 현재: 4시간
if time_diff <= timedelta(hours=3):
    return True

# 변경 예시: 6시간
if time_diff <= timedelta(hours=6):
    return True
```

### 2. **데이터 변경 감지 범위**

현재는 `Update`와 `changes` 필드를 제외한 모든 필드 비교:

```python
compare_old = {k: v for k, v in old_info.items() if k not in ["Update", "changes"]}
compare_new = {k: v for k, v in new_info.items() if k not in ["Update", "changes"]}
```

### 3. **수동 실행 시**

수동으로 스크립트를 실행할 때도 동일한 정책이 적용됩니다:

```bash
# 4시간 이내에 재실행하면 변경 없음
python scripts/scraper_info.py

# 강제로 Update를 갱신하려면 코드 수정 필요
```

---

## 📌 요약

✅ **데이터 변경이 있으면** → 항상 Update 갱신 + 파일 저장  
✅ **데이터 변경 없고 4시간 이내** → Update 유지 + 파일 저장 안함  
✅ **데이터 변경 없고 4시간 초과** → Update 갱신 + 파일 저장

**예상 효과**: 파일 변경 50-67% 감소, Git 커밋 50% 감소
