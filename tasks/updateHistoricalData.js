import fs from 'fs/promises';
import path from 'path';
import axios from 'axios'; // [핵심] axios를 사용합니다.

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeTickerForFilename = (ticker) =>
    ticker.replace(/\./g, '-').toLowerCase();

// [핵심] axios를 사용하여 Yahoo Finance API를 직접 호출하는 함수
async function fetchHistoricalData(symbol, fromDate) {
    const period1 = Math.floor(new Date(fromDate).getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

    const { data } = await axios.get(url, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
    });

    if (data.chart.error) {
        throw new Error(
            data.chart.error.description || `Unknown error for ${symbol}`
        );
    }

    const result = data.chart.result[0];
    if (!result || !result.timestamp) {
        return [];
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    return timestamps
        .map((ts, i) => ({
            date: new Date(ts * 1000).toISOString().split('T')[0],
            open: quotes.open[i],
            high: quotes.high[i],
            low: quotes.low[i],
            close: quotes.close[i],
            volume: quotes.volume[i],
        }))
        .filter((p) => p.close !== null); // close 가격이 없는 데이터는 제외
}

async function fetchAndSavePriceData(ticker) {
    const { symbol, ipoDate } = ticker;
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
        } catch (error) {}

        const startDate = new Date(lastPriceDate || ipoDate || '1990-01-01');
        if (lastPriceDate) startDate.setDate(startDate.getDate() + 1);

        const from = startDate.toISOString().split('T')[0];
        if (new Date(from) > new Date()) {
            return { success: true, symbol };
        }

        const newPriceData = await fetchHistoricalData(symbol, from);

        if (newPriceData.length === 0) {
            return { success: true, symbol };
        }

        const existingPrices = existingData.backtestData?.prices || [];
        const combinedPrices = [...existingPrices, ...newPriceData];

        const uniquePrices = Array.from(
            new Map(combinedPrices.map((item) => [item.date, item])).values()
        );
        uniquePrices.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (!existingData.backtestData) existingData.backtestData = {};
        existingData.backtestData.prices = uniquePrices;

        await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
        console.log(
            `✅ [${symbol}] Price data updated. Added ${newPriceData.length} records.`
        );
        return { success: true, symbol };
    } catch (error) {
        console.error(`❌ [${symbol}] An error occurred:`, error.message);
        return { success: false, symbol, error: error.message };
    }
}

async function main() {
    console.log(
        '--- Starting Incremental Price Data Update (Node.js/axios) ---'
    );
    await fs.mkdir(DATA_DIR, { recursive: true });

    const navDataContent = await fs.readFile(NAV_FILE_PATH, 'utf-8');
    const navData = JSON.parse(navDataContent);

    const tickersToFetch = [
        ...navData.nav,
        { symbol: 'SPY', ipoDate: '1993-01-22' },
        { symbol: 'QQQ', ipoDate: '1999-03-10' },
        { symbol: 'DIA', ipoDate: '1998-01-14' },
    ].filter((item) => !item.upcoming);

    const uniqueTickers = Array.from(
        new Map(tickersToFetch.map((t) => [t.symbol, t])).values()
    );

    console.log(`Found ${uniqueTickers.length} symbols to update.`);
    const concurrency = 10;
    let successCount = 0;
    const failedSymbols = [];

    for (let i = 0; i < uniqueTickers.length; i += concurrency) {
        const chunk = uniqueTickers.slice(i, i + concurrency);

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
