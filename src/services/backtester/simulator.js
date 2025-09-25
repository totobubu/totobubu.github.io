import { addBusinessDays } from './utils.js';

export function runSimulation(options) {
    const {
        symbol,
        effectiveStartDateStr,
        endDate,
        investmentPerTicker,
        commissionRate,
        taxRate,
        priceMap,
        dividendMap,
        holidays,
    } = options;
    console.log(
        `[Simulator] Starting simulation for ${symbol} from ${effectiveStartDateStr}`
    );

    const startPriceData = priceMap.get(effectiveStartDateStr);
    if (!startPriceData || !startPriceData.close) {
        throw new Error(
            `[${symbol}] 시작일(${effectiveStartDateStr})의 주가 정보가 없습니다.`
        );
    }

    const startPrice = startPriceData.close;
    let sharesWithReinvest =
        (investmentPerTicker * (1 - commissionRate)) / startPrice;
    let sharesWithoutReinvest = sharesWithReinvest;
    const initialShares = sharesWithoutReinvest;

    let currentDate = new Date(`${effectiveStartDateStr}T12:00:00Z`);
    const finalDate = new Date(`${endDate}T12:00:00Z`);
    const historyWithReinvest = [],
        historyWithoutReinvest = [],
        dividendPayouts = [];

    while (currentDate.getTime() <= finalDate.getTime()) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const currentPriceData = priceMap.get(dateStr);

        if (currentPriceData) {
            if (dividendMap.has(dateStr)) {
                const dividendAmount = dividendMap.get(dateStr);
                const dividendForCash = sharesWithoutReinvest * dividendAmount;
                dividendPayouts.push({
                    date: dateStr,
                    amount: dividendForCash * taxRate,
                    preTaxAmount: dividendForCash,
                    shares: sharesWithoutReinvest,
                    perShare: dividendAmount,
                    ticker: symbol,
                });
                const dividendForReinvest =
                    sharesWithReinvest * dividendAmount * taxRate;
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
                        (dividendForReinvest * (1 - commissionRate)) /
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
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    if (historyWithReinvest.length === 0) {
        throw new Error(`[${symbol}] 선택된 기간에 유효한 데이터가 없습니다.`);
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

    console.log(
        `[Simulator] Finished simulation for ${symbol}. Generated ${historyWithReinvest.length} records.`
    );
    return {
        initialShares,
        historyWithReinvest,
        historyWithoutReinvest,
        historyCash,
        dividendPayouts,
        endPrice,
        finalCashCollected: cashCollected,
    };
}
