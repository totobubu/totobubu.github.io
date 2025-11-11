// tasks\generateSidebarTickers.js
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const POPULARITY_FILE_PATH = path.join(PUBLIC_DIR, 'popularity.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'sidebar-tickers.json'); // 호환성을 위해 유지
const OUTPUT_FILES = {
    krStocks: path.join(
        PUBLIC_DIR,
        'sidebar',
        'sidebar-tickers-kr-stocks.json'
    ),
    krEtfs: path.join(PUBLIC_DIR, 'sidebar', 'sidebar-tickers-kr-etfs.json'),
    usStocks: path.join(
        PUBLIC_DIR,
        'sidebar',
        'sidebar-tickers-us-stocks.json'
    ),
    usEtfs: path.join(PUBLIC_DIR, 'sidebar', 'sidebar-tickers-us-etfs.json'),
};
const POPULARITY_OUTPUT_FILES = {
    krStocks: path.join(PUBLIC_DIR, 'popularity', 'popularity-kr-stocks.json'),
    krEtfs: path.join(PUBLIC_DIR, 'popularity', 'popularity-kr-etfs.json'),
    usStocks: path.join(PUBLIC_DIR, 'popularity', 'popularity-us-stocks.json'),
    usEtfs: path.join(PUBLIC_DIR, 'popularity', 'popularity-us-etfs.json'),
};

const getTickerFromFilename = (filename) => {
    return path.basename(filename, '.json').toUpperCase().replace(/-/g, '.');
};

async function generateSidebarTickers() {
    console.log('--- Starting to generate sidebar-tickers.json ---');
    try {
        const yieldMap = new Map();
        const marketCapMap = new Map();
        const allDataFiles = await fs.readdir(DATA_DIR);
        const groupLabelsMap = new Map();

        const splitWeekdayTokens = (value) =>
            value
                .toString()
                .split(/[\/,\s·]+/)
                .map((part) => part.trim())
                .filter(Boolean);

        const parseGroupLabels = (groupValue) => {
            if (!groupValue) return [];
            if (Array.isArray(groupValue)) {
                return [
                    ...new Set(
                        groupValue.flatMap((value) =>
                            typeof value === 'string'
                                ? splitWeekdayTokens(value)
                                : []
                        )
                    ),
                ];
            }
            if (typeof groupValue === 'object') {
                return [
                    ...new Set(
                        Object.values(groupValue).flatMap((value) =>
                            typeof value === 'string'
                                ? splitWeekdayTokens(value)
                                : []
                        )
                    ),
                ];
            }
            if (typeof groupValue === 'string') {
                return splitWeekdayTokens(groupValue);
            }
            return [];
        };

        console.log(
            '📊 Loading marketCap, yield and group data from data files...'
        );
        for (const file of allDataFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(DATA_DIR, file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);
                    const tickerSymbol = getTickerFromFilename(file);

                    // Yield 정보 수집
                    if (data.tickerInfo && data.tickerInfo.Yield) {
                        yieldMap.set(tickerSymbol, data.tickerInfo.Yield);
                    }

                    // MarketCap 정보 수집 (backtestData의 마지막 항목에서)
                    if (data.backtestData && data.backtestData.length > 0) {
                        // 최신 데이터부터 역순으로 찾기
                        for (
                            let i = data.backtestData.length - 1;
                            i >= 0;
                            i--
                        ) {
                            if (data.backtestData[i].marketCap) {
                                marketCapMap.set(
                                    tickerSymbol,
                                    data.backtestData[i].marketCap
                                );
                                break;
                            }
                        }
                    }

                    // Group 라벨 정보 수집
                    if (data.tickerInfo && data.tickerInfo.group) {
                        const labels = parseGroupLabels(data.tickerInfo.group);
                        if (labels.length > 0) {
                            groupLabelsMap.set(tickerSymbol, labels);
                        }
                    }
                } catch (e) {}
            }
        }
        console.log(`  ✓ Loaded marketCap for ${marketCapMap.size} tickers`);
        console.log(`  ✓ Loaded yield for ${yieldMap.size} tickers`);
        console.log(
            `  ✓ Loaded weekday groups for ${groupLabelsMap.size} tickers`
        );

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

        // 한국 ETF 브랜드명 목록
        const koreanEtfBrands = [
            'KODEX',
            'TIGER',
            'KBSTAR',
            'ACE',
            'ARIRANG',
            'HANARO',
            'SOL',
            'PLUS',
            'RISE',
            'TIMEFOLIO',
            'KOSEF',
            'KINDEX',
            'TRUE',
            'FOCUS',
            'SMART',
            'QV',
            'TREX',
            'HK ',
        ];

        const sidebarTickers = navData.nav
            .filter((item) => !item.upcoming)
            .map((item) => {
                const tickerSymbol = item.symbol;

                // ETF 판단: company/underlying 필드가 있거나, 한국 ETF 브랜드명으로 시작하는 경우
                let isEtf = !!(item.company || item.underlying);
                if (!isEtf && item.koName) {
                    isEtf = koreanEtfBrands.some((brand) =>
                        item.koName.startsWith(brand)
                    );
                }

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

                const groupLabels = groupLabelsMap.get(tickerSymbol);
                if (groupLabels && groupLabels.length > 0) {
                    ticker.groupLabels = groupLabels;
                    if (!ticker.group) {
                        ticker.group = groupLabels[0];
                    }
                }

                // data 파일에서 가져온 marketCap 사용
                const marketCapValue = marketCapMap.get(tickerSymbol);
                if (marketCapValue) ticker.marketCap = marketCapValue;

                const yieldValue = yieldMap.get(tickerSymbol);
                if (yieldValue) ticker.yield = yieldValue;

                // popularity 데이터 추가
                const popularityValue = popularityMap.get(tickerSymbol);
                if (popularityValue !== undefined) {
                    ticker.popularity = popularityValue;
                }

                return ticker;
            });

        // 상위 50개 선택 함수 (popularity 상위 20개 + marketCap 상위 30개)
        const selectTop50 = (tickers) => {
            const MAX_TICKERS = 50;
            const POPULARITY_LIMIT = 20;

            // popularity가 있는 티커들을 popularity 순으로 정렬
            const popularTickers = tickers
                .filter((t) => t.popularity && t.popularity > 0)
                .sort((a, b) => b.popularity - a.popularity);

            // 상위 20개 선택 (없으면 있는 만큼만)
            const topPopular = popularTickers.slice(0, POPULARITY_LIMIT);
            const selectedSymbols = new Set(topPopular.map((t) => t.symbol));

            // 나머지 티커들 (popularity에 포함되지 않은 것들)
            const remainingTickers = tickers
                .filter((t) => !selectedSymbols.has(t.symbol))
                .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

            // 50개가 될 때까지 추가
            const needed = MAX_TICKERS - topPopular.length;
            const topByMarketCap = remainingTickers.slice(0, needed);

            return [...topPopular, ...topByMarketCap];
        };

        // 시장별로 분할 후 상위 50개 선택
        const krStocks = selectTop50(
            sidebarTickers.filter((t) => t.currency === 'KRW' && !t.isEtf)
        );
        const krEtfs = selectTop50(
            sidebarTickers.filter((t) => t.currency === 'KRW' && t.isEtf)
        );
        const usStocks = selectTop50(
            sidebarTickers.filter((t) => t.currency === 'USD' && !t.isEtf)
        );
        const usEtfs = selectTop50(
            sidebarTickers.filter((t) => t.currency === 'USD' && t.isEtf)
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
