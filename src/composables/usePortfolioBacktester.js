// src\composables\usePortfolioBacktester.js
import { ref, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { format as formatDate, addDays, isWeekend, subDays } from 'date-fns';
import Holidays from 'date-holidays';
import { joinURL } from 'ufo';

export function usePortfolioBacktester(isLoading, backtestResult) {
    const toast = useToast();
    const hd = new Holidays('US');
    const dialog = reactive({
        visible: false,
        message: '',
        options: [],
        onConfirm: null,
    });

    const CHART_COLORS = [
        '#42A5F5',
        '#66BB6A',
        '#FFA726',
        '#AB47BC',
        '#EC407A',
    ];
    function getColor(index) {
        return CHART_COLORS[index % CHART_COLORS.length];
    }
    function getFormattedDate(date) {
        if (!(date instanceof Date) || isNaN(date)) return null;
        return formatDate(date, 'yyyy-MM-dd');
    }
    function findNextBusinessDays(startDate, daysToAdd) {
        let currentDate = new Date(startDate);
        let addedDays = 0;
        while (addedDays < daysToAdd) {
            currentDate = addDays(currentDate, 1);
            if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
                addedDays++;
            }
        }
        return currentDate;
    }
    function isHoliday(date) {
        return !!hd.isHoliday(date);
    }
    function findPreviousBusinessDay(startDate) {
        let currentDate = new Date(startDate);
        while (isWeekend(currentDate) || isHoliday(currentDate)) {
            currentDate = subDays(currentDate, 1);
        }
        return currentDate;
    }

    function calculateBacktest(priceDataResults, dividendDataResults, options) {
        const priceDataMap = new Map();
        priceDataResults.forEach((item) => {
            if (item.symbol && Array.isArray(item.data)) {
                const dateMappedPrices = new Map(
                    item.data.map((d) => [
                        formatDate(new Date(d.date), 'yyyy-MM-dd'),
                        d,
                    ])
                );
                priceDataMap.set(item.symbol, dateMappedPrices);
            }
        });
        const dividendDataMap = new Map();
        dividendDataResults.forEach((item) => {
            if (item.symbol && Array.isArray(item.data)) {
                const dateMappedDividends = new Map(
                    item.data.map((d) => [
                        formatDate(new Date(d.date), 'yyyy-MM-dd'),
                        d.amount,
                    ])
                );
                dividendDataMap.set(item.symbol, dateMappedDividends);
            }
        });
        if (priceDataMap.size === 0) {
            toast.add({
                severity: 'error',
                summary: '데이터 오류',
                detail: '백테스팅에 사용할 유효한 과거 데이터가 없습니다.',
                life: 4000,
            });
            return null;
        }
        const initialInvestmentUSD =
            options.initialInvestment / options.exchangeRate;
        const investmentPerStock =
            initialInvestmentUSD / options.selectedSymbols.length;
        const commissionRate = options.commission / 100;
        const portfolio = {};
        const cashDividends = [];
        options.selectedSymbols.forEach((symbol) => {
            const startData = priceDataMap.get(symbol)?.get(options.startDate);
            if (startData && startData.close > 0) {
                const fees = investmentPerStock * commissionRate;
                const netInvestment = investmentPerStock - fees;
                const quantity = netInvestment / startData.close;
                portfolio[symbol] = { quantity, valueHistory: {} };
            }
        });
        let spyPortfolio = { quantity: 0, valueHistory: {} };
        const spyStartData = priceDataMap.get('SPY')?.get(options.startDate);
        if (spyStartData && spyStartData.close > 0) {
            const fees = initialInvestmentUSD * commissionRate;
            spyPortfolio.quantity =
                (initialInvestmentUSD - fees) / spyStartData.close;
        }
        const allDates = [];
        let currentDate = new Date(options.startDate + 'T00:00:00');
        const endDate = new Date(options.endDate + 'T00:00:00');
        while (currentDate <= endDate) {
            allDates.push(formatDate(currentDate, 'yyyy-MM-dd'));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        allDates.forEach((dateStr) => {
            for (const symbol of options.selectedSymbols) {
                if (!portfolio[symbol]) continue;
                const dayPriceData = priceDataMap.get(symbol)?.get(dateStr);
                if (dayPriceData && dayPriceData.close) {
                    portfolio[symbol].valueHistory[dateStr] =
                        portfolio[symbol].quantity * dayPriceData.close;
                } else {
                    const yesterday = formatDate(
                        addDays(new Date(dateStr), -1),
                        'yyyy-MM-dd'
                    );
                    portfolio[symbol].valueHistory[dateStr] =
                        portfolio[symbol].valueHistory[yesterday];
                }
                const dividendAmount = dividendDataMap
                    .get(symbol)
                    ?.get(dateStr);
                if (dividendAmount && dividendAmount > 0) {
                    const dividendReceived =
                        portfolio[symbol].quantity * dividendAmount;
                    const afterTaxDividend = dividendReceived * 0.85;
                    if (options.reinvestDividends) {
                        const reinvestDate = findNextBusinessDays(
                            new Date(dateStr),
                            2
                        );
                        const reinvestDateStr = formatDate(
                            reinvestDate,
                            'yyyy-MM-dd'
                        );
                        const reinvestData = priceDataMap
                            .get(symbol)
                            ?.get(reinvestDateStr);
                        if (reinvestData && reinvestData.open > 0) {
                            const newShares =
                                (afterTaxDividend -
                                    afterTaxDividend * commissionRate) /
                                reinvestData.open;
                            portfolio[symbol].quantity += newShares;
                        }
                    } else {
                        cashDividends.push({
                            date: dateStr,
                            ticker: symbol,
                            amount: afterTaxDividend,
                        });
                    }
                }
            }
            const spyDayData = priceDataMap.get('SPY')?.get(dateStr);
            if (spyDayData && spyDayData.close) {
                spyPortfolio.valueHistory[dateStr] =
                    spyPortfolio.quantity * spyDayData.close;
            } else {
                const yesterday = formatDate(
                    addDays(new Date(dateStr), -1),
                    'yyyy-MM-dd'
                );
                spyPortfolio.valueHistory[dateStr] =
                    spyPortfolio.valueHistory[yesterday];
            }
            const spyDividendAmount = dividendDataMap.get('SPY')?.get(dateStr);
            if (spyDividendAmount && spyDividendAmount > 0) {
                const dividendReceived =
                    spyPortfolio.quantity * spyDividendAmount;
                const afterTaxDividend = dividendReceived * 0.85;
                const reinvestDate = findNextBusinessDays(new Date(dateStr), 2);
                const reinvestDateStr = formatDate(reinvestDate, 'yyyy-MM-dd');
                const reinvestData = priceDataMap
                    .get('SPY')
                    ?.get(reinvestDateStr);
                if (reinvestData && reinvestData.open > 0) {
                    const newShares =
                        (afterTaxDividend - afterTaxDividend * commissionRate) /
                        reinvestData.open;
                    spyPortfolio.quantity += newShares;
                }
            }
        });
        const labels = allDates;
        const datasets = [];
        options.selectedSymbols.forEach((symbol, index) => {
            if (!portfolio[symbol]) return;
            const historyValues = labels.map(
                (date) => portfolio[symbol].valueHistory[date]
            );
            datasets.push({
                label: `${symbol} TR (%)`,
                data: historyValues.map((v) =>
                    v ? (v / investmentPerStock - 1) * 100 : null
                ),
                borderColor: getColor(index),
                tension: 0.1,
                yAxisID: 'y',
            });
        });
        const spyHistoryValues = labels.map(
            (date) => spyPortfolio.valueHistory[date]
        );
        datasets.push({
            label: 'S&P 500 TR (%)',
            data: spyHistoryValues.map((v) =>
                v ? (v / initialInvestmentUSD - 1) * 100 : null
            ),
            borderColor: '#9CA3AF',
            borderDash: [5, 5],
            tension: 0.1,
            yAxisID: 'y',
        });
        const lastDate = labels[labels.length - 1];
        const individualSummaries = options.selectedSymbols
            .map((symbol) => {
                if (!portfolio[symbol]) return null;
                const finalValue =
                    portfolio[symbol].valueHistory[lastDate] || 0;
                const accumulatedDividends = options.reinvestDividends
                    ? 0
                    : cashDividends
                          .filter((d) => d.ticker === symbol)
                          .reduce((sum, div) => sum + div.amount, 0);
                const totalAsset = finalValue + accumulatedDividends;
                const returnPercent =
                    (totalAsset / investmentPerStock - 1) * 100;
                return {
                    symbol,
                    initialInvestment: investmentPerStock,
                    finalValue,
                    dividends: accumulatedDividends,
                    totalAsset,
                    returnPercent,
                };
            })
            .filter(Boolean);
        const totalSummary = individualSummaries.reduce(
            (acc, curr) => {
                acc.initialInvestment += curr.initialInvestment;
                acc.finalValue += curr.finalValue;
                acc.dividends += curr.dividends;
                acc.totalAsset += curr.totalAsset;
                return acc;
            },
            {
                symbol: '합계',
                initialInvestment: 0,
                finalValue: 0,
                dividends: 0,
                totalAsset: 0,
            }
        );
        totalSummary.returnPercent =
            totalSummary.initialInvestment > 0
                ? (totalSummary.totalAsset / totalSummary.initialInvestment -
                      1) *
                  100
                : 0;
        const finalSpyValue = spyPortfolio.valueHistory[lastDate] || 0;
        const sp500ReturnPercent =
            initialInvestmentUSD > 0
                ? (finalSpyValue / initialInvestmentUSD - 1) * 100
                : 0;
        return {
            chartData: { labels, datasets },
            cashDividends: options.reinvestDividends ? null : cashDividends,
            summary: {
                individual: individualSummaries,
                total: totalSummary,
                sp500ReturnPercent,
            },
        };
    }

    const runBacktest = async (options, symbols) => {
        isLoading.value = true;
        try {
            const symbolsToFetch = [...new Set([...symbols, 'SPY'])];
            const fetchData = async (folder, symbol) => {
                const url = joinURL(
                    import.meta.env.BASE_URL,
                    folder,
                    `${symbol.toLowerCase()}.json`
                );
                const response = await fetch(url);
                if (!response.ok)
                    throw new Error(`${symbol} ${folder} data not found`);
                return { symbol, data: await response.json() };
            };
            const priceDataPromises = symbolsToFetch.map((symbol) =>
                fetchData('historical', symbol)
            );
            const dividendDataPromises = symbolsToFetch.map((symbol) =>
                fetchData('dividends', symbol)
            );
            const [priceDataResults, dividendDataResults] = await Promise.all([
                Promise.all(priceDataPromises),
                Promise.all(dividendDataPromises),
            ]);
            const result = calculateBacktest(
                priceDataResults,
                dividendDataResults,
                { ...options, selectedSymbols: symbols }
            );
            if (result) backtestResult.value = result;
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '백테스팅 오류',
                detail: `데이터 파일 처리 중 오류가 발생했습니다: ${error.message}`,
                life: 6000,
            });
        } finally {
            isLoading.value = false;
        }
    };

    // 이 함수는 PortfolioBacktester.vue에서 직접 사용되므로 그대로 둡니다.
    const validateAndRun = async (config) => {
        // ...
    };

    return { validateAndRun, dialog };
}
