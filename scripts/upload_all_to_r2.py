# scripts/upload_all_to_r2.py
"""
기존 public/ 폴더의 모든 JSON 파일을 R2로 일괄 업로드
"""
import os
from pathlib import Path
from tqdm import tqdm
from r2_config import upload_file_to_r2, load_r2_config

def upload_directory_to_r2(local_dir, r2_prefix=""):
    """
    디렉토리의 모든 JSON 파일을 R2로 업로드
    
    Args:
        local_dir: 로컬 디렉토리 경로
        r2_prefix: R2 키의 접두사
    """
    local_path = Path(local_dir)
    if not local_path.exists():
        print(f"[ERROR] 디렉토리를 찾을 수 없습니다: {local_dir}")
        return 0, 0
    
    # 모든 JSON 파일 찾기
    json_files = list(local_path.rglob("*.json"))
    
    if not json_files:
        print(f"[INFO] {local_dir}에 JSON 파일이 없습니다.")
        return 0, 0
    
    success_count = 0
    fail_count = 0
    
    print(f"\n[INFO] {len(json_files)}개의 JSON 파일을 업로드합니다...")
    
    for file_path in tqdm(json_files, desc="Uploading to R2"):
        # R2 키 생성: public/ 이후 경로 사용
        path_str = str(file_path).replace("\\", "/")
        
        # public/ 이후 경로 추출
        if "public/" in path_str:
            r2_key = path_str.split("public/", 1)[1]
        else:
            # 절대 경로인 경우 파일명만 사용
            r2_key = os.path.join(r2_prefix, file_path.name).replace("\\", "/")
        
        # R2에 업로드
        if upload_file_to_r2(str(file_path), r2_key):
            success_count += 1
        else:
            fail_count += 1
            tqdm.write(f"[FAIL] {file_path.name}")
    
    return success_count, fail_count


def main():
    print("=" * 60)
    print("  R2 일괄 업로드 스크립트")
    print("=" * 60)
    
    try:
        # R2 설정 확인
        config = load_r2_config()
        print(f"[OK] R2 버킷: {config['bucket_name']}")
        print(f"[OK] Public URL: {config['public_url']}")
    except Exception as e:
        print(f"[ERROR] R2 설정을 로드할 수 없습니다: {e}")
        return
    
    total_success = 0
    total_fail = 0
    
    # 1. public/data 폴더 업로드
    print("\n[1/4] public/data 폴더 업로드 중...")
    success, fail = upload_directory_to_r2("public/data")
    total_success += success
    total_fail += fail
    print(f"   -> 성공: {success}, 실패: {fail}")
    
    # 2. public/nav.json 업로드
    print("\n[2/4] public/nav.json 업로드 중...")
    if os.path.exists("public/nav.json"):
        if upload_file_to_r2("public/nav.json", "nav.json"):
            total_success += 1
            print("   -> 성공")
        else:
            total_fail += 1
            print("   -> 실패")
    else:
        print("   -> 파일 없음")
    
    # 3. public/sidebar 폴더 업로드
    print("\n[3/4] public/sidebar 폴더 업로드 중...")
    if os.path.exists("public/sidebar"):
        success, fail = upload_directory_to_r2("public/sidebar")
        total_success += success
        total_fail += fail
        print(f"   -> 성공: {success}, 실패: {fail}")
    else:
        print("   -> 폴더 없음")
    
    # 4. public/calendar-events.json 업로드
    print("\n[4/4] public/calendar-events.json 업로드 중...")
    if os.path.exists("public/calendar-events.json"):
        if upload_file_to_r2("public/calendar-events.json", "calendar-events.json"):
            total_success += 1
            print("   -> 성공")
        else:
            total_fail += 1
            print("   -> 실패")
    else:
        print("   -> 파일 없음")
    
    # 결과 출력
    print("\n" + "=" * 60)
    print(f"  업로드 완료!")
    print(f"  총 성공: {total_success} 파일")
    print(f"  총 실패: {total_fail} 파일")
    print("=" * 60)
    
    if total_success > 0:
        print(f"\n[OK] 데이터가 R2에 업로드되었습니다!")
        print(f"[OK] Public URL: {config['public_url']}")
        print(f"\n예시 URL:")
        print(f"  - {config['public_url']}/nav.json")
        print(f"  - {config['public_url']}/data/005930-ks.json")


if __name__ == "__main__":
    main()

