// scripts\fetch_all_exchange_rates.js
import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

const OUTPUT_FILE = path.resolve(
    process.cwd(),
    'public',
    'exchange-rates.json'
);

async function fetchAllRates() {
    console.log('Fetching all historical exchange rates for USDKRW=X...');
    try {
        // 최대한 긴 기간의 데이터를 요청합니다 (1990년부터)
        const historicalData = await yahooFinance.historical('USDKRW=X', {
            period1: '1990-01-01',
            interval: '1d',
        });

        if (!historicalData || historicalData.length === 0) {
            throw new Error('No exchange rate data found.');
        }

        const rates = historicalData.map((d) => ({
            date: d.date.toISOString().split('T')[0],
            rate: d.close,
        }));

        await fs.writeFile(OUTPUT_FILE, JSON.stringify(rates, null, 2));

        console.log(
            `✅ Successfully fetched and saved ${rates.length} records to ${OUTPUT_FILE}`
        );
    } catch (error) {
        console.error('❌ Failed to fetch exchange rates:', error);
    }
}

fetchAllRates();
