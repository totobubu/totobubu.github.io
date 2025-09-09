import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

yahooFinance.setGlobalConfig({ validation: { logErrors: true } });

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function updatePriceData(symbol) {
    try {
        const filePath = path.join(DATA_DIR, `${symbol.toLowerCase()}.json`);
        let existingData = { backtestData: { prices: [] } };
        let lastPriceDate = null;

        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            existingData = JSON.parse(fileContent);
            const prices = existingData.backtestData?.prices;
            if (prices && prices.length > 0) {
                lastPriceDate = prices[prices.length - 1].date;
            }
        } catch (error) {}

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
            console.log(`- [${symbol}] Price data is already up to date.`);
            return { success: true, symbol };
        }

        const priceData = await yahooFinance.historical(symbol, {
            period1: from,
        });

        const newPrices = (priceData || []).map((p) => ({
            date: p.date.toISOString().split('T')[0],
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
            volume: p.volume,
        }));

        const finalPrices = [
            ...(existingData.backtestData?.prices || []),
            ...newPrices,
        ];
        const uniquePrices = Array.from(
            new Map(finalPrices.map((item) => [item.date, item])).values()
        );

        const finalData = {
            ...existingData,
            backtestData: {
                ...existingData.backtestData,
                prices: uniquePrices.sort(
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
            `✅ [${symbol}] Price data updated. Added ${newPrices.length} price points.`
        );
        return { success: true, symbol };
    } catch (error) {
        if (error.message.includes('No data found')) {
            console.warn(`- [${symbol}] No price data found.`);
            return { success: true, symbol, message: 'No data' };
        }
        console.error(
            `❌ [${symbol}] Failed to update price data:`,
            error.message
        );
        return { success: false, symbol, error: error.message };
    }
}

async function main() {
    console.log('--- Starting Incremental Price Data Update ---'); // 로그 메시지도 명확하게 변경
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

        // [핵심 수정] updateBacktestData -> updatePriceData 로 변경
        const result = await updatePriceData(symbol);

        if (result.success) {
            successCount++;
        } else {
            failureCount++;
            failedSymbols.push(result);
        }
        await delay(200);
    }

    console.log(
        `\nUpdate complete. Success: ${successCount}, Failure: ${failureCount}`
    );
    if (failureCount > 0) {
        console.log('Failed symbols info:', failedSymbols);
    }
}

main();
