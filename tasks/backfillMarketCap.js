// tasks/backfillMarketCap.js
/**
 * 과거 시가총액(marketCap) 데이터를 Financial Modeling Prep API로부터 가져와
 * 각 티커의 backtestData에 추가하는 스크립트 (1회성 실행용)
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE = path.join(PUBLIC_DIR, 'nav.json');

const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

// API 호출 간격 (ms) - 무료 플랜: 250 calls/day, ~5분당 1회
const API_DELAY = 350;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeSymbol(symbol) {
    return symbol.replace(/\./g, '-').toLowerCase();
}

/**
 * Financial Modeling Prep API에서 과거 시가총액 데이터 가져오기
 * @param {string} symbol - 티커 심볼
 * @param {string} from - 시작 날짜 (YYYY-MM-DD)
 * @param {string} to - 종료 날짜 (YYYY-MM-DD)
 * @returns {Array} - {date, marketCap} 배열
 */
async function fetchHistoricalMarketCap(symbol, from, to) {
    if (!FMP_API_KEY) {
        console.error('❌ FMP_API_KEY not set');
        return [];
    }

    try {
        const url = `${FMP_BASE_URL}/historical-market-capitalization/${symbol}`;
        const params = {
            apikey: FMP_API_KEY,
            from,
            to,
        };

        const response = await axios.get(url, { params, timeout: 15000 });
        const data = response.data;

        if (!Array.isArray(data) || data.length === 0) {
            console.log(`ℹ️  No historical market cap data for ${symbol}`);
            return [];
        }

        return data.map((item) => ({
            date: item.date,
            marketCap: item.marketCap,
        }));
    } catch (error) {
        if (error.response?.status === 404) {
            console.log(`⚠️  ${symbol}: Market cap data not available`);
        } else {
            console.error(
                `❌ Error fetching market cap for ${symbol}: ${error.message}`
            );
        }
        return [];
    }
}

/**
 * 티커 파일에 과거 marketCap 데이터 병합
 */
async function backfillTickerMarketCap(symbol) {
    const sanitized = sanitizeSymbol(symbol);
    const filePath = path.join(DATA_DIR, `${sanitized}.json`);

    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        const backtestData = data.backtestData || [];
        if (backtestData.length === 0) {
            return { success: false, symbol, reason: 'no_backtest_data' };
        }

        // 🔥 이미 과거 marketCap 데이터가 있는지 확인
        const hasMarketCap = backtestData.some(
            (entry) => entry.marketCap !== undefined && entry.marketCap !== null
        );
        
        if (hasMarketCap) {
            // 이미 데이터가 있으면 스킵
            return { success: true, symbol, skipped: true, reason: 'already_has_data' };
        }

        // backtestData의 첫 날짜와 마지막 날짜 찾기
        const dates = backtestData.map((d) => d.date).sort();
        const fromDate = dates[0];
        const toDate = dates[dates.length - 1];

        console.log(
            `📊 ${symbol}: Fetching market cap from ${fromDate} to ${toDate}`
        );

        // API에서 과거 시가총액 가져오기
        const historicalMarketCap = await fetchHistoricalMarketCap(
            symbol,
            fromDate,
            toDate
        );

        if (historicalMarketCap.length === 0) {
            return { success: false, symbol, reason: 'no_data' };
        }

        // marketCap 데이터를 Map으로 변환
        const marketCapMap = new Map(
            historicalMarketCap.map((item) => [item.date, item.marketCap])
        );

        // backtestData에 marketCap 추가
        let updatedCount = 0;
        for (const entry of backtestData) {
            const date = entry.date;
            if (marketCapMap.has(date)) {
                entry.marketCap = marketCapMap.get(date);
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            // 파일 저장
            await fs.writeFile(
                filePath,
                JSON.stringify(data, null, 2),
                'utf-8'
            );
            console.log(
                `✅ ${symbol}: Added market cap to ${updatedCount} entries`
            );
            return { success: true, symbol, updated: updatedCount };
        } else {
            return { success: false, symbol, reason: 'no_matching_dates' };
        }
    } catch (error) {
        console.error(`❌ Error processing ${symbol}: ${error.message}`);
        return { success: false, symbol, error: error.message };
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('📈 Backfilling Historical Market Cap Data');
    console.log('='.repeat(60));

    if (!FMP_API_KEY) {
        console.error('❌ Error: FMP_API_KEY environment variable not set.');
        console.log(
            '👉 Get your free API key at: https://financialmodelingprep.com/developer/docs/'
        );
        process.exit(1);
    }

    // 명령줄 인자로 배치 범위 지정 가능
    const args = process.argv.slice(2);
    const batchStart = args[0] ? parseInt(args[0]) : 0;
    const batchSize = args[1] ? parseInt(args[1]) : 200; // 기본 200개

    // nav.json에서 활성 티커 목록 가져오기
    let navData;
    try {
        const navContent = await fs.readFile(NAV_FILE, 'utf-8');
        navData = JSON.parse(navContent);
    } catch (error) {
        console.error(`❌ Error reading nav.json: ${error.message}`);
        process.exit(1);
    }

    const activeTickers = navData.nav
        .filter((t) => t.symbol && !t.upcoming)
        .map((t) => t.symbol);

    if (activeTickers.length === 0) {
        console.log('⚠️  No active tickers found');
        return;
    }

    console.log(`📊 Total active tickers: ${activeTickers.length}`);

    // 배치 범위 계산
    const startIdx = batchStart;
    const endIdx = Math.min(startIdx + batchSize, activeTickers.length);
    const tickersBatch = activeTickers.slice(startIdx, endIdx);

    console.log(`\n🔄 Batch range: ${startIdx} to ${endIdx - 1}`);
    console.log(`📊 Processing ${tickersBatch.length} tickers`);
    console.log(`⏱️  Estimated time: ~${Math.ceil((tickersBatch.length * API_DELAY) / 1000 / 60)} minutes`);
    console.log(
        `\n💡 Tip: Run in batches to stay within API limits (250/day)`
    );
    console.log(`   Example: npm run backfill-market-cap 0 200`);
    console.log(`            npm run backfill-market-cap 200 200`);
    console.log(`            npm run backfill-market-cap 400 200\n`);

    const results = {
        success: 0,
        failed: 0,
        totalUpdated: 0,
    };

    // 각 티커 처리 (API 제한 고려)
    for (let i = 0; i < tickersBatch.length; i++) {
        const symbol = tickersBatch[i];
        const globalIdx = startIdx + i;
        console.log(
            `\n[${globalIdx + 1}/${activeTickers.length}] Processing ${symbol}...`
        );

        const result = await backfillTickerMarketCap(symbol);

        if (result.success) {
            results.success++;
            results.totalUpdated += result.updated || 0;
        } else {
            results.failed++;
        }

        // API 호출 간격 대기 (마지막 티커는 제외)
        if (i < tickersBatch.length - 1) {
            await sleep(API_DELAY);
        }
    }

    // 최종 결과
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${results.success} tickers`);
    console.log(`❌ Failed: ${results.failed} tickers`);
    console.log(`📝 Total entries updated: ${results.totalUpdated}`);
    console.log('='.repeat(60));
}

main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

