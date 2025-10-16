// src/composables/useStockData.js
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
    ticker.replace(/\./g, '-').toLowerCase();

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

            if (navInfo.upcoming) {
                isUpcoming.value = true;
                tickerInfo.value = navInfo;
                try {
                    const liveDataResponse = await fetch(
                        `/api/getStockData?tickers=${originalTickerSymbol.toUpperCase()}`
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
                return;
            }

            const [liveDataResponse, staticDataResponse] = await Promise.all([
                fetch(
                    `/api/getStockData?tickers=${originalTickerSymbol.toUpperCase()}`
                ),
                fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${sanitizedTicker}.json`
                    )
                ),
            ]);

            if (!liveDataResponse.ok)
                throw new Error('실시간 시세 정보를 가져오지 못했습니다.');
            const liveData = (await liveDataResponse.json())[0];
            if (!liveData)
                throw new Error(
                    `'${originalTickerSymbol.toUpperCase()}'에 대한 시세 정보가 없습니다.`
                );

            if (staticDataResponse.ok) {
                const staticData = await staticDataResponse.json();
                tickerInfo.value = {
                    ...(staticData.tickerInfo || {}),
                    ...navInfo,
                    ...liveData,
                };
                dividendHistory.value = staticData.dividendHistory || [];
                backtestData.value = staticData.backtestData || {};
            } else {
                tickerInfo.value = { ...navInfo, ...liveData };
                isUpcoming.value = true;
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
