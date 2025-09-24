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
        startDate,
        endDate,
        initialInvestmentKRW,
        commission,
        apiData,
        holidays,
    } = options;

    const exchangeRateMap = new Map(
        apiData.exchangeRates.map((r) => [r.date, r.rate])
    );
    const startRate = exchangeRateMap.get(startDate);
    if (!startRate) throw new Error('Start date exchange rate not found.');

    const initialInvestmentUSD = initialInvestmentKRW / startRate;
    const investmentPerTicker = initialInvestmentUSD / symbols.length;
    const commissionRate = commission / 100;

    const results = {};
    const allSymbols = [...symbols, comparisonSymbol];

    allSymbols.forEach((symbol) => {
        const symbolData = apiData.tickerData.find((d) => d.symbol === symbol);
        if (!symbolData || symbolData.error) {
            results[symbol] = { error: `Data not found for ${symbol}` };
            return;
        }

        let prices = symbolData.prices.map((p) => ({ ...p }));
        let dividends = symbolData.dividends.map((d) => ({ ...d }));

        symbolData.splits.forEach((split) => {
            const splitDate = new Date(split.date);
            const [numerator, denominator] = split.ratio.split(':').map(Number);
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

        const priceMap = new Map(prices.map((p) => [p.date, p]));
        const dividendMap = new Map(dividends.map((d) => [d.date, d.amount]));

        const startPrice = priceMap.get(startDate)?.close;
        if (!startPrice) {
            results[symbol] = { error: `Start price not found for ${symbol}` };
            return;
        }

        let sharesWithReinvest =
            (investmentPerTicker * (1 - commissionRate)) / startPrice;
        let sharesWithoutReinvest = sharesWithReinvest;
        let cashCollected = 0;

        const historyWithReinvest = [];
        const historyWithoutReinvest = [];
        const dividendPayouts = [];

        let currentDate = new Date(startDate);
        const finalDate = new Date(endDate);

        while (currentDate <= finalDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const currentPriceData = priceMap.get(dateStr);

            if (currentPriceData) {
                const currentClose = currentPriceData.close;
                historyWithReinvest.push([
                    dateStr,
                    sharesWithReinvest * currentClose,
                ]);
                historyWithoutReinvest.push([
                    dateStr,
                    sharesWithoutReinvest * currentClose,
                ]);

                if (dividendMap.has(dateStr)) {
                    const dividendAmount = dividendMap.get(dateStr);
                    const totalDividend = sharesWithReinvest * dividendAmount;
                    const afterTaxDividend = totalDividend * 0.85;

                    cashCollected +=
                        sharesWithoutReinvest * dividendAmount * 0.85;
                    dividendPayouts.push({
                        date: dateStr,
                        amount: sharesWithoutReinvest * dividendAmount * 0.85,
                        ticker: symbol,
                    });

                    const reinvestmentDate = addBusinessDays(
                        currentDate,
                        2,
                        holidays
                    );
                    const reinvestmentDateStr = reinvestmentDate
                        .toISOString()
                        .split('T')[0];
                    const reinvestmentPriceData =
                        priceMap.get(reinvestmentDateStr);

                    if (
                        reinvestmentPriceData &&
                        reinvestmentPriceData.open > 0
                    ) {
                        const reinvestmentPrice = reinvestmentPriceData.open;
                        const newShares =
                            (afterTaxDividend * (1 - commissionRate)) /
                            reinvestmentPrice;
                        sharesWithReinvest += newShares;
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const endPrice =
            priceMap.get(endDate)?.close ||
            historyWithReinvest[historyWithReinvest.length - 1][1] /
                sharesWithReinvest;
        const endingShares = sharesWithReinvest;
        const endingInvestmentWithReinvest = endingShares * endPrice;
        const endingInvestmentWithoutReinvest =
            sharesWithoutReinvest * endPrice;
        const totalReturnWithReinvest =
            endingInvestmentWithReinvest / investmentPerTicker - 1;
        const totalReturnWithoutReinvest =
            (endingInvestmentWithoutReinvest + cashCollected) /
                investmentPerTicker -
            1;
        const years =
            (finalDate - new Date(startDate)) / (365.25 * 24 * 60 * 60 * 1000);

        results[symbol] = {
            withReinvest: {
                history: historyWithReinvest,
                startPrice,
                endPrice,
                startingShares: sharesWithoutReinvest,
                endingShares: endingShares,
                dividendsReinvested:
                    (endingShares - sharesWithoutReinvest) * endPrice,
                totalReturn: totalReturnWithReinvest,
                cagr: Math.pow(1 + totalReturnWithReinvest, 1 / years) - 1,
                endingInvestment: endingInvestmentWithReinvest,
            },
            withoutReinvest: {
                history: historyWithoutReinvest,
                startPrice,
                endPrice,
                startingShares: sharesWithoutReinvest,
                endingShares: sharesWithoutReinvest,
                dividendsCollected: cashCollected,
                totalReturn: totalReturnWithoutReinvest,
                cagr: Math.pow(1 + totalReturnWithoutReinvest, 1 / years) - 1,
                endingInvestment: endingInvestmentWithoutReinvest,
            },
            dividendPayouts: dividendPayouts,
            years,
        };
    });

    const finalResult = {
        withReinvest: { series: [], summary: {} },
        withoutReinvest: { series: [], summary: {} },
        cashDividends: [],
    };

    let totalEndingWithReinvest = 0;
    let totalEndingWithoutReinvest = 0;
    let totalCashCollected = 0;

    symbols.forEach((symbol) => {
        const res = results[symbol];
        if (res && !res.error) {
            totalEndingWithReinvest += res.withReinvest.endingInvestment;
            totalEndingWithoutReinvest += res.withoutReinvest.endingInvestment;
            totalCashCollected += res.withoutReinvest.dividendsCollected;
            finalResult.cashDividends.push(...res.dividendPayouts);
        }
    });

    const portfolioHistoryWithReinvest = results[
        symbols[0]
    ]?.withReinvest.history.map(([date]) => {
        const totalValue = symbols.reduce((sum, symbol) => {
            const historyPoint = results[symbol]?.withReinvest.history.find(
                (h) => h[0] === date
            );
            return sum + (historyPoint ? historyPoint[1] : 0);
        }, 0);
        return [date, totalValue];
    });

    const portfolioHistoryWithoutReinvest = results[
        symbols[0]
    ]?.withoutReinvest.history.map(([date]) => {
        const totalValue = symbols.reduce((sum, symbol) => {
            const historyPoint = results[symbol]?.withoutReinvest.history.find(
                (h) => h[0] === date
            );
            return sum + (historyPoint ? historyPoint[1] : 0);
        }, 0);
        return [date, totalValue];
    });

    const years = results[symbols[0]]?.years || 1;
    finalResult.withReinvest.series = [
        { name: 'Portfolio', data: portfolioHistoryWithReinvest },
        {
            name: comparisonSymbol,
            data: results[comparisonSymbol]?.withReinvest.history.map(
                ([date, value]) => [date, value * symbols.length]
            ),
        },
    ];
    finalResult.withoutReinvest.series = [
        { name: 'Portfolio', data: portfolioHistoryWithoutReinvest },
        {
            name: comparisonSymbol,
            data: results[comparisonSymbol]?.withoutReinvest.history.map(
                ([date, value]) => [date, value * symbols.length]
            ),
        },
    ];

    const totalReturnWithReinvest =
        totalEndingWithReinvest / initialInvestmentUSD - 1;
    const totalReturnWithoutReinvest =
        (totalEndingWithoutReinvest + totalCashCollected) /
            initialInvestmentUSD -
        1;

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

    return finalResult;
}
