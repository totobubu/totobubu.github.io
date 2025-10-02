// src\composables\useStockData.js
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

export function useStockData() {
    // [핵심 수정] 이제 이 함수는 정규화된 티커를 인자로 받습니다 (예: "brk-b")
    const loadData = async (sanitizedTicker) => {
        if (!sanitizedTicker) {
            error.value = '티커 정보가 없습니다.';
            return;
        }
        isLoading.value = true;
        isUpcoming.value = false;
        error.value = null;
        tickerInfo.value = null;
        dividendHistory.value = [];
        backtestData.value = null;

        try {
            const navData = await loadNavData();

            // [핵심 수정] 정규화된 티커를 이용해 nav.json에서 원본 티커 정보를 찾습니다.
            const navInfo = navData.nav.find(
                (item) =>
                    item.symbol.replace(/\./g, '-').toLowerCase() ===
                    sanitizedTicker.toLowerCase()
            );

            if (!navInfo) {
                throw new Error(
                    `'${sanitizedTicker.toUpperCase()}'에 대한 종목 정보를 찾을 수 없습니다.`
                );
            }

            const originalTickerSymbol = navInfo.symbol; // API 호출에 사용할 원본 티커 (예: "BRK.B")

            if (navInfo?.upcoming) {
                isUpcoming.value = true;
                tickerInfo.value = navInfo;
                try {
                    const liveDataResponse = await fetch(
                        `/api/getStockData?tickers=${originalTickerSymbol.toUpperCase()}`
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
                        `Upcoming ticker ${originalTickerSymbol} live data fetch failed, but proceeding.`
                    );
                }
                return;
            }

            const [liveDataResponse, staticDataResponse] = await Promise.all([
                fetch(
                    `/api/getStockData?tickers=${originalTickerSymbol.toUpperCase()}`
                ),
                // [핵심 수정] 정적 파일 조회 시에도 정규화된 티커를 사용합니다.
                fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${sanitizedTicker.toLowerCase()}.json`
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
