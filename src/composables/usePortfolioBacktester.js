import { ref, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { format as formatDate, addDays, isWeekend, subDays } from 'date-fns';
import Holidays from 'date-holidays';
import { joinURL } from 'ufo';

export function usePortfolioBacktester(
    isLoading,
    backtestResult,
    allAvailableStocks,
    portfolioTree
) {
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

        const selectedStocksData = portfolioTree.value.children
            .find((c) => c.key === 'stocks-hub')
            .children.filter((c) => c.type === 'stock');
        const initialInvestmentUSD =
            options.initialInvestment / options.exchangeRate;
        const commissionRate = options.commission / 100;
        const portfolio = {};
        const cashDividends = [];

        let totalInitialInvestment = 0;
        selectedStocksData.forEach((stockNode) => {
            const { symbol, quantity, avgPrice } = stockNode.data;
            const startData = priceDataMap.get(symbol)?.get(options.startDate);
            if (startData && startData.close > 0) {
                const investment =
                    quantity && avgPrice
                        ? quantity * avgPrice
                        : initialInvestmentUSD / selectedStocksData.length;
                totalInitialInvestment += investment;
                const fees = investment * commissionRate;
                const netInvestment = investment - fees;
                const initialQuantity =
                    quantity && avgPrice
                        ? quantity
                        : netInvestment / startData.close;
                portfolio[symbol] = {
                    quantity: initialQuantity,
                    valueHistory: {},
                    initialInvestment: investment,
                };
            }
        });

        const investmentRatio =
            totalInitialInvestment > 0
                ? initialInvestmentUSD / totalInitialInvestment
                : 1;
        if (Math.abs(1 - investmentRatio) > 0.01) {
            Object.values(portfolio).forEach((stock) => {
                stock.quantity *= investmentRatio;
                stock.initialInvestment *= investmentRatio;
            });
        }

        let spyPortfolio = {
            quantity: 0,
            valueHistory: {},
            initialInvestment: initialInvestmentUSD,
        };
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
            let totalDividendPool = 0;
            for (const stockNode of selectedStocksData) {
                const symbol = stockNode.data.symbol;
                if (!portfolio[symbol]) continue;
                const dividendAmount = dividendDataMap
                    .get(symbol)
                    ?.get(dateStr);
                if (dividendAmount && dividendAmount > 0) {
                    const dividendReceived =
                        portfolio[symbol].quantity * dividendAmount;
                    totalDividendPool += dividendReceived * 0.85;
                }
            }

            if (totalDividendPool > 0) {
                const reinvestmentHub = portfolioTree.value.children.find(
                    (c) => c.key === 'reinvestment-hub'
                );
                reinvestmentHub.children.forEach((rule) => {
                    if (rule.type !== 'reinvest-target' || !rule.data) return;
                    const { targetSymbol, ratio } = rule.data;
                    const dividendPortion = totalDividendPool * (ratio / 100);
                    if (targetSymbol === 'CASH') {
                        cashDividends.push({
                            date: dateStr,
                            ticker: 'Portfolio',
                            amount: dividendPortion,
                        });
                    } else {
                        const reinvestDate = findNextBusinessDays(
                            new Date(dateStr),
                            2
                        );
                        const reinvestDateStr = formatDate(
                            reinvestDate,
                            'yyyy-MM-dd'
                        );
                        const reinvestData = priceDataMap
                            .get(targetSymbol)
                            ?.get(reinvestDateStr);
                        if (reinvestData && reinvestData.open > 0) {
                            const newShares =
                                (dividendPortion -
                                    dividendPortion * commissionRate) /
                                reinvestData.open;
                            if (portfolio[targetSymbol]) {
                                portfolio[targetSymbol].quantity += newShares;
                            } else {
                                portfolio[targetSymbol] = {
                                    quantity: newShares,
                                    valueHistory: {},
                                    initialInvestment: 0,
                                };
                            }
                        }
                    }
                });
                totalDividendPool = 0;
            }

            for (const stockNode of selectedStocksData) {
                const symbol = stockNode.data.symbol;
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
        selectedStocksData.forEach((stockNode, index) => {
            const symbol = stockNode.data.symbol;
            if (!portfolio[symbol]) return;
            const historyValues = labels.map(
                (date) => portfolio[symbol].valueHistory[date]
            );
            datasets.push({
                label: `${symbol} TR (%)`,
                data: historyValues.map((v) =>
                    v && portfolio[symbol].initialInvestment > 0
                        ? (v / portfolio[symbol].initialInvestment - 1) * 100
                        : 0
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
                v && spyPortfolio.initialInvestment > 0
                    ? (v / spyPortfolio.initialInvestment - 1) * 100
                    : 0
            ),
            borderColor: '#9CA3AF',
            borderDash: [5, 5],
            tension: 0.1,
            yAxisID: 'y',
        });

        const lastDate = labels[labels.length - 1];
        const individualSummaries = selectedStocksData
            .map((stockNode) => {
                const symbol = stockNode.data.symbol;
                if (!portfolio[symbol]) return null;
                const finalValue =
                    portfolio[symbol].valueHistory[lastDate] || 0;
                const accumulatedDividends = cashDividends
                    .filter((d) => d.ticker === symbol)
                    .reduce((sum, div) => sum + div.amount, 0);
                const totalAsset = finalValue + accumulatedDividends;
                const returnPercent =
                    portfolio[symbol].initialInvestment > 0
                        ? (totalAsset / portfolio[symbol].initialInvestment -
                              1) *
                          100
                        : 0;
                return {
                    symbol,
                    initialInvestment: portfolio[symbol].initialInvestment,
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
            spyPortfolio.initialInvestment > 0
                ? (finalSpyValue / spyPortfolio.initialInvestment - 1) * 100
                : 0;

        return {
            chartData: { labels, datasets },
            cashDividends,
            summary: {
                individual: individualSummaries,
                total: totalSummary,
                sp500ReturnPercent,
            },
        };
    }

    const runBacktest = async (options, portfolioTreeValue) => {
        isLoading.value = true;
        try {
            const selectedStocksData = portfolioTreeValue.children
                .find((c) => c.key === 'stocks-hub')
                .children.filter((c) => c.type === 'stock');
            const symbols = selectedStocksData.map((s) => s.data.symbol);

            const reinvestmentHub = portfolioTreeValue.children.find(
                (c) => c.key === 'reinvestment-hub'
            );

            // [핵심 수정] 'add-button' 타입을 제외하고, data 속성이 있는 노드만 필터링합니다.
            const reinvestSymbols = reinvestmentHub.children
                .filter((r) => r.type === 'reinvest-target' && r.data) // data 속성 존재 여부 확인 추가
                .map((r) => r.data.targetSymbol)
                .filter((s) => s && s !== 'CASH');

            const symbolsToFetch = [
                ...new Set([...symbols, ...reinvestSymbols, 'SPY']),
            ];

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
                options,
                portfolioTreeValue
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

    const validateAndRun = async (options) => {
        const selectedStocksData = portfolioTree.value.children
            .find((c) => c.key === 'stocks-hub')
            .children.filter((c) => c.type === 'stock' && c.data.symbol);
        if (selectedStocksData.length === 0) {
            toast.add({
                severity: 'info',
                summary: '알림',
                detail: '먼저 종목을 추가하고 선택해주세요.',
                life: 3000,
            });
            return;
        }
        const reinvestmentHub = portfolioTree.value.children.find(
            (c) => c.key === 'reinvestment-hub'
        );
        const totalRatio = reinvestmentHub.children
            .filter((c) => c.type === 'reinvest-target' && c.data)
            .reduce((sum, c) => sum + (c.data.ratio || 0), 0);
        if (totalRatio !== 100) {
            toast.add({
                severity: 'error',
                summary: '재투자 비율 오류',
                detail: `재투자 비율의 합이 100%가 아닙니다. (현재 ${totalRatio}%)`,
                life: 5000,
            });
            return;
        }
        if (!options.startDate || !options.endDate) {
            toast.add({
                severity: 'warn',
                summary: '입력 오류',
                detail: '시작일과 종료일을 모두 선택해주세요.',
                life: 3000,
            });
            return;
        }
        if (new Date(options.startDate) > new Date(options.endDate)) {
            toast.add({
                severity: 'warn',
                summary: '입력 오류',
                detail: '시작일은 종료일보다 이전이어야 합니다.',
                life: 3000,
            });
            return;
        }
        isLoading.value = true;
        backtestResult.value = null;
        const originalStartDate = new Date(options.startDate);
        const adjustedStartDate = findPreviousBusinessDay(originalStartDate);
        const finalOptions = {
            ...options,
            startDate: getFormattedDate(adjustedStartDate),
        };
        if (getFormattedDate(originalStartDate) !== finalOptions.startDate) {
            toast.add({
                severity: 'info',
                summary: '시작일 보정',
                detail: `시작일이 휴일이므로 가장 가까운 영업일인 ${finalOptions.startDate}(으)로 보정하여 계산합니다.`,
                life: 4000,
            });
        }

        await runBacktest(finalOptions, portfolioTree.value);
    };

    return { validateAndRun };
}
