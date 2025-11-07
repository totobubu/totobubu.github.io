#!/usr/bin/env python3
"""R2 logos 폴더에서 로컬에 없는 파일 정리 스크립트"""

import argparse
from pathlib import Path

from r2_helper import get_r2_client, load_r2_config, list_r2_files, R2_AVAILABLE


def collect_local_logo_keys():
    """로컬 logos 디렉터리의 R2 키 집합을 반환"""

    logos_root = Path("public/logos")
    if not logos_root.exists():
        return set()

    keys = set()
    for item in logos_root.rglob("*"):
        if item.is_file():
            relative = item.relative_to(Path("public"))
            keys.add(str(relative).replace("\\", "/"))
    return keys


def delete_r2_objects(s3_client, bucket_name, keys):
    """R2에서 제공된 키들을 삭제 (1000개 단위 배치)"""

    deleted = 0
    failures = []
    batch = []

    for key in keys:
        batch.append({"Key": key})
        if len(batch) == 1000:
            resp = s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": batch})
            deleted += len(resp.get("Deleted", []))
            failures.extend(resp.get("Errors", []))
            batch = []

    if batch:
        resp = s3_client.delete_objects(Bucket=bucket_name, Delete={"Objects": batch})
        deleted += len(resp.get("Deleted", []))
        failures.extend(resp.get("Errors", []))

    return deleted, failures


def main():
    parser = argparse.ArgumentParser(
        description="Cloudflare R2 logos/ 폴더에서 로컬에 존재하지 않는 파일을 정리합니다.",
        epilog="기본은 dry-run입니다. 실제 삭제는 --apply 옵션을 사용하세요.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="dry-run 대신 실제로 R2 파일을 삭제합니다.",
    )

    args = parser.parse_args()

    if not R2_AVAILABLE:
        print("[ERROR] boto3가 설치되어 있지 않습니다. 먼저 'pip install boto3' 를 실행하세요.")
        return 1

    try:
        config = load_r2_config()
    except Exception as exc:
        print(f"[ERROR] R2 설정을 로드할 수 없습니다: {exc}")
        return 1

    local_keys = collect_local_logo_keys()
    print(f"[INFO] 로컬 logos 파일 {len(local_keys)}개")

    r2_keys = set(list_r2_files("logos/"))
    print(f"[INFO] R2 logos 파일 {len(r2_keys)}개")

    if not r2_keys:
        print("[INFO] R2 logos 폴더가 비어있거나 목록을 가져오지 못했습니다.")
        return 0

    stale_keys = sorted(r2_keys - local_keys)
    if not stale_keys:
        print("[OK] R2와 로컬 logos 폴더가 이미 일치합니다.")
        return 0

    print("\n[DRY-RUN] 삭제 대상 (R2에만 존재):")
    preview = stale_keys[:20]
    for key in preview:
        print(f"  - {key}")
    if len(stale_keys) > len(preview):
        print(f"  ... 외 {len(stale_keys) - len(preview)}개")

    if not args.apply:
        print(
            "\n현재는 dry-run 상태입니다. 실제로 삭제하려면 --apply 옵션을 추가해 다시 실행하세요."
        )
        return 0

    print("\n[APPLY] R2에서 불필요한 파일 삭제 중...")
    s3_client, bucket_name = get_r2_client()
    if not s3_client:
        print("[ERROR] R2 클라이언트를 초기화할 수 없습니다.")
        return 1

    deleted, failures = delete_r2_objects(s3_client, bucket_name, stale_keys)
    print(f"[OK] 삭제 완료: {deleted}개")

    if failures:
        print("[WARN] 삭제 실패 항목")
        for failure in failures:
            print(f"  - {failure.get('Key')}: {failure.get('Code')} ({failure.get('Message')})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

