<!-- src\components\mypage\PortfolioBacktester.vue -->
<script setup>
    import { ref, reactive } from 'vue';
    import { useToast } from 'primevue/usetoast';
    import Toast from 'primevue/toast';
    import { format as formatDate } from 'date-fns';
    import Holidays from 'date-holidays';
    import BacktesterControls from './BacktesterControls.vue';
    import BacktesterChart from './BacktesterChart.vue';
    import BookmarkManager from './BookmarkManager.vue';
    import Dialog from 'primevue/dialog';
    import Button from 'primevue/button';

    const toast = useToast();
    const hd = new Holidays('US');

    const selectedStocks = ref([]);
    const backtestResult = ref(null);
    const isLoading = ref(false);
    const dialog = reactive({
        visible: false,
        message: '',
        options: [],
        onConfirm: null,
    });

    function getFormattedDate(date) {
        if (!(date instanceof Date) || isNaN(date)) return null;
        return formatDate(date, 'yyyy-MM-dd');
    }

    function findNextBusinessDays(startDate, daysToAdd) {
        let currentDate = new Date(startDate);
        let addedDays = 0;
        while (addedDays < daysToAdd) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
                addedDays++;
            }
        }
        return currentDate;
    }

    function isHoliday(date) {
        return hd.isHoliday(date);
    }

    function calculateBacktest(historicalData, options) {
        // 여기에 실제 백테스팅 계산 로직이 들어갑니다.
        // 임시로 더미 데이터를 반환합니다.
        console.log('Calculating backtest with:', historicalData, options);
        return {
            chartData: {
                labels: ['2023-01-01', '2024-01-01'],
                datasets: [
                    { label: 'My Portfolio', data: [10000, 12000] },
                    { label: 'S&P 500', data: [10000, 11500] },
                ],
            },
            cashDividends: [
                { date: '2023-06-15', amount: 50.25, ticker: 'TSLY' },
            ],
        };
    }

    const handleSelectionChange = (selection) => {
        if (selection.length > 5) {
            const limitedSelection = selection.slice(0, 5);
            selectedStocks.value = limitedSelection;
            toast.add({
                severity: 'warn',
                summary: '선택 제한',
                detail: '최대 5개의 종목만 선택할 수 있습니다.',
                life: 3000,
            });
        } else {
            selectedStocks.value = selection;
        }
    };

    async function validateAndRun(options) {
        const symbols = selectedStocks.value.map((s) => s.symbol);
        if (symbols.length === 0) {
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
            const firstTradeDatePromises = symbols.map((symbol) =>
                fetch(`/api/getFirstTradeDate?symbol=${symbol}`).then((res) =>
                    res.json()
                )
            );
            const firstTradeDates = await Promise.all(firstTradeDatePromises);

            const stocksBeforeStartDate = firstTradeDates.filter(
                (stock) =>
                    stock.firstTradeDate &&
                    new Date(stock.firstTradeDate) > new Date(options.startDate)
            );

            if (stocksBeforeStartDate.length > 0) {
                isLoading.value = false;
                const stockInfo = stocksBeforeStartDate
                    .map((s) => `${s.symbol} (상장일: ${s.firstTradeDate})`)
                    .join(', ');
                dialog.message = `선택한 종목 중 일부(${stockInfo})가 시작일 이후에 상장되었습니다. 어떻게 진행할까요?`;
                dialog.options = [
                    { label: '해당 종목 제외하고 계산', value: 'exclude' },
                    {
                        label: '가장 늦은 상장일 기준으로 계산',
                        value: 'adjust',
                    },
                ];
                dialog.onConfirm = (choice) => {
                    const newOptions = { ...options };
                    let symbolsToRun = [...symbols];
                    if (choice === 'exclude') {
                        const excludeSymbols = stocksBeforeStartDate.map(
                            (s) => s.symbol
                        );
                        symbolsToRun = symbols.filter(
                            (s) => !excludeSymbols.includes(s)
                        );
                    } else if (choice === 'adjust') {
                        const latestStartDate = stocksBeforeStartDate.reduce(
                            (latest, stock) => {
                                return new Date(stock.firstTradeDate) > latest
                                    ? new Date(stock.firstTradeDate)
                                    : latest;
                            },
                            new Date(0)
                        );
                        newOptions.startDate =
                            getFormattedDate(latestStartDate);
                    }
                    runBacktest(newOptions, symbolsToRun);
                };
                dialog.visible = true;
                return;
            }

            await runBacktest(options, symbols);
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '상장일 조회 오류',
                detail: error.message,
                life: 4000,
            });
            isLoading.value = false;
        }
    }

    const runBacktest = async (options, symbols) => {
        isLoading.value = true;
        try {
            const symbolsToFetch = [...symbols, 'SPY'];
            const response = await fetch(
                `/api/getHistoricalData?symbols=${symbolsToFetch.join(',')}&from=${options.startDate}&to=${options.endDate}`
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
                selectedSymbols: symbols,
            });
            if (result) backtestResult.value = result;
        } catch (error) {
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
</script>

<template>
    <div class="portfolio-backtester">
        <Toast />
        <BacktesterControls @run="validateAndRun" />
        <div class="mt-4">
            <BookmarkManager
                @selection-change="handleSelectionChange"
                :pre-selected="selectedStocks" />
        </div>
        <div class="mt-4">
            <BacktesterChart :result="backtestResult" :is-loading="isLoading" />
        </div>
        <Dialog
            v-model:visible="dialog.visible"
            modal
            header="백테스팅 시작일 확인"
            :style="{ width: '30rem' }">
            <p>{{ dialog.message }}</p>
            <div class="flex justify-content-end gap-2 mt-4">
                <Button
                    v-for="option in dialog.options"
                    :key="option.value"
                    :label="option.label"
                    @click="
                        dialog.onConfirm(option.value);
                        dialog.visible = false;
                    "></Button>
            </div>
        </Dialog>
    </div>
</template>
