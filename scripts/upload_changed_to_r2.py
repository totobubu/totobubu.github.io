#!/usr/bin/env python3
# scripts/upload_changed_to_r2.py
"""
Git 변경사항 기반 R2 업로드 (초고속 버전)
- R2 파일 목록 조회 불필요
- 해시 계산 불필요
- Git에서 변경된 파일만 바로 업로드
"""

import os
import subprocess
from pathlib import Path
from tqdm import tqdm
from r2_helper import upload_file_to_r2, load_r2_config, R2_AVAILABLE


def get_git_changed_files():
    """
    Git에서 변경된 파일 목록 가져오기
    
    Returns:
        list: 변경된 파일 경로 목록
    """
    try:
        # git status --porcelain으로 변경된 파일 가져오기
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            check=True
        )
        
        changed_files = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            
            # 상태 코드와 파일명 분리
            # 예: " M public/data/aapl.json" → "public/data/aapl.json"
            #     "?? public/data/new.json" → "public/data/new.json"
            parts = line.strip().split(maxsplit=1)
            if len(parts) == 2:
                status_code = parts[0]
                file_path = parts[1]
                
                # 삭제된 파일은 제외 (D)
                if "D" not in status_code:
                    changed_files.append(file_path)
        
        return changed_files
    
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Git 명령 실행 실패: {e}")
        return []
    except FileNotFoundError:
        print("[ERROR] Git이 설치되어 있지 않습니다.")
        return []


def filter_public_files(file_paths):
    """
    public/ 폴더 내의 파일만 필터링하고 R2 키로 변환
    
    Args:
        file_paths: 파일 경로 목록
    
    Returns:
        list: [(로컬 경로, R2 키)] 튜플 목록
    """
    upload_targets = []
    
    for file_path in file_paths:
        # Windows/Linux 경로 처리
        file_path = file_path.replace("\\", "/")
        
        # public/ 폴더 내의 파일만 처리
        if "public/" in file_path:
            # 파일이 실제로 존재하는지 확인
            if not os.path.exists(file_path):
                continue
            
            # R2 키 생성: "public/data/aapl.json" → "data/aapl.json"
            r2_key = file_path.split("public/", 1)[1]
            upload_targets.append((file_path, r2_key))
    
    return upload_targets


def upload_changed_files():
    """Git에서 변경된 파일만 R2에 업로드"""
    print("=" * 70)
    print("  R2 업로드 (Git 변경사항 기반 - 초고속)")
    print("=" * 70)
    
    if not R2_AVAILABLE:
        print("[WARNING] boto3가 설치되지 않았습니다. R2 업로드를 건너뜁니다.")
        return
    
    try:
        config = load_r2_config()
        print(f"[OK] R2 버킷: {config['bucket_name']}")
        print(f"[OK] Public URL: {config['public_url']}\n")
    except Exception as e:
        print(f"[ERROR] R2 설정을 로드할 수 없습니다: {e}")
        return
    
    # 1. Git에서 변경된 파일 가져오기
    print("[1/3] Git 변경사항 확인 중...")
    changed_files = get_git_changed_files()
    print(f"   ✓ Git 변경된 파일: {len(changed_files)}개")
    
    if not changed_files:
        print("\n[OK] 변경된 파일이 없습니다. 업로드 건너뜀.")
        return
    
    # 2. public/ 폴더 내의 파일만 필터링
    print("\n[2/3] 업로드 대상 필터링 중...")
    upload_targets = filter_public_files(changed_files)
    print(f"   ✓ 업로드 대상: {len(upload_targets)}개")
    
    if not upload_targets:
        print("\n[OK] public/ 폴더에 변경된 파일이 없습니다.")
        return
    
    # 파일 타입별 개수 표시
    file_types = {}
    for _, r2_key in upload_targets:
        if r2_key.startswith("data/"):
            file_types["data"] = file_types.get("data", 0) + 1
        elif r2_key.startswith("sidebar/"):
            file_types["sidebar"] = file_types.get("sidebar", 0) + 1
        elif r2_key.startswith("logos/"):
            file_types["logos"] = file_types.get("logos", 0) + 1
        elif r2_key == "nav.json":
            file_types["nav.json"] = 1
        elif r2_key == "calendar-events.json":
            file_types["calendar-events.json"] = 1
        else:
            file_types["기타"] = file_types.get("기타", 0) + 1
    
    print("\n   [업로드 대상 상세]")
    for file_type, count in sorted(file_types.items()):
        print(f"     - {file_type}: {count}개")
    
    # 3. 파일 업로드
    print("\n[3/3] R2에 업로드 중...")
    success_count = 0
    fail_count = 0
    
    for local_path, r2_key in tqdm(upload_targets, desc="Uploading"):
        try:
            if upload_file_to_r2(local_path, r2_key):
                success_count += 1
            else:
                fail_count += 1
                tqdm.write(f"   [FAIL] {r2_key}")
        except Exception as e:
            fail_count += 1
            tqdm.write(f"   [ERROR] {r2_key}: {e}")
    
    # 결과 출력
    print("\n" + "=" * 70)
    print("  업로드 완료!")
    print("=" * 70)
    print(f"✅ 성공: {success_count}개")
    if fail_count > 0:
        print(f"❌ 실패: {fail_count}개")
    print(f"\n💡 예시 URL:")
    
    # 예시 URL 출력 (첫 3개 파일)
    for i, (_, r2_key) in enumerate(upload_targets[:3]):
        print(f"   - {config['public_url']}/{r2_key}")
    
    if len(upload_targets) > 3:
        print(f"   ... 외 {len(upload_targets) - 3}개")


if __name__ == "__main__":
    upload_changed_files()

