# scripts/upload_missing_to_r2.py
"""
R2에 누락된 파일만 찾아서 업로드
"""
import os
from pathlib import Path
from tqdm import tqdm
from r2_config import upload_file_to_r2, get_r2_client, load_r2_config


def get_r2_files(prefix=""):
    """
    R2 버킷에서 파일 목록 가져오기

    Args:
        prefix: 검색할 접두사 (예: 'data/')

    Returns:
        set: R2에 있는 파일 키 목록
    """
    try:
        s3_client, bucket_name = get_r2_client()

        print(f"[INFO] R2에서 '{prefix}' 파일 목록 조회 중...")

        files = set()
        paginator = s3_client.get_paginator("list_objects_v2")

        for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
            if "Contents" in page:
                for obj in page["Contents"]:
                    files.add(obj["Key"])

        print(f"[OK] R2에 {len(files)}개 파일 발견")
        return files

    except Exception as e:
        print(f"[ERROR] R2 파일 목록 조회 실패: {e}")
        return set()


def get_local_files(local_dir, file_pattern="*.json"):
    """
    로컬 디렉토리의 파일 목록 가져오기

    Args:
        local_dir: 로컬 디렉토리 경로
        file_pattern: 파일 패턴 (기본값: "*.json", "*"는 모든 파일)

    Returns:
        dict: {r2_key: local_file_path}
    """
    local_path = Path(local_dir)
    if not local_path.exists():
        print(f"[ERROR] 디렉토리를 찾을 수 없습니다: {local_dir}")
        return {}

    files = {}
    
    # 모든 파일을 찾을지, 특정 패턴만 찾을지 결정
    if file_pattern == "*":
        file_list = local_path.rglob("*")
        file_list = [f for f in file_list if f.is_file()]
    else:
        file_list = local_path.rglob(file_pattern)
    
    for file_path in file_list:
        # R2 키 생성
        path_str = str(file_path).replace("\\", "/")

        if "public/" in path_str:
            r2_key = path_str.split("public/", 1)[1]
        else:
            r2_key = file_path.name

        files[r2_key] = str(file_path)

    print(f"[OK] 로컬에 {len(files)}개 파일 발견")
    return files


def upload_missing_files():
    """누락된 파일만 업로드"""
    print("=" * 60)
    print("  R2 누락 파일 업로드 스크립트")
    print("=" * 60)

    try:
        config = load_r2_config()
        print(f"[OK] R2 버킷: {config['bucket_name']}")
        print(f"[OK] Public URL: {config['public_url']}\n")
    except Exception as e:
        print(f"[ERROR] R2 설정을 로드할 수 없습니다: {e}")
        return

    # 1. public/data 폴더 체크
    print("[1/4] public/data 폴더 비교 중...")
    r2_data_files = get_r2_files("data/")
    local_data_files = get_local_files("public/data")

    # 누락된 파일 찾기
    missing_data = []
    for r2_key, local_path in local_data_files.items():
        if r2_key not in r2_data_files:
            missing_data.append((r2_key, local_path))

    print(f"[INFO] 누락된 파일: {len(missing_data)}개\n")

    # 누락된 파일 업로드
    if missing_data:
        success_count = 0
        fail_count = 0

        for r2_key, local_path in tqdm(missing_data, desc="Uploading missing files"):
            if upload_file_to_r2(local_path, r2_key):
                success_count += 1
            else:
                fail_count += 1
                tqdm.write(f"[FAIL] {r2_key}")

        print(f"\n   -> 성공: {success_count}, 실패: {fail_count}")
    else:
        print("   -> 누락된 파일 없음")

    # 2. nav.json 체크
    print("\n[2/4] nav.json 확인 중...")
    r2_files = get_r2_files()

    if "nav.json" not in r2_files and os.path.exists("public/nav.json"):
        print("   -> nav.json 업로드 중...")
        if upload_file_to_r2("public/nav.json", "nav.json"):
            print("   -> 성공")
        else:
            print("   -> 실패")
    else:
        print("   -> 이미 존재")

    # 3. sidebar 폴더 체크
    print("\n[3/4] sidebar 폴더 확인 중...")
    if os.path.exists("public/sidebar"):
        r2_sidebar_files = get_r2_files("sidebar/")
        local_sidebar_files = get_local_files("public/sidebar")

        missing_sidebar = []
        for r2_key, local_path in local_sidebar_files.items():
            if r2_key not in r2_sidebar_files:
                missing_sidebar.append((r2_key, local_path))

        if missing_sidebar:
            print(f"   -> 누락된 파일: {len(missing_sidebar)}개")
            for r2_key, local_path in missing_sidebar:
                if upload_file_to_r2(local_path, r2_key):
                    print(f"   -> {r2_key} 업로드 성공")
                else:
                    print(f"   -> {r2_key} 업로드 실패")
        else:
            print("   -> 누락된 파일 없음")
    else:
        print("   -> 폴더 없음")

    # 4. calendar-events.json 체크
    print("\n[4/5] calendar-events.json 확인 중...")
    if "calendar-events.json" not in r2_files and os.path.exists(
        "public/calendar-events.json"
    ):
        print("   -> calendar-events.json 업로드 중...")
        if upload_file_to_r2("public/calendar-events.json", "calendar-events.json"):
            print("   -> 성공")
        else:
            print("   -> 실패")
    else:
        print("   -> 이미 존재")

    # 5. logos 폴더 체크
    print("\n[5/5] logos 폴더 확인 중...")
    if os.path.exists("public/logos"):
        r2_logos_files = get_r2_files("logos/")
        local_logos_files = get_local_files("public/logos", "*")  # 모든 파일

        missing_logos = []
        for r2_key, local_path in local_logos_files.items():
            if r2_key not in r2_logos_files:
                missing_logos.append((r2_key, local_path))

        if missing_logos:
            print(f"   -> 누락된 파일: {len(missing_logos)}개")
            success_logo = 0
            fail_logo = 0
            for r2_key, local_path in tqdm(missing_logos, desc="Uploading logos"):
                if upload_file_to_r2(local_path, r2_key):
                    success_logo += 1
                else:
                    fail_logo += 1
                    tqdm.write(f"[FAIL] {r2_key}")
            print(f"   -> 성공: {success_logo}, 실패: {fail_logo}")
        else:
            print("   -> 누락된 파일 없음")
    else:
        print("   -> 폴더 없음")

    # 최종 결과
    print("\n" + "=" * 60)
    print("  업로드 완료!")
    print("=" * 60)

    # 최종 파일 수 확인
    print("\n[최종 확인]")
    final_r2_files = get_r2_files()
    print(f"R2 총 파일 수: {len(final_r2_files)}개")
    print(f"로컬 data 파일 수: {len(local_data_files)}개")

    if len(final_r2_files) >= len(local_data_files):
        print("\n[OK] 모든 파일이 R2에 업로드되었습니다!")
        print(f"\n예시 URL:")
        print(f"  - {config['public_url']}/nav.json")
        print(f"  - {config['public_url']}/data/005930-ks.json")
    else:
        missing_count = len(local_data_files) - len(
            [k for k in final_r2_files if k.startswith("data/")]
        )
        print(f"\n[WARNING] 여전히 {missing_count}개 파일이 누락되어 있을 수 있습니다.")


if __name__ == "__main__":
    upload_missing_files()
