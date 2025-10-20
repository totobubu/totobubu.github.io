// src/composables/useStockData.js
import { ref } from 'vue';
import { joinURL } from 'ufo';

const tickerInfo = ref(null);
const dividendHistory = ref([]);
const backtestData = ref([]);
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

const marketNameMap = {
    NMS: 'NASDAQ',
    NYQ: 'NYSE',
    KOE: 'KOSDAQ',
    KSC: 'KOSPI',
    NCM: 'NASDAQ',
    NGM: 'NASDAQ',
    ASE: 'NYSE',
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
        backtestData.value = [];

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
            const staticDataResponse = await fetch(
                joinURL(
                    import.meta.env.BASE_URL,
                    `data/${sanitizedTicker}.json`
                )
            );
            if (staticDataResponse.ok) {
                const staticData = await staticDataResponse.json();
                const fullBacktestData = staticData.backtestData || [];

                // [핵심 수정] 주가 데이터에 인덱스를 추가하여 이전/다음날 가격을 쉽게 찾도록 함
                const pricesWithIndex = fullBacktestData.map((p, i) => ({
                    ...p,
                    index: i,
                }));

                dividendHistory.value = pricesWithIndex
                    .filter(
                        (item) =>
                            item.amount !== undefined ||
                            item.amountFixed !== undefined
                    )
                    .map((item) => {
                        // 이전/다음날 종가 찾기
                        const prevDayData = pricesWithIndex[item.index - 1];
                        const nextDayData = pricesWithIndex[item.index + 1];
                        return {
                            배당락: new Date(item.date)
                                .toLocaleDateString('ko-KR', {
                                    year: '2-digit',
                                    month: '2-digit',
                                    day: '2-digit',
                                })
                                .replace(/\. /g, '.')
                                .slice(0, -1),
                            배당금:
                                item.amountFixed !== undefined
                                    ? item.amountFixed
                                    : item.amount,
                            배당률: item.yield,
                            전일종가: prevDayData ? prevDayData.close : null,
                            당일시가: item.open,
                            당일종가: item.close,
                            익일종가: nextDayData ? nextDayData.close : null,
                        };
                    });

                backtestData.value = fullBacktestData.map(
                    ({ date, open, high, low, close, volume }) => ({
                        date,
                        open,
                        high,
                        low,
                        close,
                        volume,
                    })
                );
                tickerInfo.value = {
                    ...(staticData.tickerInfo || {}),
                    ...navInfo,
                };
            }

            // 실시간 시세 정보는 항상 가져와서 덮어쓰기
            const liveDataResponse = await fetch(
                `/api/getStockData?tickers=${originalTickerSymbol.toUpperCase()}`
            );
            if (liveDataResponse.ok) {
                const liveData = (await liveDataResponse.json())[0];
                if (liveData) {
                    tickerInfo.value = { ...tickerInfo.value, ...liveData };
                    if (liveData.exchange) {
                        tickerInfo.value.market =
                            marketNameMap[liveData.exchange] ||
                            liveData.exchange;
                    }
                }
            } else {
                console.warn(
                    `실시간 시세 정보를 가져오지 못했습니다 for ${originalTickerSymbol}`
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
