// REFACTORED: tasks/updateHistoricalData.js

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
const sanitizeTickerForFilename = (ticker) =>
    ticker.replace(/\./g, '-').toLowerCase();

function getYahooTicker(symbol, market) {
    if (market === 'KOSPI') return `${symbol}.KS`;
    if (market === 'KOSDAQ') return `${symbol}.KQ`;
    return symbol;
}

async function fetchAndSavePriceData(ticker) {
    const { symbol, ipoDate, market } = ticker;
    const sanitizedSymbol = sanitizeTickerForFilename(symbol);
    const filePath = path.join(DATA_DIR, `${sanitizedSymbol}.json`);

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
                `- [${symbol}] No existing data file. Fetching all historical data.`
            );
        }

        const startDate = new Date(lastPriceDate || ipoDate || '1990-01-01');
        if (lastPriceDate) startDate.setDate(startDate.getDate() + 1);

        const period1 = startDate.toISOString().split('T')[0];
        if (new Date(period1) > new Date()) {
            console.log(`- [${symbol}] Price data is already up to date.`);
            return { success: true, symbol };
        }

        const yahooTicker = getYahooTicker(symbol, market);
        console.log(
            `Fetching price data for ${symbol} (as ${yahooTicker}) from ${period1}...`
        );

        const newPriceData = await yahooFinance.historical(yahooTicker, {
            period1,
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

        if (!existingData.backtestData) existingData.backtestData = {};
        existingData.backtestData.prices = uniquePrices;

        await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
        console.log(
            `✅ [${symbol}] Price data updated. Added ${newPriceData.length} records. Total: ${uniquePrices.length}.`
        );
        return { success: true, symbol };
    } catch (error) {
        const errorMessage = error.message.includes('No data found')
            ? 'No data found'
            : error.message;
        console.error(
            `❌ [${symbol}] Failed to fetch/save data: ${errorMessage}`
        );
        return { success: false, symbol, error: errorMessage };
    }
}

async function main() {
    console.log('--- Starting Incremental Price Data Update (Node.js) ---');
    await fs.mkdir(DATA_DIR, { recursive: true });

    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));

    // --- [핵심 수정] ---
    // 1. nav.json 데이터에서 upcoming이 아닌 종목만 필터링합니다.
    const activeNavItems = navData.nav.filter((item) => !item.upcoming);
    // --- // ---

    const spyInfo = { symbol: 'SPY', ipoDate: '1993-01-22', market: 'ARCA' };

    // --- [핵심 수정] ---
    // 2. 필터링된 activeNavItems를 사용하여 tickersToFetch 배열을 만듭니다.
    const tickersToFetch = [...activeNavItems, spyInfo];
    // --- // ---

    const uniqueTickers = Array.from(
        new Map(tickersToFetch.map((t) => [t.symbol, t])).values()
    );

    console.log(`Found ${uniqueTickers.length} active symbols to update.`);
    const concurrency = 10;
    let successCount = 0;
    const failedSymbols = [];

    for (let i = 0; i < uniqueTickers.length; i += concurrency) {
        const chunk = uniqueTickers.slice(i, i + concurrency);
        console.log(
            `\nProcessing chunk ${Math.floor(i / concurrency) + 1} (${chunk.map((t) => t.symbol).join(', ')})...`
        );

        const results = await Promise.all(
            chunk.map((ticker) => fetchAndSavePriceData(ticker))
        );

        results.forEach((r) => {
            if (r.success) successCount++;
            else failedSymbols.push(r.symbol);
        });
        await delay(500);
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failedSymbols.length}`
    );
    if (failedSymbols.length > 0)
        console.log('Failed symbols:', failedSymbols.join(', '));
}

main();
