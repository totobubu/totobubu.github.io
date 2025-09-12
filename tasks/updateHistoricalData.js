// tasks\updateHistoricalData.js
import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

<<<<<<< HEAD
=======
// 유효성 검사는 계속 비활성화 상태로 둡니다.
>>>>>>> 37d65b994530774ab605f494ca8a01b1f85d0093
yahooFinance.setGlobalConfig({
    validation: {
        logErrors: true,
        failOnUnknownProperties: false,
        failOnInvalidData: false,
    },
});

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');

const MAX_HISTORY_DATE = new Date();
MAX_HISTORY_DATE.setFullYear(MAX_HISTORY_DATE.getFullYear() - 10);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAndSavePriceData(ticker) {
    const { symbol, ipoDate } = ticker;
    const filePath = path.join(DATA_DIR, `${symbol.toLowerCase()}.json`);

    try {
        let effectiveStartDate = MAX_HISTORY_DATE;
        if (ipoDate && new Date(ipoDate) > MAX_HISTORY_DATE) {
            effectiveStartDate = new Date(ipoDate);
        }
        const period1 = effectiveStartDate.toISOString().split('T')[0];

        console.log(`Fetching price data for ${symbol} from ${period1}...`);

        // [핵심 수정] 오직 주가 데이터만 요청합니다. (events: 'history')
        const priceData = await yahooFinance.historical(symbol, {
            period1: period1,
            events: 'history',
        });

<<<<<<< HEAD
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
=======
        if (!priceData || priceData.length === 0) {
            const errorMsg = `No data found, symbol may be delisted`;
            console.warn(`- [${symbol}] ${errorMsg}`);
            return { success: false, symbol, error: errorMsg };
        }

        // 기존 파일을 읽고, backtestData.prices만 업데이트합니다.
        let existingData = {};
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
        } catch (error) {
            console.log(
                `- [${symbol}] No existing data file found. Creating new one.`
            );
        }

        if (!existingData.backtestData) {
            existingData.backtestData = {};
>>>>>>> 37d65b994530774ab605f494ca8a01b1f85d0093
        }

        // 받아온 데이터를 필요한 필드만 정제하여 저장
        existingData.backtestData.prices = priceData.map((p) => ({
            date: p.date.toISOString().split('T')[0],
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
            volume: p.volume,
        }));

        await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

        console.log(
            `✅ [${symbol}] Data updated in ${path.basename(filePath)}. Prices: ${priceData.length}`
        );
        return { success: true, symbol };
    } catch (error) {
        // [핵심 수정] 'No data found' 에러를 실패로 간주하고 명확히 로깅합니다.
        const errorMessage = error.message.includes('No data found')
            ? 'No data found, symbol may be delisted'
            : error.message;
        console.error(
            `❌ [${symbol}] Failed to fetch or save data: ${errorMessage}`
        );
        return { success: false, symbol, error: errorMessage };
    }
}

async function main() {
<<<<<<< HEAD
    console.log('Starting historical and dividend data update...');

    await fs.mkdir(HISTORICAL_DATA_DIR, { recursive: true });
    await fs.mkdir(DIVIDEND_DATA_DIR, { recursive: true });
=======
    console.log('--- Starting Price Data Update (Node.js) ---');
    await fs.mkdir(DATA_DIR, { recursive: true });
>>>>>>> 37d65b994530774ab605f494ca8a01b1f85d0093

    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));

    const allTickersInfo = navData.nav;
    const spyInfo = { symbol: 'SPY', ipoDate: '1993-01-22' };
    const tickersToFetch = [...allTickersInfo, spyInfo];
    const uniqueTickers = Array.from(
        new Map(tickersToFetch.map((t) => [t.symbol, t])).values()
    );

<<<<<<< HEAD
=======
    console.log(`Found ${uniqueTickers.length} symbols to update.`);

>>>>>>> 37d65b994530774ab605f494ca8a01b1f85d0093
    const concurrency = 10;
    let successCount = 0;
    let failureCount = 0;
    const failedSymbols = [];

<<<<<<< HEAD
    for (let i = 0; i < symbolsToFetch.length; i += concurrency) {
        const chunk = symbolsToFetch.slice(i, i + concurrency);
        console.log(
            `\nProcessing chunk ${Math.floor(i / concurrency) + 1} (${chunk.join(', ')})...`
        );
        const results = await Promise.all(
            chunk.map((symbol) => fetchAndSaveData(symbol))
=======
    for (let i = 0; i < uniqueTickers.length; i += concurrency) {
        const chunk = uniqueTickers.slice(i, i + concurrency);
        const chunkSymbols = chunk.map((t) => t.symbol);
        console.log(
            `\nProcessing chunk ${Math.floor(i / concurrency) + 1} (${chunkSymbols.join(', ')})...`
        );

        const results = await Promise.all(
            chunk.map((ticker) => fetchAndSavePriceData(ticker))
>>>>>>> 37d65b994530774ab605f494ca8a01b1f85d0093
        );
        results.forEach((r) => {
            if (r.success) {
                successCount++;
            } else {
                failureCount++;
                failedSymbols.push(r.symbol);
            }
        });
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failureCount}`
    );
    if (failureCount > 0) {
        console.log('Failed symbols:', failedSymbols.join(', '));
    }
}

main();
