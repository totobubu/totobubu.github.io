// REFACTORED: src/composables/useBacktestData.js

import { ref } from 'vue';
import { joinURL } from 'ufo';
import { addBusinessDays } from '@/services/backtester/utils.js';

// --- [신규] nav.json 데이터를 캐시하고 조회하는 로직 ---
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
// --- // ---

export function useBacktestData() {
    const adjustedDateMessage = ref('');

    const fetchDataForBacktest = async (
        portfolio,
        comparisonSymbol,
        startDate,
        endDate
    ) => {
        const portfolioSymbols = portfolio
            .map((p) => p.symbol.toUpperCase())
            .filter(Boolean);
        if (portfolioSymbols.length === 0) {
            throw new Error('백테스팅할 종목을 입력해주세요.');
        }

        const symbolsToFetch = [
            ...new Set(
                [...portfolioSymbols, comparisonSymbol.toUpperCase()].filter(
                    (s) => s && s !== 'NONE'
                )
            ),
        ];

        const tickerDataPromises = symbolsToFetch.map(async (symbol) => {
            try {
                const sanitizedSymbol = symbol
                    .toLowerCase()
                    .replace(/\./g, '-');
                const response = await fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${sanitizedSymbol}.json`
                    )
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.backtestData) {
                        return { symbol, ...data.backtestData };
                    }
                }
                return null;
            } catch (error) {
                return null;
            }
        });

        const initialResults = await Promise.all(tickerDataPromises);

        const foundSymbols = new Set(
            initialResults.filter(Boolean).map((r) => r.symbol)
        );
        const symbolsToFetchFromApi = symbolsToFetch.filter(
            (s) => !foundSymbols.has(s)
        );

        let apiResults = [];
        if (symbolsToFetchFromApi.length > 0) {
            // --- [핵심 수정] ---
            const navData = await loadNavData();
            const navMap = new Map(
                navData.nav.map((item) => [item.symbol, item])
            );

            const apiTickers = symbolsToFetchFromApi
                .map((symbol) => {
                    const navInfo = navMap.get(symbol);
                    const market = navInfo?.market;
                    if (market === 'KOSPI') return `${symbol}.KS`;
                    if (market === 'KOSDAQ') return `${symbol}.KQ`;
                    return symbol;
                })
                .join(',');
            // --- // ---

            console.log('Fetching from API for:', apiTickers);
            const from = startDate.toISOString().split('T')[0];
            const to = endDate.toISOString().split('T')[0];
            try {
                // 수정된 apiTickers로 API 호출
                const apiUrl = `/api/getBacktestData?symbols=${apiTickers}&from=${from}&to=${to}`;
                const apiResponse = await fetch(apiUrl);
                if (!apiResponse.ok) {
                    const errorData = await apiResponse.json();
                    throw new Error(
                        errorData.error ||
                            `실시간 백테스팅 데이터 API 호출에 실패했습니다. (Status: ${apiResponse.status})`
                    );
                }
                const apiData = await apiResponse.json();
                apiResults = apiData.tickerData || [];

                const apiErrors = apiResults.filter((r) => r.error);
                if (apiErrors.length > 0) {
                    // 에러 메시지에 원본 심볼을 표시하도록 개선
                    const errorMessage = apiErrors
                        .map(
                            (e) =>
                                `[${e.symbol.replace(/\.(KS|KQ)$/, '')}] ${e.error}`
                        )
                        .join(', ');
                    throw new Error(errorMessage);
                }
            } catch (e) {
                throw new Error(
                    `실시간 데이터 조회 중 오류가 발생했습니다: ${e.message}`
                );
            }
        }

        const tickerData = initialResults.filter(Boolean).concat(apiResults);

        const [exchangeResponse, holidayResponse] = await Promise.all([
            fetch(joinURL(import.meta.env.BASE_URL, 'exchange-rates.json')),
            fetch(joinURL(import.meta.env.BASE_URL, 'holidays.json')),
        ]);

        if (!exchangeResponse.ok)
            throw new Error('환율 데이터를 불러올 수 없습니다.');
        if (!holidayResponse.ok)
            throw new Error('휴장일 데이터를 불러올 수 없습니다.');

        const exchangeRates = await exchangeResponse.json();
        const holidays = (await holidayResponse.json()).map((h) => h.date);
        const apiData = { tickerData, exchangeRates };

        const dataStartDates = tickerData
            .filter(
                (d) =>
                    portfolioSymbols.includes(d.symbol) && d.prices?.length > 0
            )
            .map((d) => new Date(d.prices[0].date));

        if (dataStartDates.length < portfolioSymbols.length) {
            const failedSymbols = portfolioSymbols.filter(
                (s) =>
                    !tickerData.find(
                        (d) => d.symbol === s && d.prices?.length > 0
                    )
            );
            const errorTicker = tickerData.find(
                (t) => failedSymbols.includes(t.symbol) && t.error
            );
            if (errorTicker) throw new Error(errorTicker.error);
            throw new Error(
                `[${failedSymbols.join(', ')}] 종목의 가격 데이터가 없습니다.`
            );
        }

        const latestIpoDate = new Date(Math.max.apply(null, dataStartDates));
        let effectiveStartDate = new Date(startDate);
        let originalStartDateStr = effectiveStartDate
            .toISOString()
            .split('T')[0];

        if (effectiveStartDate < latestIpoDate) {
            effectiveStartDate = latestIpoDate;
        }

        const businessStartDate = addBusinessDays(
            effectiveStartDate,
            0,
            holidays
        );
        let adjustedStartDateStr = businessStartDate
            .toISOString()
            .split('T')[0];

        if (originalStartDateStr !== adjustedStartDateStr) {
            adjustedDateMessage.value = `시작일이 ${adjustedStartDateStr}로 자동 조정되었습니다. (영업일 기준)`;
        } else {
            adjustedDateMessage.value = '';
        }

        return { effectiveStartDate: adjustedStartDateStr, apiData, holidays };
    };

    return { fetchDataForBacktest, adjustedDateMessage };
}
