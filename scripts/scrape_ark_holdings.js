// scripts/scrape_ark_holdings.js
/**
 * ARK ETF Holdings CSV 다운로드 및 파싱
 *
 * ARK는 매일 Holdings CSV를 제공하므로 직접 다운로드합니다.
 * Playwright 없이 fetch로 간단하게 처리합니다.
 *
 * 사용법:
 *   node scripts/scrape_ark_holdings.js ARKB
 *   node scripts/scrape_ark_holdings.js --all
 */

import fs from 'fs/promises';

// ARK ETF 목록 및 CSV 파일명 매핑
const ARK_ETFS = {
    ARKK: 'ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv',
    ARKQ: 'ARK_AUTONOMOUS_TECH._&_ROBOTICS_ETF_ARKQ_HOLDINGS.csv', // TECH. (축약형)
    ARKW: 'ARK_NEXT_GENERATION_INTERNET_ETF_ARKW_HOLDINGS.csv',
    ARKG: 'ARK_GENOMIC_REVOLUTION_ETF_ARKG_HOLDINGS.csv',
    ARKF: 'ARK_FINTECH_INNOVATION_ETF_ARKF_HOLDINGS.csv',
    ARKX: 'ARK_SPACE_EXPLORATION_&_INNOVATION_ETF_ARKX_HOLDINGS.csv',
    PRNT: 'THE_3D_PRINTING_ETF_PRNT_HOLDINGS.csv',
    IZRL: 'ARK_ISRAEL_INNOVATIVE_TECHNOLOGY_ETF_IZRL_HOLDINGS.csv',
    ARKT: 'ARK_DIET_Q4_BUFFER_ETF_ARKT_HOLDINGS.csv',
    ARKB: 'ARK_21SHARES_BITCOIN_ETF_ARKB_HOLDINGS.csv',
};

/**
 * ARK ETF Holdings CSV 다운로드 및 파싱
 */
async function downloadArkHoldings(ticker) {
    const csvFilename = ARK_ETFS[ticker];

    if (!csvFilename) {
        console.log(`❌ ${ticker}: CSV 파일명을 찾을 수 없습니다.`);
        return null;
    }

    const csvUrl = `https://assets.ark-funds.com/fund-documents/funds-etf-csv/${csvFilename}`;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`다운로드 중: ${ticker}`);
    console.log(`CSV: ${csvFilename}`);
    console.log('='.repeat(60));

    try {
        // CSV 다운로드
        const response = await fetch(csvUrl);

        if (!response.ok) {
            console.log(`❌ CSV 다운로드 실패: ${response.status}`);
            return null;
        }

        console.log('✅ CSV 다운로드 완료');

        // CSV 내용 가져오기
        const csvContent = await response.text();

        // CSV 파싱
        const lines = csvContent.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
            console.log('⚠️ CSV 데이터가 비어있습니다.');
            return null;
        }

        // 헤더 행
        const headers = lines[0]
            .split(',')
            .map((h) => h.trim().replace(/"/g, ''));
        console.log(`📋 CSV 헤더: ${headers.slice(0, 5).join(', ')}...`);

        // 날짜 추출 (첫 번째 데이터 행의 date 컬럼)
        let asOfDate = null;
        if (lines.length > 1) {
            const firstDataLine = lines[1].split(',');
            asOfDate = firstDataLine[0]?.trim().replace(/"/g, '');
        }

        if (!asOfDate) {
            asOfDate = new Date().toLocaleDateString('en-US');
        }

        console.log(`📅 날짜: ${asOfDate}`);

        // 데이터 행 파싱
        const holdings = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();

            // 빈 줄 또는 면책 조항 건너뛰기
            if (
                !line ||
                line.toLowerCase().startsWith('"investing') ||
                line.toLowerCase().includes('disclaimer')
            ) {
                continue;
            }

            // CSV 파싱
            const values = [];
            let currentValue = '';
            let inQuotes = false;

            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            values.push(currentValue.trim()); // 마지막 값

            if (values.length < headers.length) continue;

            // 헤더와 매칭
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header.toLowerCase()] = values[index] || '';
            });

            // 필수 필드 추출 (ARK CSV 형식: date,fund,company,ticker,cusip,shares,market value ($),weight (%))
            const holding = {
                ticker: rowData['ticker'] || '',
                name: rowData['company'] || rowData['name'] || '',
                weight: rowData['weight (%)'] || rowData['weight'] || '',
                shares: rowData['shares'] || '',
                marketValue:
                    rowData['market value ($)'] ||
                    rowData['market value'] ||
                    '',
            };

            // 유효한 데이터만 추가 (ticker가 있고, 텍스트 길이가 긴 면책 조항 제외)
            if (holding.ticker && holding.ticker.length < 20) {
                holdings.push(holding);
            }
        }

        console.log(`✅ Holdings 데이터 파싱: ${holdings.length}개`);

        if (holdings.length === 0) {
            console.log('⚠️ 파싱된 holdings가 없습니다.');
            return null;
        }

        // 샘플 출력
        console.log('\n📋 추출된 데이터 샘플 (처음 5개):');
        holdings.slice(0, 5).forEach((h, i) => {
            console.log(
                `  ${i + 1}. Ticker: ${h.ticker}, Name: ${h.name}, Weight: ${h.weight}`
            );
        });

        return {
            ticker: ticker.toUpperCase(),
            asOfDate: asOfDate,
            holdings: holdings,
            scrapedAt: new Date().toISOString(),
            provider: 'ARK',
        };
    } catch (error) {
        console.error(`❌ 다운로드/파싱 실패: ${error.message}`);
        return null;
    }
}

/**
 * TSV 형식으로 변환
 */
function convertToTSV(data) {
    if (!data || !data.holdings || data.holdings.length === 0) {
        return null;
    }

    const holdings = data.holdings;
    let lines = [];

    // 티커가 있는지 확인
    const hasTicker = holdings[0].ticker && holdings[0].ticker !== '';

    if (hasTicker) {
        lines.push('Ticker\tName\tWeight\tShares\tMarket Value');
        holdings.forEach((h) => {
            lines.push(
                `${h.ticker || ''}\t${h.name || ''}\t${h.weight || ''}\t${h.shares || ''}\t${h.marketValue || ''}`
            );
        });
    } else {
        lines.push('Name\tWeight');
        holdings.forEach((h) => {
            lines.push(`${h.name || ''}\t${h.weight || ''}`);
        });
    }

    return lines.join('\n');
}

/**
 * 배치 파일로 저장
 */
async function saveToBatchFile(dataList) {
    const timestamp = new Date()
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '')
        .slice(2);
    const outputPath = `public/holdings/ark_${timestamp}_csv.txt`;

    let content = [];

    for (const data of dataList) {
        if (!data) continue;

        content.push(data.ticker.toUpperCase());
        content.push(`as of ${data.asOfDate}`);
        content.push('');

        const tsv = convertToTSV(data);
        if (tsv) {
            content.push(tsv);
        }

        content.push('');
        content.push('--------------------------');
        content.push('');
    }

    await fs.writeFile(outputPath, content.join('\n'), 'utf-8');
    console.log(`\n📦 배치 파일 저장: ${outputPath}`);

    return outputPath;
}

/**
 * 메인 함수
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('사용법:');
        console.log('  node scripts/scrape_ark_holdings.js ARKB');
        console.log('  node scripts/scrape_ark_holdings.js ARKK ARKQ ARKW');
        console.log('  node scripts/scrape_ark_holdings.js --all');
        process.exit(1);
    }

    let tickers = [];
    if (args[0] === '--all') {
        tickers = Object.keys(ARK_ETFS);
    } else {
        tickers = args.map((t) => t.toUpperCase());
    }

    console.log('🚀 ARK ETF Holdings CSV 다운로드');
    console.log(`📊 대상: ${tickers.length}개 ETF`);
    console.log('='.repeat(60));

    const results = [];

    for (const ticker of tickers) {
        const data = await downloadArkHoldings(ticker);

        if (data) {
            results.push(data);
        }

        if (tickers.length > 1) {
            console.log('⏳ 1초 대기...');
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    // 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📊 다운로드 결과');
    console.log('='.repeat(60));
    console.log(`성공: ${results.length}개`);
    console.log(`실패: ${tickers.length - results.length}개`);

    if (results.length > 0) {
        const batchFile = await saveToBatchFile(results);

        console.log('\n✅ 완료!');
        console.log(`\n다음 명령으로 데이터를 등록하세요:`);
        console.log(
            `  python scripts/add_roundhill_holdings.py --batch ${batchFile}`
        );
    }
}

main().catch((error) => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
});
