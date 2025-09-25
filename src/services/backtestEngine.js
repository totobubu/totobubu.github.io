function addBusinessDays(startDate, daysToAdd, holidays = []) {
    let currentDate = new Date(startDate);
    let addedDays = 0;
    const holidaySet = new Set(holidays.map((h) => h.date));
    while (addedDays < daysToAdd) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        const dateString = currentDate.toISOString().split('T')[0];
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateString)) {
            addedDays++;
        }
    }
    return currentDate;
}

export function runBacktest(options) {
    const {
        portfolio,
        comparisonSymbol,
        startDate: initialStartDate,
        endDate,
        initialInvestmentKRW,
        commission,
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
    const results = {};
    const allSymbols = [
        ...portfolio.map((p) => p.symbol),
        comparisonSymbol,
    ].filter((s) => s && s !== 'None');

    allSymbols.forEach((symbol) => {
        const symbolData = apiData.tickerData.find((d) => d.symbol === symbol);
        if (
            !symbolData ||
            symbolData.error ||
            !symbolData.prices ||
            symbolData.prices.length === 0
        ) {
            results[symbol] = {
                error: `[${symbol}] 과거 데이터를 불러오지 못했습니다. (API 응답 없음)`,
            };
            return;
        }

        const portfolioItem = portfolio.find((p) => p.symbol === symbol);
        const weight = portfolioItem ? portfolioItem.value / 100 : 1.0;
        const investmentPerTicker =
            symbol === comparisonSymbol
                ? initialInvestmentUSD
                : initialInvestmentUSD * weight;

        let prices = symbolData.prices.map((p) => ({ ...p }));
        let dividends = symbolData.dividends.map((d) => ({ ...d }));

        if (symbolData.splits?.length > 0) {
            symbolData.splits.forEach((split) => {
                const splitDate = new Date(split.date);
                const [numerator, denominator] = split.ratio
                    .split(':')
                    .map(Number);
                if (!denominator) return;
                const ratio = numerator / denominator;
                prices.forEach((price) => {
                    if (new Date(price.date) < splitDate) {
                        price.open /= ratio;
                        price.close /= ratio;
                    }
                });
                dividends.forEach((div) => {
                    if (new Date(div.date) < splitDate) {
                        div.amount /= ratio;
                    }
                });
            });
        }

        const priceMap = new Map(prices.map((p) => [p.date, p]));
        const dividendMap = new Map(
            dividends.map((d) => [d.date.split('T')[0], d.amount])
        );

        const startPriceData = priceMap.get(actualStartDateStr);
        if (!startPriceData || !startPriceData.close) {
            results[symbol] = {
                error: `[${symbol}] 시작일(${actualStartDateStr})의 주가 정보가 없습니다.`,
            };
            return;
        }

        const startPrice = startPriceData.close;
        let sharesWithReinvest =
            (investmentPerTicker * (1 - commissionRate)) / startPrice;
        let sharesWithoutReinvest = sharesWithReinvest;

        let currentDate = new Date(actualStartDateStr);
        const finalDate = new Date(endDate);
        const historyWithReinvest = [],
            historyWithoutReinvest = [],
            dividendPayouts = [];

        while (currentDate <= finalDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const currentPriceData = priceMap.get(dateStr);

            if (currentPriceData) {
                if (dividendMap.has(dateStr)) {
                    const dividendAmount = dividendMap.get(dateStr);
                    const afterTaxDividendForCash =
                        sharesWithoutReinvest * dividendAmount * 0.85;
                    dividendPayouts.push({
                        date: dateStr,
                        amount: afterTaxDividendForCash,
                        ticker: symbol,
                    });
                    const afterTaxDividendForReinvest =
                        sharesWithReinvest * dividendAmount * 0.85;
                    const reinvestmentDate = addBusinessDays(
                        currentDate,
                        2,
                        holidays
                    );
                    const reinvestmentPriceData = priceMap.get(
                        reinvestmentDate.toISOString().split('T')[0]
                    );
                    if (reinvestmentPriceData?.open > 0) {
                        sharesWithReinvest +=
                            (afterTaxDividendForReinvest *
                                (1 - commissionRate)) /
                            reinvestmentPriceData.open;
                    }
                }
                historyWithReinvest.push([
                    dateStr,
                    sharesWithReinvest * currentPriceData.close,
                ]);
                historyWithoutReinvest.push([
                    dateStr,
                    sharesWithoutReinvest * currentPriceData.close,
                ]);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (historyWithReinvest.length === 0) {
            results[symbol] = {
                error: `[${symbol}] 선택된 기간에 유효한 데이터가 없습니다.`,
            };
            return;
        }

        let cashCollected = 0;
        const historyCash = historyWithoutReinvest.map(([date]) => {
            const payoutToday = dividendPayouts.find((p) => p.date === date);
            if (payoutToday) {
                cashCollected += payoutToday.amount;
            }
            return [date, cashCollected];
        });

        const endPrice =
            historyWithReinvest.length > 0
                ? historyWithReinvest[historyWithReinvest.length - 1][1] /
                  sharesWithReinvest
                : 0;
        const years =
            (finalDate - new Date(initialStartDate)) /
                (365.25 * 24 * 60 * 60 * 1000) || 1;
        const endingInvestmentWithReinvest = sharesWithReinvest * endPrice;
        const totalReturnWithReinvest =
            investmentPerTicker > 0
                ? endingInvestmentWithReinvest / investmentPerTicker - 1
                : 0;
        const endingInvestmentWithoutReinvest =
            sharesWithoutReinvest * endPrice;
        const finalCashCollected = cashCollected;
        const totalReturnWithoutReinvest =
            investmentPerTicker > 0
                ? (endingInvestmentWithoutReinvest + finalCashCollected) /
                      investmentPerTicker -
                  1
                : 0;

        results[symbol] = {
            withReinvest: {
                history: historyWithReinvest,
                totalReturn: totalReturnWithReinvest,
                endingInvestment: endingInvestmentWithReinvest,
            },
            withoutReinvest: {
                history: historyWithoutReinvest,
                cashHistory: historyCash,
                totalReturn: totalReturnWithoutReinvest,
                endingInvestment: endingInvestmentWithoutReinvest,
                dividendsCollected: finalCashCollected,
            },
            dividendPayouts,
            years,
        };
    });

    const validSymbols = portfolio
        .map((p) => p.symbol)
        .filter((s) => results[s] && !results[s].error);
    if (validSymbols.length === 0) {
        throw new Error(
            results[portfolio[0].symbol]?.error ||
                '모든 포트폴리오 종목의 백테스팅에 실패했습니다.'
        );
    }

    const validBaseSymbol = validSymbols[0];
    const years = results[validBaseSymbol].years;
    const baseHistory = results[validBaseSymbol].withReinvest.history;
    const finalResult = {
        withReinvest: { series: [] },
        withoutReinvest: { series: [] },
        cashDividends: [],
    };

    const portfolioHistoryWithReinvest = baseHistory.map(([date]) => [
        date,
        validSymbols.reduce(
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
        validSymbols.reduce(
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
        validSymbols.reduce(
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

    if (
        comparisonSymbol &&
        comparisonSymbol !== 'None' &&
        results[comparisonSymbol] &&
        !results[comparisonSymbol].error
    ) {
        const compResult = results[comparisonSymbol];
        finalResult.withReinvest.series.push({
            name: comparisonSymbol,
            data: compResult.withReinvest.history,
        });
        finalResult.withoutReinvest.series.push({
            name: `${comparisonSymbol} (주가)`,
            data: compResult.withoutReinvest.history,
        });
        finalResult.withoutReinvest.series.push({
            name: `${comparisonSymbol} (현금 배당)`,
            data: compResult.withoutReinvest.cashHistory,
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
        cagr: Math.pow(1 + totalReturnWithReinvest, 1 / years) - 1,
        endingInvestment: totalEndingWithReinvest,
    };
    finalResult.withoutReinvest.summary = {
        totalReturn: totalReturnWithoutReinvest,
        cagr: Math.pow(1 + totalReturnWithoutReinvest, 1 / years) - 1,
        endingInvestment: totalEndingWithoutReinvest,
        dividendsCollected: totalCashCollected,
    };

    finalResult.initialInvestment = initialInvestmentUSD;
    finalResult.years = years;
    finalResult.cashDividends = validSymbols.flatMap(
        (s) => results[s].dividendPayouts
    );
    finalResult.symbols = portfolio.map((p) => p.symbol);
    finalResult.comparisonSymbol = comparisonSymbol;

    return finalResult;
}
