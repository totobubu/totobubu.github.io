# NEW FILE: scripts/generate_kr_stock_list.py

import pandas as pd
import json
import os

# 다운로드한 KRX CSV 파일이 있는 경로와 파일명
CSV_FILE_PATH = "public/kr_master/data_2821_20251005.csv" # 실제 파일 경로로 변경
OUTPUT_JSON_PATH = "public/nav/kr_master.json"

def generate_kr_stock_master():
    if not os.path.exists(CSV_FILE_PATH):
        print(f"Error: CSV file not found at {CSV_FILE_PATH}")
        return

    print("--- Reading KRX stock list CSV ---")
    # KRX에서 받은 CSV는 EUC-KR 인코딩일 가능성이 높습니다.
    df = pd.read_csv(CSV_FILE_PATH, encoding='euc-kr')

    # 필요한 컬럼만 추출하고, 컬럼명을 영문으로 변경 (예시)
    # 실제 CSV 파일의 컬럼명을 확인하고 맞게 수정해야 합니다.
    df = df['표준코드', '단축코드', '한글 종목명', '한글 종목약명', '영문 종목명', '상장일', '시장구분', '증권구분', '소속부', '주식종류', '액면가', '상장주식수']
    df.rename(columns={
        #'표준코드', '단축코드', '한글 종목명', '한글 종목약명', '영문 종목명', '상장일', '시장구분', '증권구분', '소속부', '주식종류', '액면가', '상장주식수'
        '종목코드': 'symbol', '종목명': 'koName', '시장구분': 'market'}, inplace=True)

    # '종목코드(symbol)'는 6자리 숫자가 되도록 포맷팅 (앞의 0이 사라지는 경우 방지)
    df['symbol'] = df['symbol'].astype(str).str.zfill(6)
    
    # currency 필드 추가
    df['currency'] = 'KRW'

    # frequency는 기본값으로 '미정' 설정 (배당 정보는 나중에 따로 가져와야 함)
    df['frequency'] = '미정'

    print(f"Found {len(df)} stocks. Converting to JSON...")

    # DataFrame을 JSON 형식(레코드 리스트)으로 변환
    records = df.to_dict('records')

    # 최종 JSON 파일로 저장
    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=4)

    print(f"🎉 Successfully generated {OUTPUT_JSON_PATH} with {len(records)} stocks.")


if __name__ == "__main__":
    generate_kr_stock_master()