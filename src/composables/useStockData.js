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

            if (!staticDataResponse.ok) {
                // 데이터 파일이 없는 upcoming 종목 처리
                isUpcoming.value = true;
                tickerInfo.value = { ...navInfo };
            } else {
                const staticData = await staticDataResponse.json();

                // [핵심 수정] 통합된 backtestData에서 dividendHistory와 주가 데이터를 분리
                const fullBacktestData = staticData.backtestData || [];

                // 1. 배당 정보만 필터링하여 dividendHistory 생성
                dividendHistory.value = fullBacktestData
                    .filter(
                        (item) =>
                            item.amount !== undefined ||
                            item.amountFixed !== undefined
                    )
                    .map((item) => ({
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
                        // scraper_dividend.py가 이 필드를 순수 숫자로 추가한다고 가정
                        전일종가: item.prevClose,
                        당일시가: item.open,
                        당일종가: item.close,
                        익일종가: item.nextClose,
                    }));

                // 2. 순수 주가 정보만 backtestData에 할당
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
        dividendHistory, // [핵심 수정] dividendHistory를 return 객체에 추가
        backtestData,
        isLoading,
        error,
        loadData,
        isUpcoming,
    };
}
