// tasks\updateHistoricalData.js
import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAndSavePriceData(ticker) {
    const { symbol, ipoDate } = ticker;
    // [핵심 수정] 파일명 생성을 위해 티커를 정규화합니다.
    const sanitizedSymbol = symbol.replace(/\./g, '-');
    const filePath = path.join(
        DATA_DIR,
        `${sanitizedSymbol.toLowerCase()}.json`
    );

    try {
        let existingData = {};
        let lastPriceDate = null;

        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
            const prices = existingData.backtestData?.prices;
            if (prices && prices.length > 0) {
                lastPriceDate = prices[prices.length - 1].date;
            }
        } catch (error) {
            console.log(
                `- [${symbol}] No existing data file found. Fetching all historical data.`
            );
        }

        let effectiveStartDate;
        if (lastPriceDate) {
            const nextDate = new Date(lastPriceDate);
            nextDate.setDate(nextDate.getDate() + 1);
            effectiveStartDate = nextDate;
        } else {
            const maxHistoryDate = new Date();
            maxHistoryDate.setFullYear(maxHistoryDate.getFullYear() - 10);
            effectiveStartDate = maxHistoryDate;
            if (ipoDate && new Date(ipoDate) > maxHistoryDate) {
                effectiveStartDate = new Date(ipoDate);
            }
        }

        const period1 = effectiveStartDate.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        if (new Date(period1) > new Date(today)) {
            console.log(`- [${symbol}] Price data is already up to date.`);
            return { success: true, symbol };
        }

        console.log(`Fetching price data for ${symbol} from ${period1}...`);

        const newPriceData = await yahooFinance.historical(symbol, {
            period1: period1,
            events: 'history',
        });

        if (!newPriceData || newPriceData.length === 0) {
            console.log(
                `- [${symbol}] No new price data found since ${period1}.`
            );
            return { success: true, symbol };
        }

        const existingPrices = existingData.backtestData?.prices || [];
        const combinedPrices = [
            ...existingPrices,
            ...newPriceData.map((p) => ({
                date: p.date.toISOString().split('T')[0],
                open: p.open,
                high: p.high,
                low: p.low,
                close: p.close,
                volume: p.volume,
            })),
        ];

        const uniquePrices = Array.from(
            new Map(combinedPrices.map((item) => [item.date, item])).values()
        );
        uniquePrices.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (!existingData.backtestData) {
            existingData.backtestData = {};
        }
        existingData.backtestData.prices = uniquePrices;

        await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));

        console.log(
            `✅ [${symbol}] Price data updated. Added ${newPriceData.length} new records. Total: ${uniquePrices.length}.`
        );
        return { success: true, symbol };
    } catch (error) {
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
    console.log('--- Starting Incremental Price Data Update (Node.js) ---');
    await fs.mkdir(DATA_DIR, { recursive: true });

    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));

    const allTickersInfo = navData.nav;
    const spyInfo = { symbol: 'SPY', ipoDate: '1993-01-22' };
    const tickersToFetch = [...allTickersInfo, spyInfo];
    const uniqueTickers = Array.from(
        new Map(tickersToFetch.map((t) => [t.symbol, t])).values()
    );

    console.log(`Found ${uniqueTickers.length} symbols to update.`);

    const concurrency = 10;
    let successCount = 0;
    let failureCount = 0;
    const failedSymbols = [];

    for (let i = 0; i < uniqueTickers.length; i += concurrency) {
        const chunk = uniqueTickers.slice(i, i + concurrency);
        const chunkSymbols = chunk.map((t) => t.symbol);
        console.log(
            `\nProcessing chunk ${Math.floor(i / concurrency) + 1} (${chunkSymbols.join(', ')})...`
        );

        const results = await Promise.all(
            chunk.map((ticker) => fetchAndSavePriceData(ticker))
        );

        results.forEach((r) => {
            if (r.success) {
                successCount++;
            } else {
                failureCount++;
                failedSymbols.push(r.symbol);
            }
        });
        await delay(500);
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failureCount}`
    );
    if (failureCount > 0) {
        console.log('Failed symbols:', failedSymbols.join(', '));
    }
}

main();
