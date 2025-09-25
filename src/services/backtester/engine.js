import { runSimulation } from './simulator.js';
import { aggregateResults } from './aggregator.js';

export function runBacktest(options) {
    const {
        portfolio,
        comparisonSymbol,
        startDate: initialStartDate,
        endDate,
        initialInvestmentKRW,
        commission,
        applyTax,
        apiData,
        holidays,
    } = options;

    const exchangeRateMap = new Map(
        apiData.exchangeRates.map((r) => [r.date, r.rate])
    );
    let currentDateForStartRate = new Date(initialStartDate);
    let startRate = null;
    let actualStartDateStr = '';
    for (let i = 0; i < 7; i++) {
        const dateStr = currentDateForStartRate.toISOString().split('T')[0];
        if (exchangeRateMap.has(dateStr)) {
            startRate = exchangeRateMap.get(dateStr);
            actualStartDateStr = dateStr;
            break;
        }
        currentDateForStartRate.setDate(currentDateForStartRate.getDate() + 1);
    }
    if (!startRate)
        throw new Error(
            `시작일(${initialStartDate}) 근처의 환율 정보를 찾을 수 없습니다.`
        );

    const initialInvestmentUSD = initialInvestmentKRW / startRate;
    const commissionRate = commission / 100;
    const taxRate = applyTax ? 0.85 : 1.0;
    const results = {};
    const allSymbols = [
        ...new Set(
            [
                ...portfolio.map((p) => p.symbol.toUpperCase()),
                comparisonSymbol.toUpperCase(),
            ].filter((s) => s && s !== 'NONE')
        ),
    ];

    allSymbols.forEach((symbol) => {
        try {
            const symbolData = apiData.tickerData.find(
                (d) => d.symbol.toUpperCase() === symbol
            );
            if (!symbolData || symbolData.error)
                throw new Error(
                    symbolData?.error ||
                        `[${symbol}] 과거 데이터를 불러오지 못했습니다.`
                );

            const portfolioItem = portfolio.find(
                (p) => p.symbol.toUpperCase() === symbol
            );
            const weight = portfolioItem ? portfolioItem.value / 100 : 1.0;
            const investmentPerTicker =
                symbol === comparisonSymbol.toUpperCase()
                    ? initialInvestmentUSD
                    : initialInvestmentUSD * weight;

            results[symbol] = runSimulation({
                symbol,
                symbolData,
                effectiveStartDateStr: actualStartDateStr,
                endDate,
                investmentPerTicker,
                commissionRate,
                taxRate,
                holidays,
            });
        } catch (error) {
            results[symbol] = { error: error.message };
        }
    });

    return aggregateResults({
        portfolio,
        comparisonSymbol,
        results,
        initialInvestmentUSD,
        initialStartDate,
        endDate,
    });
}
