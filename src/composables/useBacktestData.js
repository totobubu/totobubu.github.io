// src/composables/useBacktestData.js
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
                    // --- [핵심 수정] ---
                    // 로컬 데이터를 백테스팅 엔진 형식으로 변환합니다.
                    if (data.backtestData) {
                        const prices = [];
                        const dividends = [];

                        data.backtestData.forEach((item) => {
                            // 가격 정보 추가
                            if (
                                item.close !== null &&
                                typeof item.close !== 'undefined'
                            ) {
                                prices.push({
                                    date: item.date,
                                    open: item.open,
                                    close: item.close,
                                });
                            }
                            // 배당 정보 추가
                            const amount =
                                item.amountFixed !== undefined
                                    ? item.amountFixed
                                    : item.amount;
                            if (amount !== undefined && amount !== null) {
                                dividends.push({
                                    date: item.date,
                                    amount: amount,
                                });
                            }
                        });

                        return {
                            symbol,
                            prices,
                            dividends,
                            splits: [], // 로컬 데이터는 액면분할 정보를 포함하지 않음
                            firstTradeDate: data.tickerInfo?.ipoDate || null,
                        };
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
            console.log(
                'Fetching from API for:',
                symbolsToFetchFromApi.join(',')
            );
            const from = startDate.toISOString().split('T')[0];
            const to = endDate.toISOString().split('T')[0];
            try {
                const apiUrl = `/api/getBacktestData?symbols=${symbolsToFetchFromApi.join(',')}&from=${from}&to=${to}`;
                const apiResponse = await fetch(apiUrl);
                if (!apiResponse.ok) {
                    throw new Error(
                        '실시간 백테스팅 데이터 API 호출에 실패했습니다.'
                    );
                }
                // [오류 수정] API 응답이 HTML일 경우를 대비하여 예외 처리 추가
                const textResponse = await apiResponse.text();
                try {
                    const apiData = JSON.parse(textResponse);
                    apiResults = apiData.tickerData || [];
                    const apiErrors = apiResults.filter((r) => r.error);
                    if (apiErrors.length > 0) {
                        throw new Error(
                            apiErrors.map((e) => e.error).join(', ')
                        );
                    }
                } catch (jsonError) {
                    throw new Error(
                        `API 응답이 올바른 JSON 형식이 아닙니다. 서버 오류일 수 있습니다.`
                    );
                }
            } catch (e) {
                throw new Error(
                    `[${symbolsToFetchFromApi.join(',')}] 실시간 데이터 조회 중 오류가 발생했습니다: ${e.message}`
                );
            }
        }

        const tickerData = initialResults.filter(Boolean).concat(apiResults);

        // holidays.json은 us_holidays.json과 kr_holidays.json을 합친 파일이므로 더 이상 존재하지 않습니다.
        // 시뮬레이터에서 개별 휴일 데이터를 사용하므로 이 부분은 수정/제거가 필요합니다.
        // 우선은 빈 배열로 처리하여 오류를 막습니다.
        const holidays = [];

        const [exchangeResponse] = await Promise.all([
            fetch(joinURL(import.meta.env.BASE_URL, 'exchange-rates.json')),
        ]);

        if (!exchangeResponse.ok)
            throw new Error('환율 데이터를 불러올 수 없습니다.');

        const exchangeRates = await exchangeResponse.json();
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

        // addBusinessDays는 휴일 데이터가 필요하므로, 로직을 잠시 비활성화하거나 수정해야 합니다.
        // 우선은 그대로 두고, 이후 휴일 데이터 로딩 방식을 변경해야 합니다.
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
            // holidays를 반환하여 engine에서 사용할 수 있도록 함
            holidays,
        };
    };

    return { fetchDataForBacktest, adjustedDateMessage };
}
