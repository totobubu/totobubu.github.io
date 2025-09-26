// src\composables\useBacktestData.js
import { ref } from 'vue';
import { joinURL } from 'ufo';

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

        const apiPromises = symbolsToFetch.map(async (symbol) => {
            try {
                const response = await fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${symbol.toLowerCase()}.json`
                    )
                );
                if (!response.ok)
                    throw new Error(`데이터 파일을 찾을 수 없습니다.`);
                const data = await response.json();
                if (!data.backtestData)
                    throw new Error(`백테스팅 데이터가 없습니다.`);
                return { symbol, ...data.backtestData };
            } catch (error) {
                return {
                    symbol,
                    error: `[${symbol}] ${error.message}`,
                    prices: [],
                    dividends: [],
                    splits: [],
                };
            }
        });

        const tickerData = await Promise.all(apiPromises);

        const [exchangeResponse, holidayResponse] = await Promise.all([
            fetch(joinURL(import.meta.env.BASE_URL, 'exchange-rates.json')),
            fetch(joinURL(import.meta.env.BASE_URL, 'holidays.json')),
        ]);

        if (!exchangeResponse.ok)
            throw new Error('환율 데이터를 불러올 수 없습니다.');
        if (!holidayResponse.ok)
            throw new Error('휴장일 데이터를 불러올 수 없습니다.');

        const exchangeRates = await exchangeResponse.json();
        const holidays = await holidayResponse.json();
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
            throw new Error(
                `[${failedSymbols.join(', ')}] 종목의 가격 데이터가 없습니다. 다른 종목을 선택해주세요.`
            );
        }

        const latestIpoDate = new Date(Math.max.apply(null, dataStartDates));
        let effectiveStartDate = new Date(startDate);

        if (effectiveStartDate < latestIpoDate) {
            effectiveStartDate = latestIpoDate;
            adjustedDateMessage.value = `시작일이 ${effectiveStartDate.toISOString().split('T')[0]}로 자동 조정되었습니다.`;
        } else {
            adjustedDateMessage.value = '';
        }

        return {
            effectiveStartDate: effectiveStartDate.toISOString().split('T')[0],
            apiData,
            holidays,
        };
    };

    return { fetchDataForBacktest, adjustedDateMessage };
}
