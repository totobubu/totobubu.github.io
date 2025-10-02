import { ref } from 'vue';
import { joinURL } from 'ufo';
import { addBusinessDays } from '@/services/backtester/utils.js';

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

        // --- [핵심 수정] ---
        // 1. 모든 티커에 대해 로컬 데이터 조회를 먼저 시도합니다.
        const tickerDataPromises = symbolsToFetch.map(async (symbol) => {
            try {
                const response = await fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${symbol.toLowerCase().replace(/\./g, '-')}.json`
                    )
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.backtestData) {
                        return { symbol, ...data.backtestData };
                    }
                }
                // 로컬 파일이 없거나 데이터가 부적절하면 API 조회를 위해 null 반환
                return null;
            } catch (error) {
                return null;
            }
        });

        const initialResults = await Promise.all(tickerDataPromises);

        // 2. 로컬에서 찾지 못한 티커 목록을 만듭니다.
        const foundSymbols = new Set(
            initialResults.filter(Boolean).map((r) => r.symbol)
        );
        const symbolsToFetchFromApi = symbolsToFetch.filter(
            (s) => !foundSymbols.has(s)
        );

        let apiResults = [];
        if (symbolsToFetchFromApi.length > 0) {
            console.log(
                'Fetching from API for:',
                symbolsToFetchFromApi.join(',')
            );
            const from = startDate.toISOString().split('T')[0];
            const to = endDate.toISOString().split('T')[0];
            try {
                const apiUrl = `/api/getBacktestData?symbols=${symbolsToFetchFromApi.join(',')}&from=${from}&to=${to}`;
                const apiResponse = await fetch(apiUrl);
                if (!apiResponse.ok)
                    throw new Error(
                        '실시간 백테스팅 데이터 API 호출에 실패했습니다.'
                    );
                const apiData = await apiResponse.json();
                apiResults = apiData.tickerData || [];

                // API 호출 결과에 에러가 있는지 개별적으로 확인
                const apiErrors = apiResults.filter((r) => r.error);
                if (apiErrors.length > 0) {
                    throw new Error(apiErrors.map((e) => e.error).join(', '));
                }
            } catch (e) {
                throw new Error(
                    `[${symbolsToFetchFromApi.join(',')}] 실시간 데이터 조회 중 오류가 발생했습니다: ${e.message}`
                );
            }
        }

        // 3. 로컬 데이터와 API 데이터를 합칩니다.
        const tickerData = initialResults.filter(Boolean).concat(apiResults);
        // --- // ---

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
            // 이 시점에서 에러가 발생한 티커가 있다면 그 에러 메시지를 우선적으로 보여줌
            const errorTicker = tickerData.find(
                (t) => failedSymbols.includes(t.symbol) && t.error
            );
            if (errorTicker) {
                throw new Error(errorTicker.error);
            }

            throw new Error(
                `[${failedSymbols.join(', ')}] 종목의 가격 데이터가 없습니다. 다른 종목을 선택해주세요.`
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

        return {
            effectiveStartDate: adjustedStartDateStr,
            apiData,
            holidays,
        };
    };

    return { fetchDataForBacktest, adjustedDateMessage };
}
