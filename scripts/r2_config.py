# scripts/r2_config.py
"""
Cloudflare R2 설정 및 업로드 헬퍼 함수
"""
import os
import json
import boto3
from botocore.client import Config
from pathlib import Path

# 환경 변수 로드
def load_r2_config():
    """환경변수 또는 .env.r2 파일에서 R2 설정 로드"""
    env_file = Path(__file__).parent.parent / '.env.r2'
    
    # .env.r2 파일이 있으면 로드
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
    
    # 환경변수에서 설정 가져오기
    config = {
        'account_id': os.getenv('R2_ACCOUNT_ID'),
        'access_key_id': os.getenv('R2_ACCESS_KEY_ID'),
        'secret_access_key': os.getenv('R2_SECRET_ACCESS_KEY'),
        'bucket_name': os.getenv('R2_BUCKET_NAME'),
        'public_url': os.getenv('R2_PUBLIC_URL'),
    }
    
    # 필수 값 체크
    missing = [k for k, v in config.items() if not v]
    if missing:
        raise ValueError(f"R2 설정이 누락되었습니다: {', '.join(missing)}")
    
    return config


# R2 클라이언트 생성
def get_r2_client():
    """Cloudflare R2 boto3 클라이언트 생성"""
    config = load_r2_config()
    
    s3_client = boto3.client(
        's3',
        endpoint_url=f"https://{config['account_id']}.r2.cloudflarestorage.com",
        aws_access_key_id=config['access_key_id'],
        aws_secret_access_key=config['secret_access_key'],
        config=Config(signature_version='s3v4'),
        region_name='auto'  # R2는 'auto' 사용
    )
    
    return s3_client, config['bucket_name']


# JSON 파일 업로드
def upload_json_to_r2(data, key, indent=2):
    """
    Python dict를 JSON으로 변환하여 R2에 업로드
    
    Args:
        data: 업로드할 Python dict
        key: R2에서의 파일 경로 (예: 'data/005930-ks.json')
        indent: JSON 들여쓰기 (기본값: 2)
    
    Returns:
        bool: 성공 여부
    """
    try:
        s3_client, bucket_name = get_r2_client()
        
        # dict를 JSON 문자열로 변환
        json_data = json.dumps(data, indent=indent, ensure_ascii=False)
        
        # R2에 업로드
        s3_client.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=json_data.encode('utf-8'),
            ContentType='application/json',
            CacheControl='public, max-age=300'  # 5분 캐싱
        )
        
        return True
    except Exception as e:
        print(f"❌ R2 업로드 실패 ({key}): {e}")
        return False


# 파일 직접 업로드
def upload_file_to_r2(file_path, key=None):
    """
    로컬 파일을 R2에 업로드
    
    Args:
        file_path: 로컬 파일 경로
        key: R2에서의 파일 경로 (None이면 파일명 사용)
    
    Returns:
        bool: 성공 여부
    """
    try:
        s3_client, bucket_name = get_r2_client()
        
        if key is None:
            key = Path(file_path).name
        
        # 파일 확장자에 따라 Content-Type 결정
        file_ext = Path(file_path).suffix.lower()
        content_type_map = {
            '.json': 'application/json',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.ico': 'image/x-icon',
            '.gif': 'image/gif',
        }
        content_type = content_type_map.get(file_ext, 'application/octet-stream')
        
        # 이미지는 1년 캐싱, JSON은 5분 캐싱
        if content_type.startswith('image/'):
            cache_control = 'public, max-age=31536000'  # 1년
        else:
            cache_control = 'public, max-age=300'  # 5분
        
        with open(file_path, 'rb') as f:
            s3_client.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=f.read(),
                ContentType=content_type,
                CacheControl=cache_control
            )
        
        return True
    except Exception as e:
        print(f"[ERROR] R2 파일 업로드 실패 ({file_path}): {e}")
        return False


# R2에서 파일 다운로드
def download_from_r2(key):
    """
    R2에서 JSON 파일 다운로드
    
    Args:
        key: R2에서의 파일 경로
    
    Returns:
        dict: JSON 데이터 또는 None
    """
    try:
        s3_client, bucket_name = get_r2_client()
        
        response = s3_client.get_object(Bucket=bucket_name, Key=key)
        data = json.loads(response['Body'].read().decode('utf-8'))
        
        return data
    except s3_client.exceptions.NoSuchKey:
        return None
    except Exception as e:
        print(f"❌ R2 다운로드 실패 ({key}): {e}")
        return None


# Public URL 생성
def get_r2_public_url(key):
    """
    R2 파일의 Public URL 생성
    
    Args:
        key: R2에서의 파일 경로
    
    Returns:
        str: Public URL
    """
    config = load_r2_config()
    return f"{config['public_url']}/{key}"


if __name__ == '__main__':
    # 테스트
    print("R2 설정 테스트...")
    try:
        config = load_r2_config()
        print("[OK] R2 설정 로드 성공")
        print(f"   Bucket: {config['bucket_name']}")
        print(f"   Public URL: {config['public_url']}")
        
        # 클라이언트 생성 테스트
        s3_client, bucket_name = get_r2_client()
        print("[OK] R2 클라이언트 생성 성공")
        
        # 버킷 존재 확인
        s3_client.head_bucket(Bucket=bucket_name)
        print("[OK] R2 버킷 접근 성공")
        
    except Exception as e:
        print(f"[ERROR] 테스트 실패: {e}")

