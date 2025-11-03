# scripts/r2_helper.py
"""Cloudflare R2 업로드 헬퍼 (간소화 버전)"""
import os
import json
from pathlib import Path

try:
    import boto3
    from botocore.client import Config
    R2_AVAILABLE = True
except ImportError:
    R2_AVAILABLE = False
    print("[WARNING] boto3가 설치되지 않았습니다. R2 업로드를 건너뜁니다.")


def get_r2_client():
    """R2 클라이언트 생성"""
    if not R2_AVAILABLE:
        return None, None
    
    # 환경변수에서 R2 설정 로드
    account_id = os.getenv('R2_ACCOUNT_ID')
    access_key_id = os.getenv('R2_ACCESS_KEY_ID')
    secret_access_key = os.getenv('R2_SECRET_ACCESS_KEY')
    bucket_name = os.getenv('R2_BUCKET_NAME')
    
    # 환경변수가 없으면 .env.r2 파일에서 로드
    if not all([account_id, access_key_id, secret_access_key, bucket_name]):
        env_file = Path(__file__).parent.parent / '.env.r2'
        if env_file.exists():
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        os.environ[key] = value
            
            account_id = os.getenv('R2_ACCOUNT_ID')
            access_key_id = os.getenv('R2_ACCESS_KEY_ID')
            secret_access_key = os.getenv('R2_SECRET_ACCESS_KEY')
            bucket_name = os.getenv('R2_BUCKET_NAME')
    
    if not all([account_id, access_key_id, secret_access_key, bucket_name]):
        return None, None
    
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        return s3_client, bucket_name
    except Exception as e:
        print(f"[ERROR] R2 클라이언트 생성 실패: {e}")
        return None, None


def upload_json_to_r2(data, key):
    """JSON 데이터를 R2에 업로드"""
    s3_client, bucket_name = get_r2_client()
    if not s3_client:
        return False
    
    try:
        json_data = json.dumps(data, indent=2, ensure_ascii=False)
        s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=json_data.encode('utf-8'),
            ContentType='application/json',
            CacheControl='public, max-age=300'
        )
        return True
    except Exception as e:
        print(f"[ERROR] R2 업로드 실패 ({key}): {e}")
        return False


def save_json_with_r2(file_path, data):
    """로컬 저장 + R2 업로드"""
    from scripts.utils import save_json_file
    
    # 로컬 저장
    local_ok = save_json_file(file_path, data)
    
    # R2 업로드 시도
    if R2_AVAILABLE:
        path_str = str(file_path).replace("\\", "/")
        if "public/" in path_str:
            r2_key = path_str.split("public/", 1)[1]
            upload_json_to_r2(data, r2_key)
    
    return local_ok

