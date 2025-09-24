<script setup>
    import { ref } from 'vue';
    import { useHead } from '@vueuse/head';
    import BacktesterControls from '@/components/backtester/BacktesterControls.vue';
    import BacktesterResults from '@/components/backtester/BacktesterResults.vue';
    import { runBacktest } from '@/services/backtestEngine.js';
    import { useToast } from 'primevue/usetoast';
    import { joinURL } from 'ufo';
    import Toast from 'primevue/toast';
    import Message from 'primevue/message';

    useHead({ title: '백테스팅' });

    const toast = useToast();
    const backtestResult = ref(null);
    const isLoading = ref(false);
    const adjustedDateMessage = ref('');

    const handleRun = async (options) => {
        isLoading.value = true;
        backtestResult.value = null;
        adjustedDateMessage.value = '';

        try {
            if (!options.symbols || options.symbols.length === 0) {
                throw new Error('백테스팅할 종목을 입력해주세요.');
            }
            if (!options.startDate || !options.endDate) {
                throw new Error('시작일과 종료일을 모두 선택해주세요.');
            }

            const symbolsToFetch = [
                ...options.symbols,
                options.comparisonSymbol,
            ].filter((s) => s && s !== 'None');

            const startDateObj = new Date(options.startDate);
            const endDateObj = new Date(options.endDate);

            if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                throw new Error('유효하지 않은 날짜 형식입니다.');
            }

            endDateObj.setDate(endDateObj.getDate() + 1);
            const fromDateStr = startDateObj.toISOString().split('T')[0];
            const toDateStr = endDateObj.toISOString().split('T')[0];

            const apiPromises = symbolsToFetch.map((symbol) =>
                fetch(
                    `/api/getBacktestData?symbols=${symbol}&from=${fromDateStr}&to=${toDateStr}`
                ).then(async (res) => {
                    if (!res.ok) {
                        const errorBody = await res.text();
                        throw new Error(
                            `[${symbol}] API 요청 실패 (${res.status}): ${errorBody}`
                        );
                    }
                    return res.json();
                })
            );

            const resultsArray = await Promise.all(apiPromises);

            const combinedTickerData = resultsArray.flatMap(
                (result) => result.tickerData
            );
            const exchangeRatesData =
                resultsArray.find(
                    (result) =>
                        result.exchangeRates && result.exchangeRates.length > 0
                )?.exchangeRates || [];

            const apiData = {
                tickerData: combinedTickerData,
                exchangeRates: exchangeRatesData,
            };

            console.log('--- API Response Data (Combined) ---', apiData);

            let effectiveStartDate = options.startDate;
            const ipoDates = apiData.tickerData
                .map((d) => d.firstTradeDate)
                .filter(Boolean)
                .map((dateStr) => new Date(dateStr));

            if (ipoDates.length > 0) {
                const latestIpoDate = new Date(Math.max.apply(null, ipoDates));
                const userStartDate = new Date(options.startDate);

                if (userStartDate < latestIpoDate) {
                    effectiveStartDate = latestIpoDate
                        .toISOString()
                        .split('T')[0];
                    adjustedDateMessage.value = `시작일이 ${effectiveStartDate}로 자동 조정되었습니다. (선택한 모든 종목이 거래 가능한 가장 빠른 날짜)`;
                }
            }

            const holidayResponse = await fetch(
                joinURL(import.meta.env.BASE_URL, 'holidays.json')
            );
            const holidays = await holidayResponse.json();

            const result = runBacktest({
                ...options,
                startDate: effectiveStartDate,
                apiData,
                holidays,
            });

            console.log('--- Final Result from Backtest Engine ---', result);
            backtestResult.value = result;
        } catch (error) {
            console.error('⛔️ Backtest Run Failed:', error);
            toast.add({
                severity: 'error',
                summary: '백테스팅 오류',
                detail: error.message,
                life: 5000,
            });
            backtestResult.value = { error: error.message };
        } finally {
            isLoading.value = false;
            console.log(
                '--- Backtest process finished (isLoading set to false) ---'
            );
        }
    };
</script>

<template>
    <div>
        <Toast />
        <BacktesterControls @run="handleRun" :is-loading="isLoading" />
        <Message
            v-if="adjustedDateMessage"
            severity="info"
            :closable="false"
            class="mt-4">
            {{ adjustedDateMessage }}
        </Message>
        <BacktesterResults :result="backtestResult" :is-loading="isLoading" />
    </div>
</template>
