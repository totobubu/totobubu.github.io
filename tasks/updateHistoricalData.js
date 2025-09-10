// tasks\updateHistoricalData.js
import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

// [핵심 수정] 라이브러리의 엄격한 유효성 검사를 전역적으로 비활성화합니다.
yahooFinance.setGlobalConfig({
    validation: {
        logErrors: true, // 에러 로그는 계속 남기되,
        failOnUnknownProperties: false, // 스키마에 없는 속성이 있어도 통과
        failOnInvalidData: false, // 데이터가 스키마와 맞지 않아도 에러를 발생시키지 않음
    },
});

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const HISTORICAL_DATA_DIR = path.join(PUBLIC_DIR, 'historical');
const DIVIDEND_DATA_DIR = path.join(PUBLIC_DIR, 'dividends');

const START_DATE = new Date();
START_DATE.setFullYear(START_DATE.getFullYear() - 10);
const FROM = START_DATE.toISOString().split('T')[0];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAndSaveData(symbol) {
    try {
        console.log(`Fetching data for ${symbol}...`);

        const historicalPromise = yahooFinance.historical(symbol, {
            period1: FROM,
        });

        const dividendPromise = yahooFinance.historical(symbol, {
            period1: FROM,
            events: 'div',
        });

        const [historicalData, dividendData] = await Promise.all([
            historicalPromise,
            dividendPromise,
        ]);

        if (historicalData && historicalData.length > 0) {
            const historicalFilePath = path.join(
                HISTORICAL_DATA_DIR,
                `${symbol.toLowerCase()}.json`
            );
            await fs.writeFile(
                historicalFilePath,
                JSON.stringify(historicalData, null, 2)
            );
        }
        if (dividendData && dividendData.length > 0) {
            const dividendFilePath = path.join(
                DIVIDEND_DATA_DIR,
                `${symbol.toLowerCase()}.json`
            );
            await fs.writeFile(
                dividendFilePath,
                JSON.stringify(dividendData, null, 2)
            );
        }

        console.log(`✅ [${symbol}] Data saved successfully.`);
        return { success: true, symbol };
    } catch (error) {
        console.error(
            `❌ [${symbol}] Failed to fetch or save data:`,
            error.message
        );
        return { success: false, symbol, error: error.message };
    }
}

async function main() {
    console.log('Starting historical and dividend data update...');

    await fs.mkdir(HISTORICAL_DATA_DIR, { recursive: true });
    await fs.mkdir(DIVIDEND_DATA_DIR, { recursive: true });

    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
    const allSymbols = navData.nav.map((item) => item.symbol);
    const symbolsToFetch = [...new Set([...allSymbols, 'SPY'])];

    console.log(`Found ${symbolsToFetch.length} symbols to update.`);

    const concurrency = 10;
    let successCount = 0;
    let failureCount = 0;
    const failedSymbols = [];

    for (let i = 0; i < symbolsToFetch.length; i += concurrency) {
        const chunk = symbolsToFetch.slice(i, i + concurrency);
        console.log(
            `\nProcessing chunk ${Math.floor(i / concurrency) + 1} (${chunk.join(', ')})...`
        );
        const results = await Promise.all(
            chunk.map((symbol) => fetchAndSaveData(symbol))
        );
        results.forEach((r) => {
            if (r.success) {
                successCount++;
            } else {
                failureCount++;
                failedSymbols.push(r.symbol);
            }
        });
        await delay(500); // 각 청크 처리 후 약간의 딜레이
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failureCount}`
    );
    if (failureCount > 0) {
        console.log('Failed symbols:', failedSymbols.join(', '));
    }
}

main();
