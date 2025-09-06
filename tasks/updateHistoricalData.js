import fs from 'fs/promises';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const HISTORICAL_DATA_DIR = path.join(PUBLIC_DIR, 'historical');
const DIVIDEND_DATA_DIR = path.join(PUBLIC_DIR, 'dividends');

// 1년 전 날짜를 YYYY-MM-DD 형식으로 가져옵니다. 
// 실제로는 더 긴 기간(예: 10년)으로 설정하는 것이 좋습니다.
const START_DATE = new Date();
START_DATE.setFullYear(START_DATE.getFullYear() - 10);
const FROM = START_DATE.toISOString().split('T')[0];

async function fetchAndSaveData(symbol) {
    try {
        console.log(`Fetching data for ${symbol}...`);
        
        // 1. 일별 주가 데이터 가져오기
        const historicalPromise = yahooFinance.historical(symbol, {
            period1: FROM,
            // period2는 지정하지 않으면 가장 최근 데이터까지 가져옵니다.
        });

        // 2. 배당 데이터 가져오기
        const dividendPromise = yahooFinance.historical(symbol, {
            period1: FROM,
            events: 'div',
        });

        const [historicalData, dividendData] = await Promise.all([historicalPromise, dividendPromise]);

        // 3. 파일로 저장
        if (historicalData.length > 0) {
            const historicalFilePath = path.join(HISTORICAL_DATA_DIR, `${symbol.toLowerCase()}.json`);
            await fs.writeFile(historicalFilePath, JSON.stringify(historicalData, null, 2));
        }
        if (dividendData.length > 0) {
            const dividendFilePath = path.join(DIVIDEND_DATA_DIR, `${symbol.toLowerCase()}.json`);
            await fs.writeFile(dividendFilePath, JSON.stringify(dividendData, null, 2));
        }

        console.log(`✅ Successfully saved data for ${symbol}`);
        return { success: true, symbol };
    } catch (error) {
        console.error(`❌ Failed to fetch or save data for ${symbol}:`, error.message);
        return { success: false, symbol, error: error.message };
    }
}

async function main() {
    console.log('Starting historical data update...');

    // 출력 폴더 생성
    await fs.mkdir(HISTORICAL_DATA_DIR, { recursive: true });
    await fs.mkdir(DIVIDEND_DATA_DIR, { recursive: true });

    // nav.json에서 전체 티커 목록 읽기
    const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
    const allSymbols = navData.nav.map(item => item.symbol);
    const symbolsToFetch = [...new Set([...allSymbols, 'SPY'])]; // SPY 추가 및 중복 제거

    console.log(`Found ${symbolsToFetch.length} symbols to update.`);

    const results = await Promise.all(
        symbolsToFetch.map(symbol => fetchAndSaveData(symbol))
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`\nUpdate complete. Success: ${successCount}, Failure: ${failureCount}`);
    if (failureCount > 0) {
        console.log('Failed symbols:', results.filter(r => !r.success).map(r => r.symbol).join(', '));
    }
}

main();