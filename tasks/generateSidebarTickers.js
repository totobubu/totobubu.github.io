// tasks\generateSidebarTickers.js
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const POPULARITY_FILE_PATH = path.join(PUBLIC_DIR, 'popularity.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'sidebar-tickers.json'); // 호환성을 위해 유지
const OUTPUT_FILES = {
    krStocks: path.join(PUBLIC_DIR, 'sidebar-tickers-kr-stocks.json'),
    krEtfs: path.join(PUBLIC_DIR, 'sidebar-tickers-kr-etfs.json'),
    usStocks: path.join(PUBLIC_DIR, 'sidebar-tickers-us-stocks.json'),
    usEtfs: path.join(PUBLIC_DIR, 'sidebar-tickers-us-etfs.json'),
};
const POPULARITY_OUTPUT_FILES = {
    krStocks: path.join(PUBLIC_DIR, 'popularity-kr-stocks.json'),
    krEtfs: path.join(PUBLIC_DIR, 'popularity-kr-etfs.json'),
    usStocks: path.join(PUBLIC_DIR, 'popularity-us-stocks.json'),
    usEtfs: path.join(PUBLIC_DIR, 'popularity-us-etfs.json'),
};

const getTickerFromFilename = (filename) => {
    return path.basename(filename, '.json').toUpperCase().replace(/-/g, '.');
};

async function generateSidebarTickers() {
    console.log('--- Starting to generate sidebar-tickers.json ---');
    try {
        const yieldMap = new Map();
        const allDataFiles = await fs.readdir(DATA_DIR);
        for (const file of allDataFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(DATA_DIR, file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);
                    const tickerSymbol = getTickerFromFilename(file);
                    if (data.tickerInfo && data.tickerInfo.Yield) {
                        yieldMap.set(tickerSymbol, data.tickerInfo.Yield);
                    }
                } catch (e) {}
            }
        }

        // popularity.json 로드
        let popularityMap = new Map();
        try {
            const popularityContent = await fs.readFile(
                POPULARITY_FILE_PATH,
                'utf-8'
            );
            const popularityData = JSON.parse(popularityContent);
            popularityMap = new Map(Object.entries(popularityData));
            console.log(
                `📊 Loaded popularity data for ${popularityMap.size} tickers`
            );
        } catch (e) {
            console.log(
                '⚠️  popularity.json not found or invalid, using default values'
            );
        }

        const navContent = await fs.readFile(NAV_FILE_PATH, 'utf-8');
        const navData = JSON.parse(navContent);
        const dayOrder = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

        const sidebarTickers = navData.nav
            .filter((item) => !item.upcoming)
            .map((item) => {
                const tickerSymbol = item.symbol;
                const isEtf = !!(item.company || item.underlying);
                
                // null/undefined 값을 가진 필드는 제외하여 파일 크기 최적화
                const ticker = {
                    symbol: item.symbol,
                    currency: item.currency,
                    market: item.market,
                    isEtf,
                };

                // 값이 있는 필드만 추가
                if (item.koName) ticker.koName = item.koName;
                if (item.longName) ticker.longName = item.longName;
                if (item.company) ticker.company = item.company;
                if (item.logo) ticker.logo = item.logo;
                if (item.frequency) ticker.frequency = item.frequency;
                if (item.group) {
                    ticker.group = item.group;
                    ticker.groupOrder = dayOrder[item.group] ?? 999;
                } else {
                    ticker.groupOrder = 999;
                }
                if (item.underlying) ticker.underlying = item.underlying;
                if (item.marketCap) ticker.marketCap = item.marketCap;
                
                const yieldValue = yieldMap.get(tickerSymbol);
                if (yieldValue) ticker.yield = yieldValue;

                // popularity 데이터 추가
                const popularityValue = popularityMap.get(tickerSymbol);
                if (popularityValue !== undefined) {
                    ticker.popularity = popularityValue;
                }

                return ticker;
            });

        // 시장별로 분할
        const krStocks = sidebarTickers.filter(
            (t) => t.currency === 'KRW' && !t.isEtf
        );
        const krEtfs = sidebarTickers.filter(
            (t) => t.currency === 'KRW' && t.isEtf
        );
        const usStocks = sidebarTickers.filter(
            (t) => t.currency === 'USD' && !t.isEtf
        );
        const usEtfs = sidebarTickers.filter(
            (t) => t.currency === 'USD' && t.isEtf
        );

        // 시장별 인기도 데이터 생성
        const popularityByMarket = {
            krStocks: {},
            krEtfs: {},
            usStocks: {},
            usEtfs: {},
        };

        krStocks.forEach((t) => {
            if (t.popularity)
                popularityByMarket.krStocks[t.symbol] = t.popularity;
        });
        krEtfs.forEach((t) => {
            if (t.popularity)
                popularityByMarket.krEtfs[t.symbol] = t.popularity;
        });
        usStocks.forEach((t) => {
            if (t.popularity)
                popularityByMarket.usStocks[t.symbol] = t.popularity;
        });
        usEtfs.forEach((t) => {
            if (t.popularity)
                popularityByMarket.usEtfs[t.symbol] = t.popularity;
        });

        // 각 분할 파일 및 popularity 파일 저장
        await Promise.all([
            fs.writeFile(
                OUTPUT_FILES.krStocks,
                JSON.stringify(krStocks, null, 2)
            ),
            fs.writeFile(OUTPUT_FILES.krEtfs, JSON.stringify(krEtfs, null, 2)),
            fs.writeFile(
                OUTPUT_FILES.usStocks,
                JSON.stringify(usStocks, null, 2)
            ),
            fs.writeFile(OUTPUT_FILES.usEtfs, JSON.stringify(usEtfs, null, 2)),
            fs.writeFile(
                POPULARITY_OUTPUT_FILES.krStocks,
                JSON.stringify(popularityByMarket.krStocks, null, 2)
            ),
            fs.writeFile(
                POPULARITY_OUTPUT_FILES.krEtfs,
                JSON.stringify(popularityByMarket.krEtfs, null, 2)
            ),
            fs.writeFile(
                POPULARITY_OUTPUT_FILES.usStocks,
                JSON.stringify(popularityByMarket.usStocks, null, 2)
            ),
            fs.writeFile(
                POPULARITY_OUTPUT_FILES.usEtfs,
                JSON.stringify(popularityByMarket.usEtfs, null, 2)
            ),
        ]);

        console.log('🎉 Successfully generated split sidebar-tickers files:');
        console.log(
            `   - KR Stocks: ${krStocks.length} (${(JSON.stringify(krStocks).length / 1024).toFixed(2)} KB) [${Object.keys(popularityByMarket.krStocks).length} with popularity]`
        );
        console.log(
            `   - KR ETFs: ${krEtfs.length} (${(JSON.stringify(krEtfs).length / 1024).toFixed(2)} KB) [${Object.keys(popularityByMarket.krEtfs).length} with popularity]`
        );
        console.log(
            `   - US Stocks: ${usStocks.length} (${(JSON.stringify(usStocks).length / 1024).toFixed(2)} KB) [${Object.keys(popularityByMarket.usStocks).length} with popularity]`
        );
        console.log(
            `   - US ETFs: ${usEtfs.length} (${(JSON.stringify(usEtfs).length / 1024).toFixed(2)} KB) [${Object.keys(popularityByMarket.usEtfs).length} with popularity]`
        );

        // 호환성을 위해 전체 파일도 생성 (나중에 제거 가능)
        await fs.writeFile(
            OUTPUT_FILE,
            JSON.stringify(sidebarTickers, null, 2)
        );
        console.log(
            `   - Full file (legacy): ${sidebarTickers.length} tickers`
        );
    } catch (error) {
        console.error('❌ Error generating sidebar-tickers.json:', error);
        process.exit(1);
    }
}

generateSidebarTickers();
