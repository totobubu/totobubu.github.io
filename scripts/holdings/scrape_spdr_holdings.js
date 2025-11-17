// scripts/scrape_spdr_holdings.js
/**
 * SPDR ETF Holdings 자동 스크래핑 (Playwright)
 * 
 * State Street SPDR ETF의 Holdings 데이터를 스크래핑합니다.
 * 특히 금 ETF (GLD, GLDM)에 유용합니다.
 * 
 * 사용법:
 *   node scripts/scrape_spdr_holdings.js GLD
 *   node scripts/scrape_spdr_holdings.js GLD GLDM SLV
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

// SPDR 금/은 ETF 목록 (우선순위)
const SPDR_PRECIOUS_METALS = ['GLD', 'GLDM', 'SLV'];

/**
 * SPDR ETF Holdings 페이지 스크래핑
 */
async function scrapeSpdrHoldings(ticker, browser) {
    const url = `https://www.ssga.com/us/en/individual/etfs/funds/${ticker.toLowerCase()}`;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`스크래핑 중: ${ticker}`);
    console.log(`URL: ${url}`);
    console.log('='.repeat(60));

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    try {
        // 페이지 로드
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        console.log('✅ 페이지 로드 완료');

        // Holdings 섹션 대기
        await page.waitForTimeout(3000);
        console.log('✅ 페이지 로딩 대기 완료');

        // 날짜 추출
        const asOfDate = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const match = bodyText.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
            return match ? match[1] : null;
        });

        if (asOfDate) {
            console.log(`📅 날짜: ${asOfDate}`);
        }

        // Holdings 데이터 추출
        const holdingsInfo = await page.evaluate(() => {
            // 모든 테이블 찾기
            const tables = Array.from(document.querySelectorAll('table'));
            
            let holdingsTable = null;
            for (const table of tables) {
                const headerCells = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'));
                const headerText = headerCells.map(cell => cell.innerText.trim().toLowerCase()).join(' ');
                
                // Holdings 테이블 식별
                if ((headerText.includes('name') || headerText.includes('ticker') || headerText.includes('holding')) && 
                    headerText.includes('weight')) {
                    holdingsTable = table;
                    break;
                }
            }
            
            if (!holdingsTable) {
                return { holdings: [], source: 'Not Found' };
            }
            
            const rows = Array.from(holdingsTable.querySelectorAll('tbody tr'));
            
            const processedRows = rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                
                if (cells.length === 0) return null;
                
                const hasContent = cells.some(cell => {
                    const text = cell.innerText.trim();
                    return text && text !== '-' && text !== '';
                });
                
                if (!hasContent) return null;

                const cellTexts = cells.map(c => c.innerText.trim());
                
                // SPDR 테이블 형식: Name | Ticker | Weight | Shares | Market Value
                // 또는: Ticker | Name | Weight
                let data = {};
                
                if (cells.length >= 3) {
                    // Weight 자동 감지 (% 기호)
                    let weightCol = '';
                    let tickerCol = '';
                    let nameCol = '';
                    
                    for (let i = 0; i < cellTexts.length; i++) {
                        const text = cellTexts[i];
                        if (text.includes('%')) {
                            weightCol = text;
                        } else if (text.match(/^[A-Z]{1,5}$/)) {
                            tickerCol = text;
                        } else if (!nameCol && text.length > 0) {
                            nameCol = text;
                        }
                    }
                    
                    data = {
                        ticker: tickerCol || cellTexts[0],
                        name: nameCol || cellTexts[1] || cellTexts[0],
                        weight: weightCol
                    };
                } else if (cells.length === 2) {
                    data = {
                        name: cellTexts[0] || '',
                        weight: cellTexts[1] || ''
                    };
                } else {
                    return null;
                }

                return data;
            }).filter(item => item !== null);
            
            return { holdings: processedRows, source: 'SPDR Holdings Table' };
        });

        console.log(`✅ Holdings 데이터 추출: ${holdingsInfo.holdings.length}개 (출처: ${holdingsInfo.source})`);
        
        const holdings = holdingsInfo.holdings;

        if (holdings.length === 0) {
            console.log('⚠️ 추출된 holdings가 없습니다.');
            
            const screenshotPath = `debug_spdr_${ticker.toLowerCase()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 디버깅용 스크린샷 저장: ${screenshotPath}`);
            
            await context.close();
            return null;
        }

        // 샘플 출력
        console.log('\n📋 추출된 데이터 샘플 (처음 5개):');
        holdings.slice(0, 5).forEach((h, i) => {
            console.log(`  ${i + 1}. ${JSON.stringify(h, null, 2)}`);
        });

        await context.close();

        return {
            ticker: ticker.toUpperCase(),
            asOfDate: asOfDate,
            holdings: holdings,
            scrapedAt: new Date().toISOString(),
            provider: 'SPDR'
        };

    } catch (error) {
        console.error(`❌ 스크래핑 실패: ${error.message}`);
        await context.close();
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

    lines.push('Name\tWeight');
    holdings.forEach(h => {
        lines.push(`${h.name || h.ticker || ''}\t${h.weight || ''}`);
    });

    return lines.join('\n');
}

/**
 * 배치 파일로 저장
 */
async function saveToBatchFile(dataList) {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
    const outputPath = `public/holdings/spdr_${timestamp}_playwright.txt`;

    let content = [];

    for (const data of dataList) {
        if (!data) continue;

        content.push(data.ticker.toUpperCase());
        content.push(`as of ${data.asOfDate || new Date().toLocaleDateString('en-US')}`);
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
        console.log('  node scripts/scrape_spdr_holdings.js GLD');
        console.log('  node scripts/scrape_spdr_holdings.js GLD GLDM SLV');
        console.log('  node scripts/scrape_spdr_holdings.js --all  (금/은 ETF만)');
        process.exit(1);
    }

    let tickers = [];
    if (args[0] === '--all') {
        tickers = SPDR_PRECIOUS_METALS;
    } else {
        tickers = args.map(t => t.toUpperCase());
    }

    console.log('🚀 SPDR ETF Holdings 자동 스크래핑 (Playwright)');
    console.log(`📊 대상: ${tickers.length}개 ETF`);
    console.log('='.repeat(60));

    const browser = await chromium.launch({ headless: true });
    console.log('✅ 브라우저 실행');

    const results = [];

    for (const ticker of tickers) {
        const data = await scrapeSpdrHoldings(ticker, browser);
        
        if (data) {
            results.push(data);
        }

        if (tickers.length > 1) {
            console.log('⏳ 2초 대기...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    await browser.close();
    console.log('\n✅ 브라우저 종료');

    // 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📊 스크래핑 결과');
    console.log('='.repeat(60));
    console.log(`성공: ${results.length}개`);
    console.log(`실패: ${tickers.length - results.length}개`);

    if (results.length > 0) {
        const batchFile = await saveToBatchFile(results);
        
        console.log('\n✅ 완료!');
        console.log(`\n다음 명령으로 데이터를 등록하세요:`);
        console.log(`  python scripts/add_roundhill_holdings.py --batch ${batchFile}`);
    }
}

main().catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
});

