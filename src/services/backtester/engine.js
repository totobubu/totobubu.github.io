import { runSimulation } from './simulator.js';
import { aggregateResults } from './aggregator.js';
import { processSymbolData } from './dataProcessor.js';

export function runBacktest(options) {
    console.log('[Engine] Starting `runBacktest`');
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
    let currentDateForStartRate = new Date(`${initialStartDate}T00:00:00Z`);
    let startRate = null,
        actualStartDateStr = '';
    for (let i = 0; i < 7; i++) {
        const dateStr = currentDateForStartRate.toISOString().split('T')[0];
        if (exchangeRateMap.has(dateStr)) {
            startRate = exchangeRateMap.get(dateStr);
            actualStartDateStr = dateStr;
            break;
        }
        currentDateForStartRate.setUTCDate(
            currentDateForStartRate.getUTCDate() + 1
        );
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

    console.log('[Engine] Processing symbols:', allSymbols);

    allSymbols.forEach((symbol) => {
        try {
            const symbolData = apiData.tickerData.find(
                (d) => d.symbol.toUpperCase() === symbol
            );
            if (!symbolData || symbolData.error)
                throw new Error(
                    symbolData?.error ||
                        `[${symbol}] 과거 데이터를 찾을 수 없습니다.`
                );

            const { priceMap, dividendMap } = processSymbolData(symbolData);

            const dataStartDate =
                symbolData.prices.length > 0
                    ? new Date(symbolData.prices[0].date)
                    : null;
            let effectiveStartDate = new Date(actualStartDateStr);
            if (dataStartDate && dataStartDate > effectiveStartDate) {
                effectiveStartDate = dataStartDate;
            }

            const portfolioItem = portfolio.find(
                (p) => p.symbol.toUpperCase() === symbol
            );
            const weight = portfolioItem ? portfolioItem.value / 100 : 1.0;
            const investmentPerTicker =
                symbol === comparisonSymbol.toUpperCase()
                    ? initialInvestmentUSD
                    : initialInvestmentUSD * weight;

            const simulationResult = runSimulation({
                symbol,
                effectiveStartDateStr: effectiveStartDate
                    .toISOString()
                    .split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                investmentPerTicker,
                commissionRate,
                taxRate,
                priceMap,
                dividendMap,
                holidays,
            });

            const years =
                (new Date(endDate) - new Date(initialStartDate)) /
                    (365.25 * 24 * 60 * 60 * 1000) || 1;

            const endingInvestmentWithReinvest =
                simulationResult.withReinvest.endingInvestment;
            const totalReturnWithReinvest =
                investmentPerTicker > 0
                    ? endingInvestmentWithReinvest / investmentPerTicker - 1
                    : 0;

            const endingInvestmentWithoutReinvest =
                simulationResult.withoutReinvest.endingInvestment;
            const finalCashCollected =
                simulationResult.withoutReinvest.dividendsCollected;
            const totalReturnWithoutReinvest =
                investmentPerTicker > 0
                    ? (endingInvestmentWithoutReinvest + finalCashCollected) /
                          investmentPerTicker -
                      1
                    : 0;

            results[symbol] = {
                ...simulationResult,
                years,
                withReinvest: {
                    ...simulationResult.withReinvest,
                    totalReturn: totalReturnWithReinvest,
                    cagr: calculateCAGR(totalReturnWithReinvest, years),
                },
                withoutReinvest: {
                    ...simulationResult.withoutReinvest,
                    totalReturn: totalReturnWithoutReinvest,
                    cagr: calculateCAGR(totalReturnWithoutReinvest, years),
                },
            };
        } catch (error) {
            console.error(
                `[Engine] Error during simulation for ${symbol}:`,
                error.message
            );
            results[symbol] = { error: error.message };
        }
    });

    console.log('[Engine] All simulations finished, passing to aggregator.');
    return aggregateResults({
        portfolio,
        comparisonSymbol,
        results,
        initialInvestmentUSD,
        initialStartDate,
        endDate,
    });
}
