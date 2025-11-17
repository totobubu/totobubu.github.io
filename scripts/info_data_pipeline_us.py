#!/usr/bin/env python3
# scripts/info_data_pipeline_us.py
"""
미국 시장(US) 전용 정보성 데이터 통합 파이프라인
- info_data_pipeline.py를 US 필터로 실행
"""

import os
import sys

# MARKET_FILTER를 US로 설정
os.environ["MARKET_FILTER"] = "US"

# 공통 파이프라인 모듈 import 및 실행
from info_data_pipeline import main

if __name__ == "__main__":
    # US 필터로 실행
    main(market_filter="US")

