// src/services/backtestEngine.js (최종 완성본)

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
        symbols,
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
    const investmentPerTicker = initialInvestmentUSD / (symbols.length || 1);
    const commissionRate = commission / 100;
    const results = {};
    const allSymbols = [...symbols, comparisonSymbol].filter(
        (s) => s && s !== 'None'
    );

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

        let prices = symbolData.prices.map((p) => ({ ...p }));
        let dividends = symbolData.dividends.map((d) => ({ ...d }));

        if (symbolData.splits && Array.isArray(symbolData.splits)) {
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
            historyWithoutReinvest = [];
        const dividendPayouts = [];

        while (currentDate <= finalDate) {
            const dateStr = currentDate.toISOString().split('T')[0];

            if (dividendMap.has(dateStr)) {
                const dividendAmount = dividendMap.get(dateStr);
                const afterTaxDividendForReinvest =
                    sharesWithReinvest * dividendAmount * 0.85;
                const afterTaxDividendForCash =
                    sharesWithoutReinvest * dividendAmount * 0.85;

                dividendPayouts.push({
                    date: dateStr,
                    amount: afterTaxDividendForCash,
                    ticker: symbol,
                });

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
                        (afterTaxDividendForReinvest * (1 - commissionRate)) /
                        reinvestmentPriceData.open;
                }
            }

            const currentPriceData = priceMap.get(dateStr);
            if (currentPriceData) {
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
            historyWithReinvest[historyWithReinvest.length - 1][1] /
            sharesWithReinvest;
        const years =
            (finalDate - new Date(initialStartDate)) /
                (365.25 * 24 * 60 * 60 * 1000) || 1;

        const endingInvestmentWithReinvest = sharesWithReinvest * endPrice;
        const totalReturnWithReinvest =
            endingInvestmentWithReinvest / investmentPerTicker - 1;
        const endingInvestmentWithoutReinvest =
            sharesWithoutReinvest * endPrice;
        const finalCashCollected =
            historyCash.length > 0 ? historyCash[historyCash.length - 1][1] : 0;
        const totalReturnWithoutReinvest =
            (endingInvestmentWithoutReinvest + finalCashCollected) /
                investmentPerTicker -
            1;

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

    const validSymbols = symbols.filter((s) => results[s] && !results[s].error);
    if (validSymbols.length === 0) {
        const firstError =
            results[symbols[0]]?.error ||
            '모든 종목의 백테스팅에 실패했습니다.';
        throw new Error(firstError);
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
        const compInvestment = initialInvestmentUSD;
        const compResult = results[comparisonSymbol];

        const compHistoryWithReinvest = compResult.withReinvest.history.map(
            ([date, value]) => [
                date,
                (value / investmentPerTicker) * compInvestment,
            ]
        );
        finalResult.withReinvest.series.push({
            name: comparisonSymbol,
            data: compHistoryWithReinvest,
        });

        const compHistoryWithoutReinvest =
            compResult.withoutReinvest.history.map(([date, value]) => [
                date,
                (value / investmentPerTicker) * compInvestment,
            ]);
        const compCashHistory = compResult.withoutReinvest.cashHistory.map(
            ([date, value]) => [
                date,
                (value / investmentPerTicker) * compInvestment,
            ]
        );
        finalResult.withoutReinvest.series.push({
            name: `${comparisonSymbol} (주가)`,
            data: compHistoryWithoutReinvest,
        });
        finalResult.withoutReinvest.series.push({
            name: `${comparisonSymbol} (현금 배당)`,
            data: compCashHistory,
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
    finalResult.symbols = symbols;
    finalResult.comparisonSymbol = comparisonSymbol;

    return finalResult;
}
