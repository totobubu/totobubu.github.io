"""
토스 증권 거래내역서 PDF 구조 분석 스크립트
pdfplumber를 사용하여 PDF의 텍스트, 테이블, 레이아웃 구조를 분석합니다.
"""

import pdfplumber
import json
import sys
from pathlib import Path
from tabulate import tabulate

def analyze_pdf_structure(pdf_path):
    """PDF 파일의 구조를 상세히 분석"""
    
    print(f"\n{'='*80}")
    print(f"📄 PDF 파일 분석: {pdf_path}")
    print(f"{'='*80}\n")
    
    results = {
        "file_path": str(pdf_path),
        "pages": []
    }
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"총 페이지 수: {len(pdf.pages)}\n")
        
        for page_num, page in enumerate(pdf.pages, 1):
            print(f"\n{'─'*80}")
            print(f"📖 페이지 {page_num}/{len(pdf.pages)}")
            print(f"{'─'*80}")
            
            # 페이지 기본 정보
            print(f"\n[페이지 정보]")
            print(f"  - 크기: {page.width} x {page.height}")
            print(f"  - 회전: {page.rotation}도")
            
            page_data = {
                "page_number": page_num,
                "width": page.width,
                "height": page.height,
                "rotation": page.rotation
            }
            
            # 텍스트 추출
            text = page.extract_text()
            page_data["text"] = text
            
            if text:
                print(f"\n[추출된 텍스트]")
                print("─" * 80)
                print(text[:1000] + ("..." if len(text) > 1000 else ""))
                print("─" * 80)
                print(f"  총 텍스트 길이: {len(text)} 문자")
            else:
                print(f"\n⚠️  추출된 텍스트가 없습니다.")
            
            # 텍스트를 줄 단위로 분석
            lines = text.split('\n') if text else []
            print(f"\n[줄 단위 분석] (총 {len(lines)}줄)")
            for i, line in enumerate(lines[:20], 1):  # 처음 20줄만 표시
                if line.strip():
                    print(f"  {i:3d}: {line}")
            if len(lines) > 20:
                print(f"  ... ({len(lines) - 20}줄 더 있음)")
            
            page_data["lines"] = lines
            
            # 테이블 추출
            tables = page.extract_tables()
            page_data["tables"] = []
            
            if tables:
                print(f"\n[테이블 발견] 총 {len(tables)}개")
                for table_idx, table in enumerate(tables, 1):
                    print(f"\n  📊 테이블 #{table_idx}")
                    print(f"  크기: {len(table)}행 x {len(table[0]) if table else 0}열")
                    
                    # 테이블을 보기 좋게 출력
                    if table:
                        # 빈 값을 제거하고 정리
                        cleaned_table = []
                        for row in table:
                            cleaned_row = [cell if cell else "" for cell in row]
                            cleaned_table.append(cleaned_row)
                        
                        print("\n" + tabulate(cleaned_table[:10], tablefmt="simple"))
                        if len(cleaned_table) > 10:
                            print(f"  ... ({len(cleaned_table) - 10}행 더 있음)")
                        
                        page_data["tables"].append({
                            "table_number": table_idx,
                            "rows": len(table),
                            "columns": len(table[0]) if table else 0,
                            "data": cleaned_table
                        })
            else:
                print(f"\n[테이블] 발견되지 않음")
            
            # 단어 추출 (위치 정보 포함)
            words = page.extract_words()
            print(f"\n[단어 정보] 총 {len(words)}개 단어")
            
            # 단어 샘플 표시
            if words:
                print("\n  처음 20개 단어 (위치 정보 포함):")
                word_data = []
                for i, word in enumerate(words[:20], 1):
                    word_data.append([
                        i,
                        word['text'],
                        f"({word['x0']:.1f}, {word['top']:.1f})",
                        f"{word['x1'] - word['x0']:.1f} x {word['bottom'] - word['top']:.1f}"
                    ])
                print(tabulate(word_data, 
                             headers=['#', '단어', '위치(x,y)', '크기(w×h)'],
                             tablefmt="simple"))
            
            page_data["word_count"] = len(words)
            
            # 라인 객체 분석 (수평선, 수직선 등)
            lines_obj = page.lines
            rects = page.rects
            curves = page.curves
            
            print(f"\n[그래픽 요소]")
            print(f"  - 라인: {len(lines_obj)}개")
            print(f"  - 사각형: {len(rects)}개")
            print(f"  - 곡선: {len(curves)}개")
            
            page_data["graphics"] = {
                "lines": len(lines_obj),
                "rectangles": len(rects),
                "curves": len(curves)
            }
            
            results["pages"].append(page_data)
    
    return results

def save_analysis_result(results, output_path):
    """분석 결과를 JSON 파일로 저장"""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n✅ 분석 결과가 저장되었습니다: {output_path}")

def main():
    # PDF 파일 경로
    pdf_path = Path("public/holdings/1761864827737.pdf")
    
    if not pdf_path.exists():
        print(f"❌ 파일을 찾을 수 없습니다: {pdf_path}")
        sys.exit(1)
    
    # PDF 구조 분석
    results = analyze_pdf_structure(pdf_path)
    
    # 결과 저장
    output_path = Path("scripts/pdf_analysis_result.json")
    save_analysis_result(results, output_path)
    
    # 요약 정보 출력
    print(f"\n{'='*80}")
    print("📊 분석 요약")
    print(f"{'='*80}")
    print(f"총 페이지: {len(results['pages'])}페이지")
    
    total_tables = sum(len(page['tables']) for page in results['pages'])
    total_words = sum(page['word_count'] for page in results['pages'])
    
    print(f"총 테이블: {total_tables}개")
    print(f"총 단어: {total_words}개")
    print(f"\n분석이 완료되었습니다! 🎉")

if __name__ == "__main__":
    main()

