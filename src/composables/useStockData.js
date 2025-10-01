// src\composables\useStockData.js
import { ref } from 'vue';
import { joinURL } from 'ufo';

const tickerInfo = ref(null);
const dividendHistory = ref([]);
const backtestData = ref(null); // [신규] backtestData ref 추가
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

export function useStockData() {
    const loadData = async (tickerSymbol) => {
        if (!tickerSymbol) {
            error.value = '티커 정보가 없습니다.';
            return;
        }
        isLoading.value = true;
        isUpcoming.value = false;
        error.value = null;
        tickerInfo.value = null;
        dividendHistory.value = [];
        backtestData.value = null; // [신규] 초기화

        try {
            const navData = await loadNavData();
            const currentTickerNavInfo = navData.nav.find(
                (item) => item.symbol === tickerSymbol.toUpperCase()
            );

            if (currentTickerNavInfo?.upcoming) {
                isUpcoming.value = true;
                tickerInfo.value = currentTickerNavInfo;
                try {
                    const liveDataResponse = await fetch(
                        `/api/getStockData?tickers=${tickerSymbol.toUpperCase()}`
                    );
                    if (liveDataResponse.ok) {
                        const liveData = (await liveDataResponse.json())[0];
                        if (liveData) {
                            tickerInfo.value = {
                                ...tickerInfo.value,
                                ...liveData,
                            };
                        }
                    }
                } catch (e) {
                    console.warn(
                        `Upcoming ticker ${tickerSymbol} live data fetch failed, but proceeding.`
                    );
                }
                return;
            }

            const [liveDataResponse, staticDataResponse] = await Promise.all([
                fetch(
                    `/api/getStockData?tickers=${tickerSymbol.toUpperCase()}`
                ),
                fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${tickerSymbol.toLowerCase()}.json`
                    )
                ),
            ]);

            if (!liveDataResponse.ok)
                throw new Error('실시간 시세 정보를 가져오지 못했습니다.');
            const liveData = (await liveDataResponse.json())[0];
            if (!liveData)
                throw new Error(
                    `'${tickerSymbol.toUpperCase()}'에 대한 시세 정보가 없습니다.`
                );

            if (staticDataResponse.ok) {
                const staticData = await staticDataResponse.json();
                tickerInfo.value = {
                    ...(staticData.tickerInfo || {}),
                    ...currentTickerNavInfo,
                    ...liveData,
                };
                dividendHistory.value = staticData.dividendHistory || [];
                backtestData.value = staticData.backtestData || {}; // [신규] backtestData 할당
            } else {
                tickerInfo.value = { ...currentTickerNavInfo, ...liveData };
                isUpcoming.value = true;
            }
        } catch (err) {
            console.error(`Failed to load data for ${tickerSymbol}:`, err);
            error.value =
                err.message ||
                `${tickerSymbol.toUpperCase()}의 데이터를 불러오는 데 실패했습니다.`;
        } finally {
            isLoading.value = false;
        }
    };

    return {
        tickerInfo,
        dividendHistory,
        backtestData, // [신규] 반환 객체에 추가
        isLoading,
        error,
        loadData,
        isUpcoming,
    };
}
