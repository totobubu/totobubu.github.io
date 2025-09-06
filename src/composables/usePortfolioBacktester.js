import { ref, reactive, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { format as formatDate, addDays, isWeekend, subDays } from 'date-fns';
import Holidays from 'date-holidays';
import { joinURL } from 'ufo';

// 헬퍼 함수들은 컴포저블 내부에 두거나, 별도의 utils 파일로 옮겨도 좋습니다.
const hd = new Holidays('US');
const CHART_COLORS = ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#EC407A'];
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
    const holiday = hd.isHoliday(date);
    return !!holiday;
}
function findPreviousBusinessDay(startDate) {
    let currentDate = new Date(startDate);
    while (isWeekend(currentDate) || isHoliday(currentDate)) {
        currentDate = subDays(currentDate, 1);
    }
    return currentDate;
}

export function usePortfolioBacktester() {
    const toast = useToast();

    const allAvailableStocks = ref([]);
    const selectedSymbols = ref([]);
    const backtestResult = ref(null);
    const isLoading = ref(false);
    const dialog = reactive({
        visible: false,
        message: '',
        options: [],
        onConfirm: null,
    });

    onMounted(async () => {
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const response = await fetch(url);
        const allStockData = (await response.json()).nav;
        allAvailableStocks.value = allStockData
            .filter((stock) => !stock.upcoming)
            .map((stock) => ({
                symbol: stock.symbol,
                longName: `${stock.symbol} - ${stock.company || '개별 주식'}`,
                ipoDate: stock.ipoDate,
            }))
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    });

    const calculateBacktest = (
        priceDataResults,
        dividendDataResults,
        options
    ) => {
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
                    investmentPerStock > 0
                        ? (totalAsset / investmentPerStock - 1) * 100
                        : 0;
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
    };

    const runBacktest = async (options, symbols) => {
        isLoading.value = true;
        try {
            const symbolsToFetch = [...symbols, 'SPY'];
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
                detail:
                    '필요한 데이터 파일을 찾을 수 없습니다. 데이터를 먼저 업데이트해주세요. (' +
                    error.message +
                    ')',
                life: 6000,
            });
        } finally {
            isLoading.value = false;
        }
    };

    const validateAndRun = async (options) => {
        const symbols = selectedSymbols.value;
        if (symbols.length === 0) {
            toast.add({
                severity: 'info',
                summary: '알림',
                detail: '먼저 종목을 선택해주세요.',
                life: 3000,
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
        const originalStartDate = new Date(options.startDate + 'T00:00:00');
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
        try {
            const stocksWithOptions = allAvailableStocks.value.filter((s) =>
                symbols.includes(s.symbol)
            );
            const problematicStocks = stocksWithOptions.filter(
                (stock) =>
                    !stock.ipoDate ||
                    new Date(stock.ipoDate) > new Date(finalOptions.startDate)
            );
            if (problematicStocks.length > 0) {
                isLoading.value = false;
                const info = problematicStocks
                    .map((s) => `${s.symbol} (상장일: ${s.ipoDate})`)
                    .join(', ');
                dialog.message = `선택한 종목 중 일부(${info})가 시작일 이후에 상장되었습니다. 어떻게 진행할까요?`;
                dialog.options = [
                    { label: '문제 종목 모두 제외하고 계산', value: 'exclude' },
                    {
                        label: '가장 늦은 상장일 기준으로 계산',
                        value: 'adjust',
                    },
                ];
                dialog.onConfirm = (choice) => {
                    let symbolsToRun = [...symbols];
                    let confirmedOptions = { ...finalOptions };
                    if (choice === 'exclude') {
                        const excludeSymbols = problematicStocks.map(
                            (s) => s.symbol
                        );
                        symbolsToRun = symbols.filter(
                            (s) => !excludeSymbols.includes(s)
                        );
                        selectedSymbols.value = selectedSymbols.value.filter(
                            (symbol) => !excludeSymbols.includes(symbol)
                        );
                    } else if (choice === 'adjust') {
                        const latestStartDate = problematicStocks.reduce(
                            (latest, stock) =>
                                new Date(stock.ipoDate) > latest
                                    ? new Date(stock.ipoDate)
                                    : latest,
                            new Date(0)
                        );
                        confirmedOptions.startDate =
                            getFormattedDate(latestStartDate);
                        symbolsToRun = symbols;
                    }
                    if (symbolsToRun.length > 0) {
                        runBacktest(confirmedOptions, symbolsToRun);
                    } else {
                        toast.add({
                            severity: 'info',
                            summary: '알림',
                            detail: '계산할 종목이 남아있지 않습니다.',
                            life: 3000,
                        });
                    }
                };
                dialog.visible = true;
                return;
            }
            await runBacktest(finalOptions, symbols);
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '데이터 검증 중 문제가 발생했습니다.',
                life: 4000,
            });
            isLoading.value = false;
        }
    };

    // 컴포넌트에서 사용할 상태와 함수들을 반환
    return {
        allAvailableStocks,
        selectedSymbols,
        backtestResult,
        isLoading,
        dialog,
        validateAndRun,
    };
}
