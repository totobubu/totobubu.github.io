// tasks\updateHistoricalData.js
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

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

    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (data.chart.error)
            throw new Error(
                data.chart.error.description || `Unknown error for ${symbol}`
            );

        const result = data.chart.result[0];
        if (!result || !result.timestamp) return [];

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
            .filter((p) => p.close != null);
    } catch (error) {
        console.error(`API Error for ${symbol}: ${error.message}`);
        return [];
    }
}

async function fetchAndMergePriceData(ticker) {
    const { symbol, ipoDate } = ticker;
    const sanitizedSymbol = sanitizeTickerForFilename(symbol);
    const filePath = path.join(DATA_DIR, `${sanitizedSymbol}.json`);

    try {
        let existingData = {};
        let backtestMap = new Map();
        let lastPriceDate = null;

        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
            const backtestData = existingData.backtestData || [];

            backtestData.forEach((item) => backtestMap.set(item.date, item));
            const datesWithPrice = backtestData
                .filter((d) => d.close)
                .map((d) => d.date);
            if (datesWithPrice.length > 0) {
                datesWithPrice.sort();
                lastPriceDate = datesWithPrice[datesWithPrice.length - 1];
            }
        } catch (error) {
            /* 파일 없으면 진행 */
        }

        const startDate = new Date(lastPriceDate || ipoDate || '1990-01-01');
        if (lastPriceDate) startDate.setDate(startDate.getDate() + 1);

        const from = startDate.toISOString().split('T')[0];
        if (new Date(from) > new Date()) return { success: true, symbol };

        // [핵심] axios 함수 호출
        const newPriceData = await fetchHistoricalData(symbol, from);

        if (newPriceData.length === 0) return { success: true, symbol };

        // [핵심] 기존 데이터와 병합 (기존의 amount, amountFixed 등 보존)
        newPriceData.forEach((p) => {
            const existingEntry = backtestMap.get(p.date) || { date: p.date };
            backtestMap.set(p.date, { ...existingEntry, ...p });
        });

        const finalBacktestData = Array.from(backtestMap.values()).sort(
            (a, b) => a.date.localeCompare(b.date)
        );

        // 변경 사항이 있을 때만 저장
        if (
            JSON.stringify(existingData.backtestData) !==
            JSON.stringify(finalBacktestData)
        ) {
            existingData.backtestData = finalBacktestData;
            await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
            console.log(
                `✅ [${symbol}] Price data updated. Added/merged ${newPriceData.length} records.`
            );
        }

        return { success: true, symbol };
    } catch (error) {
        console.error(`❌ [${symbol}] Error: ${error.message}`);
        return { success: false, symbol, error: error.message };
    }
}

async function main() {
    console.log('--- Starting Incremental Price Data Update (Node.js) ---');
    await fs.mkdir(DATA_DIR, { recursive: true });

    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));

    const activeTickers = navData.nav.filter((ticker) => !ticker.upcoming);
    const upcomingCount = navData.nav.length - activeTickers.length;

    console.log(`Found ${navData.nav.length} total tickers in nav.json.`);
    if (upcomingCount > 0) {
        console.log(`Skipping ${upcomingCount} upcoming tickers (e.g., XOMW).`);
    }

    const tickersToFetch = [
        ...activeTickers,
        { symbol: 'SPY', ipoDate: '1993-01-22' },
    ];
    const uniqueTickers = Array.from(
        new Map(tickersToFetch.map((t) => [t.symbol, t])).values()
    );

    console.log(`Found ${uniqueTickers.length} symbols to update.`);
    const concurrency = 10;
    let successCount = 0;
    const failedSymbols = [];

    for (let i = 0; i < uniqueTickers.length; i += concurrency) {
        const chunk = uniqueTickers.slice(i, i + concurrency);
        console.log(
            `\nProcessing chunk ${Math.floor(i / concurrency) + 1} (${chunk.map((t) => t.symbol).join(', ')})...`
        );

        // [핵심 수정] 함수 이름을 올바르게 변경합니다.
        const results = await Promise.all(
            chunk.map((ticker) => fetchAndMergePriceData(ticker))
        );

        results.forEach((r) => {
            if (r.success) successCount++;
            else if (r.symbol) failedSymbols.push(r.symbol);
        });
        await delay(500);
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failedSymbols.length}`
    );
    if (failedSymbols.length > 0) {
        console.log('Failed symbols:', failedSymbols.join(', '));
    }
}

main();
