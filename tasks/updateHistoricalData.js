// tasks/updateHistoricalData.js

import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

// 전역 설정은 그대로 유지합니다. 이것이 없으면 다른 종류의 validation 에러가 발생할 수 있습니다.
yahooFinance.setGlobalConfig({
    validation: {
        logErrors: true,
        failOnUnknownProperties: false,
        failOnInvalidData: false,
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
        const queryOptions = {
            period1: FROM,
        };

        const historicalPromise = yahooFinance.historical(symbol, queryOptions);

        // [핵심 수정] events: 'div' 옵션을 다시 추가합니다. (이전 코드에서 누락됨)
        const dividendPromise = yahooFinance.historical(symbol, queryOptions, {
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
    console.log('Starting historical data update...');

    await fs.mkdir(HISTORICAL_DATA_DIR, { recursive: true });
    await fs.mkdir(DIVIDEND_DATA_DIR, { recursive: true });

    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
    const allSymbols = navData.nav.map((item) => item.symbol);
    const symbolsToFetch = [...new Set([...allSymbols, 'SPY'])];

    console.log(`Found ${symbolsToFetch.length} symbols to update.`);

    let successCount = 0;
    let failureCount = 0;
    const failedSymbols = [];

    for (const [index, symbol] of symbolsToFetch.entries()) {
        console.log(
            `\nProcessing ${index + 1} / ${symbolsToFetch.length}: ${symbol}`
        );
        const result = await fetchAndSaveData(symbol);

        if (result.success) {
            successCount++;
        } else {
            failureCount++;
            failedSymbols.push(result.symbol);
        }

        await delay(200);
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failureCount}`
    );
    if (failureCount > 0) {
        console.log('Failed symbols:', failedSymbols.join(', '));
    }
}

main();
