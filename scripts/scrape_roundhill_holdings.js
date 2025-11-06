// scripts/scrape_roundhill_holdings.js
/**
 * Roundhill ETF Holdings 자동 스크래핑 (Puppeteer)
 * 
 * JavaScript 동적 로딩으로 인해 BeautifulSoup으로 불가능한 Roundhill ETF를
 * Puppeteer를 사용하여 자동 수집합니다.
 * 
 * 사용법:
 *   # 단일 ETF 테스트
 *   node scripts/scrape_roundhill_holdings.js AAPW
 * 
 *   # 전체 Roundhill ETF
 *   node scripts/scrape_roundhill_holdings.js --all
 * 
 *   # 특정 ETF들만
 *   node scripts/scrape_roundhill_holdings.js AAPW NFLW TSLW
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Roundhill ETF 목록
const ROUNDHILL_ETFS = [
    // WeeklyPay™ (22개)
    'AAPW', 'NFLW', 'TSLW', 'NVDW', 'MSFW', 'GOOW', 'AMZW', 'METW',
    'PLTW', 'COIW', 'HOOW', 'MSTW', 'BRKW', 'AMDW', 'AVGW', 'ARMW',
    'BABW', 'COSW', 'UBEW', 'GDXW', 'GLDW', 'WPAY',
    // Income (7개)
    'XDTE', 'QDTE', 'RDTE', 'XPAY', 'YBTC', 'YETH', 'MAGY',
    // Thematic (8개)
    'METV', 'MAGS', 'CHAT', 'BETZ', 'NERD', 'OZEM', 'WEED', 'MAGC',
    // 기타
    'UX', 'HUMN', 'MEME', 'WEEK', 'XDIV', 'MAGX'
];

/**
 * Roundhill ETF Holdings 페이지 스크래핑
 */
async function scrapeRoundhillHoldings(ticker, browser) {
    const url = `https://www.roundhillinvestments.com/etf/${ticker.toLowerCase()}/`;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`스크래핑 중: ${ticker}`);
    console.log(`URL: ${url}`);
    console.log('='.repeat(60));

    const page = await browser.newPage();
    
    try {
        // User Agent 설정
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 페이지 로드
        await page.goto(url, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });

        console.log('✅ 페이지 로드 완료');

        // 테이블이 로드될 때까지 대기
        try {
            await page.waitForSelector('table', { timeout: 10000 });
            console.log('✅ 테이블 요소 발견');
            
            // 추가 대기: 페이지 완전히 로드
            await page.waitForTimeout(2000);
            console.log('✅ 페이지 로딩 대기 완료');
        } catch (e) {
            console.log('⚠️ 테이블을 찾을 수 없습니다.');
            
            // 스크린샷 저장 (디버깅용)
            const screenshotPath = `debug_${ticker.toLowerCase()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 디버깅용 스크린샷 저장: ${screenshotPath}`);
            
            return null;
        }

        // "View All +" 버튼 찾아서 클릭 (전체 Holdings를 보기 위함)
        console.log('🔍 "View All" 버튼 찾는 중...');
        try {
            // 정확한 selector로 버튼 찾기
            const buttonClicked = await page.evaluate(() => {
                // 1. class="viewall-link" 시도
                let viewAllButton = document.querySelector('.viewall-link');
                
                // 2. data-open="holdingsModal" 시도
                if (!viewAllButton) {
                    viewAllButton = document.querySelector('[data-open="holdingsModal"]');
                }
                
                // 3. aria-label="Holdings" 시도
                if (!viewAllButton) {
                    viewAllButton = document.querySelector('[aria-label="Holdings"]');
                }
                
                // 4. 텍스트로 찾기 (fallback)
                if (!viewAllButton) {
                    const links = Array.from(document.querySelectorAll('a'));
                    viewAllButton = links.find(link => 
                        link.textContent?.trim().toLowerCase().includes('view all')
                    );
                }
                
                if (viewAllButton) {
                    console.log('버튼 발견:', viewAllButton.className, viewAllButton.textContent);
                    viewAllButton.click();
                    return true;
                }
                return false;
            });

            if (buttonClicked) {
                console.log('✅ "View All" 버튼 클릭 성공');
                
                // 모달이 나타날 때까지 대기
                await page.waitForTimeout(3000);
                console.log('✅ 모달 로딩 대기 완료');
            } else {
                console.log('⚠️ "View All" 버튼을 찾을 수 없음 (기본 테이블 사용)');
            }
        } catch (e) {
            console.log('⚠️ "View All" 버튼 클릭 실패 (기본 테이블 사용)');
            console.log(`   오류: ${e.message}`);
        }

        // "as of" 날짜 추출
        let asOfDate = null;
        try {
            const dateText = await page.evaluate(() => {
                // 페이지에서 "as of" 텍스트 찾기
                const bodyText = document.body.innerText;
                const match = bodyText.match(/as of\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
                return match ? match[1] : null;
            });
            
            if (dateText) {
                asOfDate = dateText;
                console.log(`📅 날짜: ${asOfDate}`);
            }
        } catch (e) {
            console.log('⚠️ 날짜 추출 실패');
        }

        // Holdings 데이터 추출 (모달 내 테이블)
        const holdings = await page.evaluate(() => {
            // 1. 모달 내 데스크톱 테이블 찾기 (우선순위)
            let holdingsTable = document.querySelector('#fullHoldingsTablex');
            
            // 2. 모달 내 모바일 테이블 찾기 (fallback)
            if (!holdingsTable) {
                holdingsTable = document.querySelector('.modaltablemobile');
            }
            
            // 3. 헤더로 테이블 찾기 (최종 fallback)
            if (!holdingsTable) {
                const tables = Array.from(document.querySelectorAll('table'));
                for (const table of tables) {
                    const headerCells = Array.from(table.querySelectorAll('thead th'));
                    const headerText = headerCells.map(cell => cell.innerText.trim().toLowerCase()).join(' ');
                    
                    if (
                        (headerText.includes('ticker') && headerText.includes('name')) ||
                        (headerText.includes('identifier') && headerText.includes('shares'))
                    ) {
                        holdingsTable = table;
                        break;
                    }
                }
            }
            
            if (!holdingsTable) {
                console.log('⚠️ Holdings 테이블을 찾을 수 없습니다');
                return [];
            }
            
            console.log('✅ Holdings 테이블 발견:', holdingsTable.id || holdingsTable.className);
            
            // Holdings 테이블의 데이터 행만 추출
            const rows = Array.from(holdingsTable.querySelectorAll('tbody tr'));
            
            return rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                
                // 빈 행 필터링: 모든 셀이 비어있으면 무시
                if (cells.length === 0) return null;
                
                const hasContent = cells.some(cell => {
                    const text = cell.innerText.trim();
                    return text && text !== '-' && text !== '';
                });
                
                if (!hasContent) return null;

                // 다양한 테이블 형식 처리
                let data = {};

                if (cells.length >= 6) {
                    // 형식 1: Ticker | Name | Identifier | Weight | Shares | Market Value
                    data = {
                        ticker: cells[0]?.innerText?.trim() || '',
                        name: cells[1]?.innerText?.trim() || '',
                        identifier: cells[2]?.innerText?.trim() || '',
                        weight: cells[3]?.innerText?.trim() || '',
                        shares: cells[4]?.innerText?.trim() || '',
                        marketValue: cells[5]?.innerText?.trim() || ''
                    };
                } else if (cells.length === 2) {
                    // 형식 2: Name | Weight (MAGS, WEED 등)
                    data = {
                        name: cells[0]?.innerText?.trim() || '',
                        weight: cells[1]?.innerText?.trim() || '',
                        ticker: null,
                        identifier: null,
                        shares: null,
                        marketValue: null
                    };
                } else if (cells.length >= 3) {
                    // 형식 3: 알 수 없는 형식이지만 3개 이상의 컬럼
                    data = {
                        raw: cells.map(c => c.innerText.trim())
                    };
                } else {
                    // 2개 이하는 무시
                    return null;
                }

                return data;
            }).filter(item => item !== null);
        });

        console.log(`✅ Holdings 데이터 추출: ${holdings.length}개`);

        if (holdings.length === 0) {
            console.log('⚠️ 추출된 holdings가 없습니다.');
            
            // 디버깅: 스크린샷 저장
            const screenshotPath = `debug_no_holdings_${ticker.toLowerCase()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 디버깅용 스크린샷 저장: ${screenshotPath}`);
            
            return null;
        }

        // 결과 출력 (처음 5개)
        console.log('\n📋 추출된 데이터 샘플 (처음 5개):');
        holdings.slice(0, 5).forEach((h, i) => {
            console.log(`  ${i + 1}. ${JSON.stringify(h, null, 2)}`);
        });

        return {
            ticker: ticker.toUpperCase(),
            asOfDate: asOfDate,
            holdings: holdings,
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error(`❌ 스크래핑 실패: ${error.message}`);
        return null;
    } finally {
        await page.close();
    }
}

/**
 * 스크래핑한 데이터를 파일로 저장
 */
async function saveToFile(data, ticker) {
    const outputDir = 'public/holdings/scraped';
    const outputPath = path.join(outputDir, `${ticker.toLowerCase()}_${Date.now()}.json`);

    // 디렉토리 생성
    if (!existsSync(outputDir)) {
        await fs.mkdir(outputDir, { recursive: true });
    }

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n💾 데이터 저장: ${outputPath}`);
    
    return outputPath;
}

/**
 * TSV 형식으로 변환 (Python 스크립트에서 사용 가능)
 */
function convertToTSV(data) {
    if (!data || !data.holdings || data.holdings.length === 0) {
        return null;
    }

    const holdings = data.holdings;
    let lines = [];

    // 헤더 결정
    const hasFullData = holdings[0].ticker !== undefined;
    
    if (hasFullData) {
        lines.push('Ticker\tName\tIdentifier\tETF Weight\tShares\tMarket Value');
        holdings.forEach(h => {
            lines.push(
                `${h.ticker || ''}\t${h.name || ''}\t${h.identifier || ''}\t${h.weight || ''}\t${h.shares || ''}\t${h.marketValue || ''}`
            );
        });
    } else {
        lines.push('Name\tWeight');
        holdings.forEach(h => {
            lines.push(`${h.name || ''}\t${h.weight || ''}`);
        });
    }

    return lines.join('\n');
}

/**
 * 배치 파일 형식으로 저장 (Python add_roundhill_holdings.py 호환)
 */
async function saveToBatchFile(dataList) {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2); // YYMMDD
    const outputPath = `public/holdings/roundhill_${timestamp}_auto.txt`;

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
    console.log(`\n사용법: python scripts/add_roundhill_holdings.py --batch ${outputPath}`);
    
    return outputPath;
}

/**
 * 메인 함수
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('사용법:');
        console.log('  node scripts/scrape_roundhill_holdings.js AAPW');
        console.log('  node scripts/scrape_roundhill_holdings.js AAPW NFLW TSLW');
        console.log('  node scripts/scrape_roundhill_holdings.js --all');
        process.exit(1);
    }

    // 스크래핑할 티커 결정
    let tickers = [];
    if (args[0] === '--all') {
        tickers = ROUNDHILL_ETFS;
    } else {
        tickers = args.map(t => t.toUpperCase());
    }

    console.log('🚀 Roundhill ETF Holdings 자동 스크래핑');
    console.log(`📊 대상: ${tickers.length}개 ETF`);
    console.log('='.repeat(60));

    // Puppeteer 브라우저 실행
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log('✅ 브라우저 실행');

    const results = [];

    for (const ticker of tickers) {
        const data = await scrapeRoundhillHoldings(ticker, browser);
        
        if (data) {
            results.push(data);
            // 개별 파일로도 저장
            await saveToFile(data, ticker);
        }

        // 요청 사이 대기 (Rate Limiting 방지)
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
        // 배치 파일로 저장
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

