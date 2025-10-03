// REFACTORED: src/composables/useStockData.js

import { ref } from 'vue';
import { joinURL } from 'ufo';

const tickerInfo = ref(null);
const dividendHistory = ref([]);
const backtestData = ref(null);
const isLoading = ref(false);
const error = ref(null);
const isUpcoming = ref(false);

let navDataCache = null;

const loadNavData = async () => {
    if (navDataCache) return navDataCache;
    try {
        const navUrl = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const navResponse = await fetch(navUrl);
        if (!navResponse.ok) throw new Error('nav.json not found');
        navDataCache = await navResponse.json();
        return navDataCache;
    } catch (e) {
        console.error('Failed to load nav.json', e);
        return { nav: [] };
    }
};

const sanitizeTickerForFilename = (ticker) =>
    ticker ? ticker.replace(/\./g, '-').toLowerCase() : '';
const getYahooTicker = (symbol, market) => {
    if (market === 'KOSPI') return `${symbol}.KS`;
    if (market === 'KOSDAQ') return `${symbol}.KQ`;
    return symbol;
};

export function useStockData() {
    const loadData = async (sanitizedTicker) => {
        if (!sanitizedTicker) {
            error.value = '티커 정보가 없습니다.';
            return;
        }

        isLoading.value = true;
        error.value = null;
        isUpcoming.value = false;
        tickerInfo.value = null;
        dividendHistory.value = [];
        backtestData.value = null;

        try {
            const navData = await loadNavData();
            const navInfo = navData.nav.find(
                (item) =>
                    sanitizeTickerForFilename(item.symbol) === sanitizedTicker
            );

            if (!navInfo) {
                throw new Error(
                    `'${sanitizedTicker.toUpperCase()}'에 대한 종목 정보를 찾을 수 없습니다.`
                );
            }

            const originalTickerSymbol = navInfo.symbol;
            const yahooTicker = getYahooTicker(
                originalTickerSymbol,
                navInfo.market
            );

            if (navInfo.upcoming) {
                isUpcoming.value = true;
                tickerInfo.value = navInfo;
                try {
                    const liveDataResponse = await fetch(
                        `/api/getStockData?tickers=${yahooTicker}`
                    );
                    if (liveDataResponse.ok) {
                        const liveData = (await liveDataResponse.json())[0];
                        if (liveData)
                            tickerInfo.value = {
                                ...tickerInfo.value,
                                ...liveData,
                            };
                    }
                } catch (e) {
                    console.warn(
                        `Upcoming ticker ${originalTickerSymbol} live data fetch failed, but proceeding.`
                    );
                }
                isLoading.value = false; // 로딩 완료 처리
                return;
            }

            const [liveDataResponse, staticDataResponse] = await Promise.all([
                fetch(`/api/getStockData?tickers=${yahooTicker}`),
                fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${sanitizedTicker}.json`
                    )
                ),
            ]);

            let liveData = {};
            if (liveDataResponse.ok) {
                const results = await liveDataResponse.json();
                liveData = results[0] || {};
            } else {
                console.warn('실시간 시세 정보 fetching 실패');
            }

            if (staticDataResponse.ok) {
                const staticData = await staticDataResponse.json();

                // --- [핵심 수정] ---
                // 병합 순서 변경: 기본 정보(nav) -> 실시간(live) -> 최종본(static)
                // 이렇게 하면 staticData.tickerInfo의 값이 항상 우선순위를 갖게 됩니다.
                tickerInfo.value = {
                    ...navInfo,
                    ...liveData,
                    ...(staticData.tickerInfo || {}),
                };
                // --- // ---

                dividendHistory.value = staticData.dividendHistory || [];
                backtestData.value = staticData.backtestData || {};
            } else {
                // static 파일이 없는 경우 (예: 신규 종목)
                tickerInfo.value = { ...navInfo, ...liveData };
                // 이 경우 에러 대신 '출시 예정'과 유사한 UI를 보여주는 것이 좋을 수 있습니다.
                // error.value = "정적 데이터 파일을 찾을 수 없습니다.";
            }

            if (!tickerInfo.value.marketCap && !tickerInfo.value.totalAssets) {
                throw new Error(
                    `'${originalTickerSymbol.toUpperCase()}'에 대한 시세 정보가 없습니다.`
                );
            }
        } catch (err) {
            console.error(`Failed to load data for ${sanitizedTicker}:`, err);
            error.value =
                err.message ||
                `${sanitizedTicker.toUpperCase()}의 데이터를 불러오는 데 실패했습니다.`;
        } finally {
            isLoading.value = false;
        }
    };

    return {
        tickerInfo,
        dividendHistory,
        backtestData,
        isLoading,
        error,
        loadData,
        isUpcoming,
    };
}
