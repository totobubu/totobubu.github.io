// NEW FILE: src/composables/useStockList.js

import { ref, onMounted } from 'vue';
import { joinURL } from 'ufo';
import { db } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';

function getYahooTicker(symbol, market) {
    if (market === 'KOSPI') return `${symbol}.KS`;
    if (market === 'KOSDAQ') return `${symbol}.KQ`;
    return symbol;
}

function getGroupCategory(item) {
    const isKorean = item.market === 'KOSPI' || item.market === 'KOSDAQ';
    const hasDividend = item.frequency && item.frequency !== '미정';

    if (isKorean) {
        return hasDividend ? '1-1. 한국 배당주' : '1-2. 한국 무배당주';
    } else {
        const isEtf = !!item.company;
        if (isEtf) {
            return hasDividend ? '2-1. 미국 배당 ETF' : '2-2. 미국 무배당 ETF';
        } else {
            return hasDividend
                ? '2-3. 미국 배당 개별주'
                : '2-4. 미국 무배당 개별주';
        }
    }
}

export function useStockList() {
    const stockList = ref([]);
    const isLoading = ref(true);
    const error = ref(null);

    const loadStockData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            // 1. Fetch all data sources in parallel
            const [popularitySnapshot, navResponse] = await Promise.all([
                getDocs(collection(db, 'stockPopularity')),
                fetch(joinURL(import.meta.env.BASE_URL, 'nav.json')),
            ]);

            const popularityMap = new Map();
            popularitySnapshot.forEach((doc) =>
                popularityMap.set(doc.id, doc.data().viewCount || 0)
            );

            if (!navResponse.ok)
                throw new Error('Navigation data could not be loaded.');
            const navData = await navResponse.json();

            const activeNavItems = navData.nav.filter((item) => !item.upcoming);
            const allSymbolsForApi = activeNavItems
                .map((item) => getYahooTicker(item.symbol, item.market))
                .filter(Boolean);

            const liveDataMap = new Map();
            if (allSymbolsForApi.length > 0) {
                const apiUrl = `/api/getStockData?tickers=${allSymbolsForApi.join(',')}`;
                const apiResponse = await fetch(apiUrl);
                if (apiResponse.ok) {
                    const liveDataArray = await apiResponse.json();
                    liveDataArray.forEach((item) =>
                        liveDataMap.set(item.symbol, item)
                    );
                } else {
                    console.warn(
                        'Failed to fetch live stock data, proceeding without it.'
                    );
                }
            }

            // 2. Process and combine data
            const dayOrder = {
                월: 1,
                화: 2,
                수: 3,
                목: 4,
                금: 5,
                A: 6,
                B: 7,
                C: 8,
                D: 9,
            };

            const processedList = activeNavItems.map((item) => {
                const yahooTicker = getYahooTicker(item.symbol, item.market);
                const liveData = liveDataMap.get(yahooTicker);

                const baseData = {
                    ...item,
                    groupOrder: dayOrder[item.group] ?? 999,
                    popularity:
                        popularityMap.get(item.symbol.toUpperCase()) || 0,
                    groupCategory: getGroupCategory(item),
                };

                if (!liveData) return { ...baseData, yield: '-', price: '-' };

                const {
                    regularMarketChangePercent: changePercent,
                    regularMarketPrice: price,
                } = liveData;
                return {
                    ...baseData,
                    yield:
                        typeof changePercent === 'number'
                            ? `${(changePercent * 100).toFixed(2)}%`
                            : '-',
                    price: typeof price === 'number' ? price : '-',
                };
            });

            // 3. Sort the final list
            processedList.sort((a, b) => {
                if (a.groupCategory < b.groupCategory) return -1;
                if (a.groupCategory > b.groupCategory) return 1;
                if (b.popularity !== a.popularity)
                    return b.popularity - a.popularity;
                return a.symbol.localeCompare(b.symbol);
            });

            stockList.value = processedList;
        } catch (err) {
            console.error('Error loading stock list:', err);
            error.value = 'ETF 목록을 불러오는 데 실패했습니다.';
        } finally {
            isLoading.value = false;
        }
    };

    onMounted(loadStockData);

    return { stockList, isLoading, error };
}
