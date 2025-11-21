// scripts/scrape_roundhill_holdings_playwright.js
/**
 * Roundhill ETF Holdings 자동 스크래핑 (Playwright)
 *
 * Playwright를 사용한 대체 구현입니다.
 * Puppeteer보다 빠르고 안정적일 수 있습니다.
 *
 * 사용법:
 *   # 단일 ETF 테스트
 *   node scripts/scrape_roundhill_holdings_playwright.js AAPW
 *
 *   # 전체 Roundhill ETF
 *   node scripts/scrape_roundhill_holdings_playwright.js --all
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

/**
 * nav.json에서 Roundhill Investments 회사의 모든 티커 가져오기
 */
function getRoundhillTickersFromNav() {
    try {
        const navPath = path.join(process.cwd(), 'public', 'nav.json');
        if (!existsSync(navPath)) {
            console.warn(`⚠️  nav.json을 찾을 수 없습니다: ${navPath}`);
            console.warn('⚠️  하드코딩된 목록을 사용합니다.');
            return getHardcodedRoundhillTickers();
        }

        const navData = JSON.parse(readFileSync(navPath, 'utf8'));
        const roundhillTickers = navData.nav
            .filter((item) => item.company === 'Roundhill Investments')
            .map((item) => item.symbol)
            .sort();

        console.log(
            `✅ nav.json에서 ${roundhillTickers.length}개의 Roundhill ETF 발견`
        );
        return roundhillTickers;
    } catch (error) {
        console.warn(`⚠️  nav.json 읽기 실패: ${error.message}`);
        console.warn('⚠️  하드코딩된 목록을 사용합니다.');
        return getHardcodedRoundhillTickers();
    }
}

/**
 * 하드코딩된 Roundhill ETF 목록 (fallback)
 */
function getHardcodedRoundhillTickers() {
    return [
        'AAPW',
        'NFLW',
        'TSLW',
        'NVDW',
        'MSFW',
        'GOOW',
        'AMZW',
        'METW',
        'PLTW',
        'COIW',
        'HOOW',
        'MSTW',
        'BRKW',
        'AMDW',
        'AVGW',
        'ARMW',
        'BABW',
        'COSW',
        'UBEW',
        'GDXW',
        'GLDW',
        'WPAY',
        'XDTE',
        'QDTE',
        'RDTE',
        'XPAY',
        'YBTC',
        'YETH',
        'MAGY',
        'METV',
        'MAGS',
        'CHAT',
        'BETZ',
        'NERD',
        'OZEM',
        'WEED',
        'MAGC',
        'UX',
        'HUMN',
        'MEME',
        'WEEK',
        'XDIV',
        'MAGX',
        'ABNW',
        'ASMW',
        'CRWW',
        'DKNW',
        'LMTW',
        'RDDW',
        'SHOW',
        'TSMW',
        'XOMW',
    ];
}

/**
 * Playwright로 Roundhill ETF Holdings 스크래핑
 */
async function scrapeRoundhillHoldings(ticker, browser) {
    const url = `https://www.roundhillinvestments.com/etf/${ticker.toLowerCase()}/`;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`스크래핑 중: ${ticker}`);
    console.log(`URL: ${url}`);
    console.log('='.repeat(60));

    const context = await browser.newContext({
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    try {
        // 페이지 로드
        await page.goto(url, { waitUntil: 'networkidle' });
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

            // 스크린샷
            const screenshotPath = `debug_playwright_${ticker.toLowerCase()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 디버깅용 스크린샷 저장: ${screenshotPath}`);

            await context.close();
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
                    viewAllButton = document.querySelector(
                        '[data-open="holdingsModal"]'
                    );
                }

                // 3. aria-label="Holdings" 시도
                if (!viewAllButton) {
                    viewAllButton = document.querySelector(
                        '[aria-label="Holdings"]'
                    );
                }

                // 4. 텍스트로 찾기 (fallback)
                if (!viewAllButton) {
                    const links = Array.from(document.querySelectorAll('a'));
                    viewAllButton = links.find((link) =>
                        link.textContent
                            ?.trim()
                            .toLowerCase()
                            .includes('view all')
                    );
                }

                if (viewAllButton) {
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
                console.log(
                    '⚠️ "View All" 버튼을 찾을 수 없음 (기본 테이블 사용)'
                );
            }
        } catch (e) {
            console.log('⚠️ "View All" 버튼 클릭 실패 (기본 테이블 사용)');
            console.log(`   오류: ${e.message}`);
        }

        // 날짜 추출
        const asOfDate = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const match = bodyText.match(
                /as of\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i
            );
            return match ? match[1] : null;
        });

        if (asOfDate) {
            console.log(`📅 날짜: ${asOfDate}`);
        }

        // Holdings 데이터 추출 (모달 또는 메인 페이지)
        const holdingsInfo = await page.evaluate(() => {
            let holdingsTable = null;
            let source = '';

            // 1. 메인 페이지 Holdings 테이블 우선 (MAGS, WEED 등 - View All 버튼 없음)
            // 데스크톱용
            const mainTbody = document.querySelector('#fund-topTenHoldings');
            if (mainTbody) {
                holdingsTable = mainTbody.closest('table');
                source = 'Main Page Desktop (#fund-topTenHoldings)';
            }

            // 2. 메인 페이지 모바일 테이블
            if (!holdingsTable) {
                const mainTbodyMobile = document.querySelector(
                    '.fund-topTenHoldings-mobile'
                );
                if (mainTbodyMobile) {
                    holdingsTable = mainTbodyMobile.closest('table');
                    source = 'Main Page Mobile (.fund-topTenHoldings-mobile)';
                }
            }

            // 3. 모달 내 데스크톱 테이블 찾기 (View All 클릭 후)
            if (!holdingsTable) {
                const modalTable = document.querySelector(
                    '#fullHoldingsTablex'
                );
                if (modalTable) {
                    holdingsTable = modalTable;
                    source = 'Modal Desktop (#fullHoldingsTablex)';
                }
            }

            // 4. 모달 내 모바일 테이블 (View All 클릭 후)
            if (!holdingsTable) {
                const modalMobile = document.querySelector('.modaltablemobile');
                if (modalMobile) {
                    holdingsTable = modalMobile;
                    source = 'Modal Mobile (.modaltablemobile)';
                }
            }

            // 5. 헤더로 테이블 찾기 (최종 fallback)
            if (!holdingsTable) {
                const tables = Array.from(document.querySelectorAll('table'));
                for (const table of tables) {
                    const headerCells = Array.from(
                        table.querySelectorAll('thead th')
                    );
                    const headerText = headerCells
                        .map((cell) => cell.innerText.trim().toLowerCase())
                        .join(' ');

                    if (
                        (headerText.includes('ticker') &&
                            headerText.includes('name')) ||
                        (headerText.includes('identifier') &&
                            headerText.includes('shares')) ||
                        (headerText.includes('name') &&
                            headerText.includes('weight'))
                    ) {
                        holdingsTable = table;
                        source = 'Header Match';
                        break;
                    }
                }
            }

            if (!holdingsTable) {
                return { holdings: [], source: 'Not Found' };
            }

            // Holdings 테이블의 데이터 행만 추출
            const rows = Array.from(holdingsTable.querySelectorAll('tbody tr'));

            const processedRows = rows
                .map((row) => {
                    const cells = Array.from(row.querySelectorAll('td'));

                    // 빈 행 필터링: 모든 셀이 비어있으면 무시
                    if (cells.length === 0) return null;

                    const hasContent = cells.some((cell) => {
                        const text = cell.innerText.trim();
                        return text && text !== '-' && text !== '';
                    });

                    if (!hasContent) return null;

                    let data = {};

                    if (cells.length >= 6) {
                        data = {
                            ticker: cells[0]?.innerText?.trim() || '',
                            name: cells[1]?.innerText?.trim() || '',
                            identifier: cells[2]?.innerText?.trim() || '',
                            weight: cells[3]?.innerText?.trim() || '',
                            shares: cells[4]?.innerText?.trim() || '',
                            marketValue: cells[5]?.innerText?.trim() || '',
                        };
                    } else if (cells.length === 2) {
                        data = {
                            name: cells[0]?.innerText?.trim() || '',
                            weight: cells[1]?.innerText?.trim() || '',
                            ticker: null,
                        };
                    } else if (cells.length >= 3) {
                        data = {
                            raw: cells.map((c) => c.innerText.trim()),
                        };
                    } else {
                        return null;
                    }

                    return data;
                })
                .filter((item) => item !== null);

            return { holdings: processedRows, source: source };
        });

        console.log(
            `✅ Holdings 데이터 추출: ${holdingsInfo.holdings.length}개 (출처: ${holdingsInfo.source})`
        );

        const holdings = holdingsInfo.holdings;

        if (holdings.length === 0) {
            console.log('⚠️ 추출된 holdings가 없습니다.');

            // 디버깅: 스크린샷 저장
            const screenshotPath = `debug_playwright_no_holdings_${ticker.toLowerCase()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 디버깅용 스크린샷 저장: ${screenshotPath}`);

            await context.close();
            return null;
        }

        // 샘플 출력 (처음 5개)
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

    const hasFullData =
        holdings[0].ticker !== undefined && holdings[0].ticker !== null;

    if (hasFullData) {
        lines.push(
            'Ticker\tName\tIdentifier\tETF Weight\tShares\tMarket Value'
        );
        holdings.forEach((h) => {
            lines.push(
                `${h.ticker || ''}\t${h.name || ''}\t${h.identifier || ''}\t${h.weight || ''}\t${h.shares || ''}\t${h.marketValue || ''}`
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
    const outputPath = `public/holdings/roundhill_${timestamp}_playwright.txt`;

    let content = [];

    for (const data of dataList) {
        if (!data) continue;

        content.push(data.ticker.toUpperCase());
        content.push(
            `as of ${data.asOfDate || new Date().toLocaleDateString('en-US')}`
        );
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
    console.log(
        `\n사용법: python scripts/add_roundhill_holdings.py --batch ${outputPath}`
    );

    return outputPath;
}

/**
 * 메인 함수
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('사용법:');
        console.log(
            '  node scripts/scrape_roundhill_holdings_playwright.js AAPW'
        );
        console.log(
            '  node scripts/scrape_roundhill_holdings_playwright.js --all'
        );
        process.exit(1);
    }

    let tickers = [];
    if (args[0] === '--all') {
        tickers = getRoundhillTickersFromNav();
    } else {
        tickers = args.map((t) => t.toUpperCase());
    }

    console.log('🚀 Roundhill ETF Holdings 자동 스크래핑 (Playwright)');
    console.log(`📊 대상: ${tickers.length}개 ETF`);
    console.log('='.repeat(60));

    const browser = await chromium.launch({ headless: true });
    console.log('✅ 브라우저 실행');

    const results = [];

    for (const ticker of tickers) {
        const data = await scrapeRoundhillHoldings(ticker, browser);

        if (data) {
            results.push(data);
        }

        // 요청 사이 대기
        if (tickers.length > 1) {
            console.log('⏳ 2초 대기...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
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
        console.log(
            `  python scripts/add_roundhill_holdings.py --batch ${batchFile}`
        );
    }
}

main().catch((error) => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
});
