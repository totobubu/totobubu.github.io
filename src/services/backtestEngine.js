// src/services/backtestEngine.js

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

    console.log('Backtest Engine Start: ', { symbols, startDate, endDate });

    // --- 1. 초기 설정 ---
    const exchangeRateMap = new Map(
        apiData.exchangeRates.map((r) => [r.date, r.rate])
    );
    const startRate = exchangeRateMap.get(startDate);
    if (!startRate)
        throw new Error(`시작일(${startDate})의 환율 정보를 찾을 수 없습니다.`);

    const initialInvestmentUSD = initialInvestmentKRW / startRate;
    const investmentPerTicker = initialInvestmentUSD / symbols.length;
    const commissionRate = commission / 100;

    const results = {};
    const allSymbols = [...symbols, comparisonSymbol].filter(
        (s) => s && s !== 'None'
    );

    console.log(
        '[Engine] Step 1: Initial setup complete. Starting individual backtests...'
    );

    // --- 2. 각 종목별 개별 백테스팅 실행 ---
    allSymbols.forEach((symbol) => {
        console.log(`[Engine] Processing symbol: ${symbol}`);
        const symbolData = apiData.tickerData.find((d) => d.symbol === symbol);
        // [수정] symbolData 자체 또는 prices가 없는 경우를 먼저 체크
        if (
            !symbolData ||
            symbolData.error ||
            !symbolData.prices ||
            symbolData.prices.length === 0
        ) {
            results[symbol] = {
                error: `[${symbol}] 과거 데이터를 불러오지 못했습니다. (API 응답 없음)`,
            };
            console.error(results[symbol].error);
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

        // [수정] 시작일의 주가 데이터를 더 안전하게 찾음
        let currentDateForStart = new Date(startDate);
        let startPriceData = null;
        for (let i = 0; i < 7; i++) {
            // 최대 7일간 탐색
            const dateStr = currentDateForStart.toISOString().split('T')[0];
            if (priceMap.has(dateStr)) {
                startPriceData = priceMap.get(dateStr);
                break;
            }
            currentDateForStart.setDate(currentDateForStart.getDate() + 1);
        }

        if (!startPriceData || !startPriceData.close) {
            results[symbol] = {
                error: `[${symbol}] 시작일(${startDate}) 근처의 주가 정보가 없습니다. 다른 날짜를 선택해주세요.`,
            };
            console.error(results[symbol].error);
            return;
        }
        const actualStartDate = currentDateForStart;
        const startPrice = startPriceData.close;

        let sharesWithReinvest =
            (investmentPerTicker * (1 - commissionRate)) / startPrice;
        let sharesWithoutReinvest = sharesWithReinvest;
        let cashCollected = 0;

        // [중요] 일일 루프의 시작점을 실제 데이터가 있는 날짜로 변경
        let currentDate = actualStartDate;
        const finalDate = new Date(endDate);
        const historyWithReinvest = [];
        const historyWithoutReinvest = [];
        const dividendPayouts = [];
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
                        sharesWithReinvest +=
                            (afterTaxDividend * (1 - commissionRate)) /
                            reinvestmentPriceData.open;
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (historyWithReinvest.length === 0) {
            results[symbol] = {
                error: `[${symbol}] 선택된 기간에 유효한 주가 데이터가 없습니다.`,
            };
            console.error(results[symbol].error);
            return;
        }

        const endPrice =
            historyWithReinvest[historyWithReinvest.length - 1][1] /
            sharesWithReinvest;
        const years =
            (finalDate - new Date(startDate)) / (365.25 * 24 * 60 * 60 * 1000);

        const endingInvestmentWithReinvest = sharesWithReinvest * endPrice;
        const totalReturnWithReinvest =
            endingInvestmentWithReinvest / investmentPerTicker - 1;

        const endingInvestmentWithoutReinvest =
            sharesWithoutReinvest * endPrice;
        const totalReturnWithoutReinvest =
            (endingInvestmentWithoutReinvest + cashCollected) /
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
                totalReturn: totalReturnWithoutReinvest,
                endingInvestment: endingInvestmentWithoutReinvest,
                dividendsCollected: cashCollected,
            },
            dividendPayouts,
            years,
        };
    });

    console.log(
        '[Engine] Step 2: Individual backtests complete. Intermediate Results:',
        results
    );

    // --- 3. 포트폴리오 결과 종합 ---
    const validSymbols = symbols.filter((s) => results[s] && !results[s].error);
    if (validSymbols.length === 0) {
        // [핵심 수정] firstError 변수를 여기서 정의합니다.
        const firstError =
            results[symbols[0]]?.error ||
            '모든 종목의 백테스팅에 실패했습니다.';

        console.error(
            '[Engine] All symbols failed. Throwing error:',
            firstError
        );
        throw new Error(firstError);
    }

    console.log('[Engine] Step 3: Aggregating portfolio results...');
    const validBaseSymbol = validSymbols[0];
    const years = results[validBaseSymbol].years;
    const finalResult = {
        withReinvest: { series: [] },
        withoutReinvest: { series: [] },
        cashDividends: [],
    };

    // 포트폴리오 전체 가치 계산
    const baseHistory = results[validBaseSymbol].withReinvest.history;
    const portfolioHistoryWithReinvest = baseHistory.map(([date]) => {
        const totalValue = validSymbols.reduce((sum, symbol) => {
            const historyPoint = results[symbol].withReinvest.history.find(
                (h) => h[0] === date
            );
            return sum + (historyPoint ? historyPoint[1] : 0);
        }, 0);
        return [date, totalValue];
    });

    const portfolioHistoryWithoutReinvest = baseHistory.map(([date]) => {
        const totalValue = validSymbols.reduce((sum, symbol) => {
            const historyPoint = results[symbol].withoutReinvest.history.find(
                (h) => h[0] === date
            );
            return sum + (historyPoint ? historyPoint[1] : 0);
        }, 0);
        return [date, totalValue];
    });

    finalResult.withReinvest.series.push({
        name: 'Portfolio',
        data: portfolioHistoryWithReinvest,
    });
    finalResult.withoutReinvest.series.push({
        name: 'Portfolio',
        data: portfolioHistoryWithoutReinvest,
    });

    // 비교 대상 차트 데이터 추가
    if (
        comparisonSymbol &&
        comparisonSymbol !== 'None' &&
        results[comparisonSymbol] &&
        !results[comparisonSymbol].error
    ) {
        const comparisonInvestment = initialInvestmentUSD; // 비교 대상은 전체 투자금으로 시작
        const comparisonHistoryWithReinvest = results[
            comparisonSymbol
        ].withReinvest.history.map(([date, value]) => [
            date,
            (value / investmentPerTicker) * comparisonInvestment,
        ]);
        finalResult.withReinvest.series.push({
            name: comparisonSymbol,
            data: comparisonHistoryWithReinvest,
        });

        const comparisonHistoryWithoutReinvest = results[
            comparisonSymbol
        ].withoutReinvest.history.map(([date, value]) => [
            date,
            (value / investmentPerTicker) * comparisonInvestment,
        ]);
        finalResult.withoutReinvest.series.push({
            name: comparisonSymbol,
            data: comparisonHistoryWithoutReinvest,
        });
    }

    // 최종 요약 정보 계산
    const totalEndingWithReinvest =
        portfolioHistoryWithReinvest[
            portfolioHistoryWithReinvest.length - 1
        ][1];
    const totalEndingWithoutReinvest =
        portfolioHistoryWithoutReinvest[
            portfolioHistoryWithoutReinvest.length - 1
        ][1];
    const totalCashCollected = validSymbols.reduce(
        (sum, s) => sum + results[s].withoutReinvest.dividendsCollected,
        0
    );

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
    finalResult.cashDividends = validSymbols.flatMap(
        (s) => results[s].dividendPayouts
    );

    console.log(
        '[Engine] Step 4: Aggregation complete. Returning final result.'
    );

    return finalResult;
}
