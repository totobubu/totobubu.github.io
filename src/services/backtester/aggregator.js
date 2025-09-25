import { calculateCAGR } from './utils.js';

export function aggregateResults(options) {
    const {
        portfolio,
        comparisonSymbol,
        results,
        initialInvestmentUSD,
        investmentPerTicker,
        initialStartDate,
        endDate,
    } = options;

    const validPortfolioSymbols = portfolio
        .map((p) => p.symbol.toUpperCase())
        .filter((s) => results[s] && !results[s].error);
    if (validPortfolioSymbols.length === 0) {
        throw new Error(
            results[portfolio[0].symbol.toUpperCase()]?.error ||
                '모든 포트폴리오 종목의 백테스팅에 실패했습니다.'
        );
    }

    const validBaseSymbol = validPortfolioSymbols[0];
    const years = results[validBaseSymbol].years;
    const baseHistory = results[validBaseSymbol].withReinvest.history;
    const finalResult = {
        withReinvest: { series: [] },
        withoutReinvest: { series: [] },
        cashDividends: [],
    };

    const portfolioHistoryWithReinvest = baseHistory.map(([date]) => [
        date,
        validPortfolioSymbols.reduce(
            (sum, s) =>
                sum +
                (results[s].withReinvest.history.find(
                    (h) => h[0] === date
                )?.[1] || 0),
            0
        ),
    ]);
    const portfolioHistoryWithoutReinvest = baseHistory.map(([date]) => [
        date,
        validPortfolioSymbols.reduce(
            (sum, s) =>
                sum +
                (results[s].withoutReinvest.history.find(
                    (h) => h[0] === date
                )?.[1] || 0),
            0
        ),
    ]);
    const portfolioCashHistory = baseHistory.map(([date]) => [
        date,
        validPortfolioSymbols.reduce(
            (sum, s) =>
                sum +
                (results[s].withoutReinvest.cashHistory.find(
                    (h) => h[0] === date
                )?.[1] || 0),
            0
        ),
    ]);

    finalResult.withReinvest.series.push({
        name: 'Portfolio',
        data: portfolioHistoryWithReinvest,
    });
    finalResult.withoutReinvest.series.push({
        name: 'Portfolio (주가)',
        data: portfolioHistoryWithoutReinvest,
    });
    finalResult.withoutReinvest.series.push({
        name: 'Portfolio (현금 배당)',
        data: portfolioCashHistory,
    });

    const individualResults = {};
    validPortfolioSymbols.forEach((symbol) => {
        individualResults[symbol] = results[symbol];
    });

    let comparisonDataResult = null;
    const safeComparisonSymbol = comparisonSymbol.toUpperCase();
    if (
        comparisonSymbol &&
        comparisonSymbol !== 'None' &&
        results[safeComparisonSymbol] &&
        !results[safeComparisonSymbol].error
    ) {
        const compResult = results[safeComparisonSymbol];
        comparisonDataResult = compResult;
        finalResult.withReinvest.series.push({
            name: safeComparisonSymbol,
            data: compResult.withReinvest.history,
        });
    }

    const totalEndingWithReinvest =
        portfolioHistoryWithReinvest.length > 0
            ? portfolioHistoryWithReinvest[
                  portfolioHistoryWithReinvest.length - 1
              ][1]
            : 0;
    const totalEndingWithoutReinvest =
        portfolioHistoryWithoutReinvest.length > 0
            ? portfolioHistoryWithoutReinvest[
                  portfolioHistoryWithoutReinvest.length - 1
              ][1]
            : 0;
    const totalCashCollected =
        portfolioCashHistory.length > 0
            ? portfolioCashHistory[portfolioCashHistory.length - 1][1]
            : 0;

    const totalReturnWithReinvest =
        initialInvestmentUSD > 0
            ? totalEndingWithReinvest / initialInvestmentUSD - 1
            : 0;
    const totalReturnWithoutReinvest =
        initialInvestmentUSD > 0
            ? (totalEndingWithoutReinvest + totalCashCollected) /
                  initialInvestmentUSD -
              1
            : 0;

    finalResult.withReinvest.summary = {
        totalReturn: totalReturnWithReinvest,
        cagr: calculateCAGR(totalReturnWithReinvest, years),
        endingInvestment: totalEndingWithReinvest,
    };
    finalResult.withoutReinvest.summary = {
        totalReturn: totalReturnWithoutReinvest,
        cagr: calculateCAGR(totalReturnWithoutReinvest, years),
        endingInvestment: totalEndingWithoutReinvest,
        dividendsCollected: totalCashCollected,
    };

    finalResult.initialInvestment = initialInvestmentUSD;
    finalResult.years = years;
    finalResult.cashDividends = validPortfolioSymbols.flatMap(
        (s) => results[s].dividendPayouts
    );
    finalResult.symbols = portfolio.map((p) => p.symbol);
    finalResult.comparisonSymbol = comparisonSymbol;
    finalResult.individualResults = individualResults;
    finalResult.comparisonResult = comparisonDataResult;

    return finalResult;
}
