// scripts\fetch_all_exchange_rates.js
import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

const OUTPUT_FILE = path.resolve(
    process.cwd(),
    'public',
    'exchange-rates.json'
);

async function updateLatestRates() {
    console.log('--- Starting Daily Exchange Rate Update ---');

    let existingRates = [];
    let lastDate = null;

    try {
        const fileContent = await fs.readFile(OUTPUT_FILE, 'utf-8');
        existingRates = JSON.parse(fileContent);
        if (existingRates.length > 0) {
            lastDate = existingRates[existingRates.length - 1].date;
            console.log(
                `Last recorded date is ${lastDate}. Fetching new data since then.`
            );
        }
    } catch (error) {
        console.error(
            `⚠️ Could not read ${OUTPUT_FILE}. Will try to fetch all data.`,
            error
        );
        lastDate = '1995-11-01'; // 파일이 없으면 처음부터 가져오도록 복구 기능 추가
    }

    // 마지막 날짜의 다음 날부터 데이터를 요청
    const startDate = new Date(lastDate);
    startDate.setDate(startDate.getDate() + 1);

    // 시작일이 오늘보다 미래이면 업데이트할 필요 없음
    if (startDate > new Date()) {
        console.log('✅ Exchange rates are already up to date.');
        return;
    }

    try {
        const period1 = startDate.toISOString().split('T')[0];
        console.log(`Fetching new rates from ${period1} to today...`);

        const newHistoricalData = await yahooFinance.historical('USDKRW=X', {
            period1: period1,
            interval: '1d',
        });

        if (!newHistoricalData || newHistoricalData.length === 0) {
            console.log('No new exchange rate data found.');
            return;
        }

        const newRates = newHistoricalData.map((d) => ({
            date: d.date.toISOString().split('T')[0],
            rate: d.close,
        }));

        const combinedRates = [...existingRates, ...newRates];

        // 중복 제거 및 최종 정렬
        const rateMap = new Map(combinedRates.map((item) => [item.date, item]));
        const sortedRates = Array.from(rateMap.values()).sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

        await fs.writeFile(OUTPUT_FILE, JSON.stringify(sortedRates, null, 2));

        console.log(
            `\n🎉 Successfully added ${newRates.length} new records. Total records: ${sortedRates.length}`
        );
    } catch (error) {
        console.error('❌ Failed to fetch latest exchange rates:', error);
    }
}

updateLatestRates();
