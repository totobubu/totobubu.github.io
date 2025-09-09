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

async function updateBacktestData(symbol) {
    try {
        const filePath = path.join(DATA_DIR, `${symbol.toLowerCase()}.json`);
        let existingData = {
            tickerInfo: {},
            dividendHistory: [],
            backtestData: { prices: [], dividends: [] },
        };
        let lastPriceDate = null;

        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
            const prices = existingData.backtestData?.prices;
            if (prices && prices.length > 0) {
                lastPriceDate = prices[prices.length - 1].date;
            }
        } catch (error) {
            // 파일 없음
        }

        const startDate = new Date();
        if (lastPriceDate) {
            startDate.setTime(
                new Date(lastPriceDate).getTime() + 24 * 60 * 60 * 1000
            );
        } else {
            startDate.setFullYear(startDate.getFullYear() - 10);
        }

        const from = startDate.toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        if (from > today) {
            console.log(`- [${symbol}] Data is already up to date.`);
            return { success: true, symbol };
        }

        const queryOptions = { period1: from };
        const priceData = await yahooFinance.historical(symbol, queryOptions);
        const dividendDataRaw = await yahooFinance.historical(
            symbol,
            queryOptions,
            { events: 'div' }
        );

        const newPrices = (priceData || []).map((p) => ({
            date: p.date.toISOString().split('T')[0],
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
            volume: p.volume,
        }));

        // [핵심 수정] amount가 유효한 데이터만 필터링합니다.
        const newDividends = (dividendDataRaw || [])
            .filter((d) => typeof d.amount === 'number' && !isNaN(d.amount))
            .map((d) => ({
                date: d.date.toISOString().split('T')[0],
                amount: d.amount,
            }));

        const existingPrices = existingData.backtestData?.prices || [];
        const existingDividends = existingData.backtestData?.dividends || [];

        const finalPrices = [...existingPrices, ...newPrices];
        const finalDividends = [...existingDividends, ...newDividends];

        const uniquePrices = Array.from(
            new Map(finalPrices.map((item) => [item.date, item])).values()
        );
        const uniqueDividends = Array.from(
            new Map(finalDividends.map((item) => [item.date, item])).values()
        );

        const finalData = {
            ...existingData,
            backtestData: {
                prices: uniquePrices.sort(
                    (a, b) => new Date(a.date) - new Date(b.date)
                ),
                dividends: uniqueDividends.sort(
                    (a, b) => new Date(a.date) - new Date(b.date)
                ),
            },
        };

        await fs.writeFile(
            filePath,
            JSON.stringify(finalData, null, 2),
            'utf-8'
        );
        console.log(
            `✅ [${symbol}] Backtest data updated. Added ${newPrices.length} price points, ${newDividends.length} valid dividends.`
        );
        return { success: true, symbol };
    } catch (error) {
        if (error.message.includes('No data found')) {
            console.warn(
                `- [${symbol}] No historical data found, symbol may be delisted or new.`
            );
            return { success: true, symbol, message: 'No data' };
        }
        console.error(
            `❌ [${symbol}] Failed to update backtest data:`,
            error.message
        );
        return { success: false, symbol, error: error.message };
    }
}

async function main() {
    console.log('--- Starting Incremental Backtest Data Update ---');
    await fs.mkdir(DATA_DIR, { recursive: true });

    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
    const activeSymbols = navData.nav
        .filter((item) => !item.upcoming)
        .map((item) => item.symbol);
    const symbolsToFetch = [...new Set([...activeSymbols, 'SPY'])];

    console.log(`Found ${symbolsToFetch.length} active symbols to update.`);
    let successCount = 0,
        failureCount = 0;
    const failedSymbols = [];

    for (const [index, symbol] of symbolsToFetch.entries()) {
        console.log(
            `\nProcessing ${index + 1} / ${symbolsToFetch.length}: ${symbol}`
        );
        const result = await updateBacktestData(symbol);
        if (result.success) successCount++;
        else {
            failureCount++;
            failedSymbols.push(result);
        }
        await delay(200);
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failureCount}`
    );
    if (failureCount > 0) console.log('Failed symbols info:', failedSymbols);
}

main();
