<!-- src\components\mypage\PortfolioBacktester.vue -->
<script setup>
    import { ref } from 'vue';
    import { useToast } from 'primevue/usetoast';
    import BacktesterControls from './BacktesterControls.vue';
    import BacktesterChart from './BacktesterChart.vue';

    const toast = useToast();
    const selectedSymbols = ref([]);
    const backtestResult = ref(null);
    const isLoading = ref(false);

    function getFormattedDate(date) {
        if (!(date instanceof Date) || isNaN(date)) return null;
        return date.toISOString().split('T')[0];
    }

    function calculateBacktest(historicalData, options) {
        const {
            initialInvestment,
            commission,
            reinvestDividends,
            selectedSymbols: symbols,
            endDate: end,
        } = options;
        let startDate = new Date(options.startDate);
        const endDate = new Date(end);

        const portfolio = {};
        const spyPortfolio = { shares: 0, cash: 0, lastPrice: 0 };
        const timeline = [];
        const cashDividends = [];
        const exchangeRate = 1350;

        const initialUsd = initialInvestment / exchangeRate;
        const investmentPerStock =
            symbols.length > 0 ? initialUsd / symbols.length : 0;
        const commissionRate = commission / 100;

        const dataMap = new Map();
        historicalData.forEach((result) => {
            if (result && !result.error && result.length > 0) {
                const symbol = result[0].symbol;
                if (symbol) {
                    const dailyMap = new Map(
                        result.map((d) => [getFormattedDate(d.date), d])
                    );
                    dataMap.set(symbol, dailyMap);
                }
            }
        });

        let firstDayData;
        let attempts = 0;
        let firstValidDateStr = null;

        while (attempts < 7 && !firstValidDateStr) {
            const dateStr = getFormattedDate(startDate);
            let allSymbolsHaveData = true;
            for (const symbol of [...symbols, 'SPY']) {
                const symbolData = dataMap.get(symbol);
                if (!symbolData || !symbolData.has(dateStr)) {
                    allSymbolsHaveData = false;
                    break;
                }
            }
            if (allSymbolsHaveData) {
                firstValidDateStr = dateStr;
            } else {
                startDate.setDate(startDate.getDate() + 1);
                attempts++;
            }
        }

        if (!firstValidDateStr) {
            toast.add({
                severity: 'error',
                summary: '데이터 오류',
                detail: '선택하신 시작일 주변에 모든 종목의 데이터가 유효하지 않습니다.',
                life: 4000,
            });
            return null;
        }

        symbols.forEach((symbol) => {
            const dayData = dataMap.get(symbol)?.get(firstValidDateStr);
            if (dayData && dayData.open > 0) {
                const investmentAfterCommission =
                    investmentPerStock * (1 - commissionRate);
                portfolio[symbol] = {
                    shares: investmentAfterCommission / dayData.open,
                    cash: 0,
                    lastPrice: dayData.open,
                };
            } else {
                portfolio[symbol] = { shares: 0, cash: 0, lastPrice: 0 };
            }
        });

        const spyFirstDayData = dataMap.get('SPY')?.get(firstValidDateStr);
        if (spyFirstDayData && spyFirstDayData.open > 0) {
            const investmentAfterCommission = initialUsd * (1 - commissionRate);
            spyPortfolio.shares =
                investmentAfterCommission / spyFirstDayData.open;
            spyPortfolio.lastPrice = spyFirstDayData.open;
        }

        for (
            let d = new Date(startDate);
            d <= endDate;
            d.setDate(d.getDate() + 1)
        ) {
            const dateStr = getFormattedDate(d);
            let totalPortfolioValue = 0;

            symbols.forEach((symbol) => {
                const dayData = dataMap.get(symbol)?.get(dateStr);
                const currentPrice = dayData
                    ? dayData.close
                    : portfolio[symbol].lastPrice;

                totalPortfolioValue += portfolio[symbol].shares * currentPrice;
                portfolio[symbol].lastPrice = currentPrice;

                if (dayData && dayData.dividends > 0) {
                    const dividendReceived =
                        portfolio[symbol].shares * dayData.dividends;
                    const afterTaxDividend = dividendReceived * 0.85;

                    if (reinvestDividends) {
                        let reinvestmentDate = new Date(d);
                        let businessDays = 0;
                        while (businessDays < 2 && reinvestmentDate < endDate) {
                            reinvestmentDate.setDate(
                                reinvestmentDate.getDate() + 1
                            );
                            if (
                                reinvestmentDate.getDay() !== 0 &&
                                reinvestmentDate.getDay() !== 6
                            )
                                businessDays++;
                        }
                        const reinvestDateStr =
                            getFormattedDate(reinvestmentDate);
                        const reinvestData = dataMap
                            .get(symbol)
                            ?.get(reinvestDateStr);

                        if (reinvestData && reinvestData.open > 0) {
                            const investmentAfterCommission =
                                afterTaxDividend * (1 - commissionRate);
                            const newShares =
                                investmentAfterCommission / reinvestData.open;
                            portfolio[symbol].shares += newShares;
                        }
                    } else {
                        cashDividends.push({
                            date: dateStr,
                            amount: afterTaxDividend,
                            ticker: symbol,
                        });
                    }
                }
            });

            const spyDayData = dataMap.get('SPY')?.get(dateStr);
            const currentSpyPrice = spyDayData
                ? spyDayData.close
                : spyPortfolio.lastPrice;
            const spyValue = spyPortfolio.shares * currentSpyPrice;
            spyPortfolio.lastPrice = currentSpyPrice;

            timeline.push({
                date: dateStr,
                portfolio: totalPortfolioValue,
                spy: spyValue,
            });
        }

        const labels = timeline.map((t) => t.date);
        const portfolioData = timeline.map(
            (t) => (t.portfolio / initialUsd - 1) * 100
        );
        const spyData = timeline.map((t) => (t.spy / initialUsd - 1) * 100);

        return {
            chartData: {
                labels,
                datasets: [
                    {
                        label: '내 포트폴리오 TR (%)',
                        data: portfolioData,
                        borderColor: '#42A5F5',
                        tension: 0.1,
                        fill: false,
                        pointRadius: 0,
                    },
                    {
                        label: 'S&P 500 TR (%)',
                        data: spyData,
                        borderColor: '#FFA726',
                        tension: 0.1,
                        fill: false,
                        pointRadius: 0,
                    },
                ],
            },
            cashDividends: reinvestDividends ? null : cashDividends,
        };
    }

    const handleSelectionChange = (selectedItems) => {
        let newSelection = [...selectedItems];
        if (newSelection.length > 4) {
            toast.add({
                severity: 'warn',
                summary: '선택 제한',
                detail: '최대 4개의 종목만 선택할 수 있습니다.',
                life: 3000,
            });
            newSelection = selectedItems.slice(0, 4);
        }
        selectedSymbols.value = newSelection.map((item) => item.symbol);
    };

    const runBacktest = async (options) => {
        if (selectedSymbols.value.length === 0) {
            toast.add({
                severity: 'info',
                summary: '알림',
                detail: '먼저 종목을 선택해주세요.',
                life: 3000,
            });
            return;
        }

        isLoading.value = true;
        backtestResult.value = null;

        try {
            const symbolsToFetch = [...selectedSymbols.value, 'SPY'];
            const from = options.startDate;
            const to = new Date().toISOString().split('T')[0];

            const response = await fetch(
                `/api/getHistoricalData?symbols=${symbolsToFetch.join(',')}&from=${from}&to=${to}`
            );

            if (!response.ok) {
                let errorMessage = `과거 데이터를 불러오는 데 실패했습니다. (HTTP ${response.status})`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) errorMessage = errorData.error;
                } catch (e) {
                    errorMessage = `${errorMessage}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const historicalData = await response.json();

            const result = calculateBacktest(historicalData, {
                ...options,
                selectedSymbols: selectedSymbols.value,
                endDate: to,
            });

            if (result) {
                backtestResult.value = result;
            }
        } catch (error) {
            console.error('백테스팅 오류:', error);
            toast.add({
                severity: 'error',
                summary: '백테스팅 오류',
                detail: error.message,
                life: 5000,
            });
        } finally {
            isLoading.value = false;
        }
    };

    defineExpose({
        handleSelectionChange,
    });
</script>

<template>
    <div class="portfolio-backtester my-4">
        <BacktesterControls
            :selected-count="selectedSymbols.length"
            @run="runBacktest" />
        <div class="mt-4">
            <BacktesterChart :result="backtestResult" :is-loading="isLoading" />
        </div>
    </div>
</template>
