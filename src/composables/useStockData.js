// src\composables\useStockData.js
import { ref } from 'vue';
import { joinURL } from 'ufo';

const tickerInfo = ref(null);
const dividendHistory = ref([]);
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

        try {
            const navData = await loadNavData();
            const currentTickerNavInfo = navData.nav.find(
                (item) => item.symbol === tickerSymbol.toUpperCase()
            );

            // --- 핵심 수정: API 호출 전에 upcoming 플래그를 먼저 확인합니다 ---
            if (currentTickerNavInfo?.upcoming) {
                isUpcoming.value = true;
                // 시세 정보가 없을 수 있으므로, nav.json의 기본 정보만이라도 tickerInfo에 할당합니다.
                tickerInfo.value = currentTickerNavInfo;

                // (선택적 개선) 시도를 해보고, 실패해도 무시합니다.
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

                return; // "출시 예정"이므로 여기서 함수를 정상 종료합니다.
            }
            // -----------------------------------------------------------

            // upcoming이 아닌 종목에 대해서만 기존 로직을 수행합니다.
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
            } else {
                // 이 경우는 upcoming 플래그는 없는데 .json 파일이 없는 경우입니다.
                // 에러로 처리하거나, 이것도 '출시 예정'으로 볼 수 있습니다.
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
        isLoading,
        error,
        loadData,
        isUpcoming,
    };
}
