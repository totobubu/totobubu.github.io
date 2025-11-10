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

async function fetchSplitEvents(symbol, fromDate) {
    const period1 = Math.floor(new Date(fromDate).getTime() / 1000);
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=div,splits`;

    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (data.chart.error)
            throw new Error(
                data.chart.error.description || `Unknown error for ${symbol}`
            );

        const result = data.chart.result?.[0];
        if (!result || !result.events || !result.events.splits) return [];

        return Object.values(result.events.splits)
            .map((event) => {
                const numerator = Number(event.numerator);
                const denominator = Number(event.denominator);
                if (!numerator || !denominator || numerator === denominator) {
                    return null;
                }
                const ratio = `${numerator}:${denominator}`;
                const type = numerator > denominator ? 'reverse-split' : 'split';
                return {
                    date: new Date(event.date * 1000).toISOString().split('T')[0],
                    ratio,
                    type,
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.error(`Split API Error for ${symbol}: ${error.message}`);
        return [];
    }
}

async function mergeSplitEvents(existingData, newSplits) {
    const existingSplits = existingData?.tickerInfo?.events?.splits || [];
    const splitMap = new Map(
        existingSplits.map((event) => [
            `${event.date}|${event.ratio}|${event.type}`,
            event,
        ])
    );

    newSplits.forEach((event) => {
        const signature = `${event.date}|${event.ratio}|${event.type}`;
        if (!splitMap.has(signature)) {
            splitMap.set(signature, event);
        }
    });

    const finalSplits = Array.from(splitMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
    );

    existingData.tickerInfo = {
        ...(existingData.tickerInfo || {}),
        events: {
            ...(existingData.tickerInfo?.events || {}),
            splits: finalSplits,
        },
    };
}

async function fetchAndMergePriceData(ticker) {
    const { symbol, ipoDate } = ticker;
    const sanitizedSymbol = sanitizeTickerForFilename(symbol);
    const filePath = path.join(DATA_DIR, `${sanitizedSymbol}.json`);

    try {
        let existingData = {};
        let backtestMap = new Map();
        let lastPriceDate = null;
        let isNewFile = false;

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
            /* 파일 없으면 기본 구조로 초기화 */
            isNewFile = true;
            existingData = {
                tickerInfo: {},
                backtestData: [],
            };
        }

        const startDate = new Date(lastPriceDate || ipoDate || '1990-01-01');
        if (lastPriceDate) startDate.setDate(startDate.getDate() + 1);

        const from = startDate.toISOString().split('T')[0];

        const oldBacktestStr = JSON.stringify(existingData.backtestData || []);
        const existingSplits =
            existingData?.tickerInfo?.events?.splits || [];
        const oldSplitsStr = JSON.stringify(existingSplits);

        // 가격 데이터 병합
        const newPriceData = await fetchHistoricalData(symbol, from);
        let finalBacktestData = existingData.backtestData || [];

        if (newPriceData.length > 0) {
            newPriceData.forEach((p) => {
                const existingEntry = backtestMap.get(p.date) || { date: p.date };
                backtestMap.set(p.date, { ...existingEntry, ...p });
            });

            finalBacktestData = Array.from(backtestMap.values()).sort((a, b) =>
                a.date.localeCompare(b.date)
            );
        }

        const backtestChanged =
            JSON.stringify(finalBacktestData) !== oldBacktestStr;

        // 분할/병합 데이터 병합
        const splitStartDate = existingSplits.length
            ? existingSplits.reduce((latest, event) =>
                  event.date > latest ? event.date : latest
              , existingSplits[0].date)
            : ipoDate || '1990-01-01';

        const splitEvents = await fetchSplitEvents(symbol, splitStartDate);

        const splitMap = new Map(
            existingSplits.map((event) => [
                `${event.date}|${event.ratio}|${event.type}`,
                event,
            ])
        );

        splitEvents.forEach((event) => {
            const signature = `${event.date}|${event.ratio}|${event.type}`;
            if (!splitMap.has(signature)) {
                splitMap.set(signature, event);
            }
        });

        const finalSplits = Array.from(splitMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
        );

        const splitsChanged = JSON.stringify(finalSplits) !== oldSplitsStr;

        if (!backtestChanged && !splitsChanged) {
            return { success: true, symbol };
        }

        const tickerInfo = { ...(existingData.tickerInfo || {}) };
        tickerInfo.events = {
            ...(tickerInfo.events || {}),
            splits: finalSplits,
        };

        existingData.tickerInfo = tickerInfo;
        existingData.backtestData = finalBacktestData;

        await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
        console.log(
            `✅ [${symbol}] Updated. Prices: ${backtestChanged ? 'Y' : 'N'}, Splits: ${splitsChanged ? 'Y' : 'N'}${
                isNewFile ? ' (NEW FILE)' : ''
            }`
        );

        return { success: true, symbol };
    } catch (error) {
        console.error(`❌ [${symbol}] Error: ${error.message}`);
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

    // 커맨드라인 인자로 특정 티커 지정 가능
    const targetSymbols = process.argv.slice(2).map((s) => s.toUpperCase());

    let tickersToFetch = [
        ...navData.nav,
        { symbol: 'SPY', ipoDate: '1993-01-22' },
        { symbol: 'QQQ', ipoDate: '1999-03-10' },
        { symbol: 'DIA', ipoDate: '1998-01-14' },
    ].filter((item) => !item.upcoming);

    // 특정 티커만 필터링
    if (targetSymbols.length > 0) {
        tickersToFetch = tickersToFetch.filter((t) =>
            targetSymbols.includes(t.symbol.toUpperCase())
        );
        console.log(
            `[Specific Mode] Updating ${targetSymbols.length} symbol(s): ${targetSymbols.join(', ')}`
        );

        // 지정한 티커가 nav.json에 없는 경우 경고
        const foundSymbols = tickersToFetch.map((t) => t.symbol.toUpperCase());
        const notFoundSymbols = targetSymbols.filter(
            (s) => !foundSymbols.includes(s)
        );
        if (notFoundSymbols.length > 0) {
            console.warn(
                `⚠️  Warning: Symbol(s) not found in nav.json: ${notFoundSymbols.join(', ')}`
            );
        }
    } else {
        console.log(`[Full Mode] Updating all symbols`);
    }

    const uniqueTickers = Array.from(
        new Map(tickersToFetch.map((t) => [t.symbol, t])).values()
    );

    console.log(`Found ${uniqueTickers.length} symbols to update.`);
    const concurrency = 10;
    let successCount = 0;
    const failedSymbols = [];

    for (let i = 0; i < uniqueTickers.length; i += concurrency) {
        const chunk = uniqueTickers.slice(i, i + concurrency);

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
