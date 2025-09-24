<!-- src\pages\BacktesterView.vue -->
<script setup>
    import { ref } from 'vue';
    import { useHead } from '@vueuse/head';
    import BacktesterControls from '@/components/backtester/BacktesterControls.vue';
    import BacktesterResults from '@/components/backtester/BacktesterResults.vue';
    import { runBacktest } from '@/services/backtestEngine.js';
    import { useToast } from 'primevue/usetoast';
    import { joinURL } from 'ufo';

    useHead({ title: '백테스팅' });

    const toast = useToast();
    const backtestResult = ref(null);
    const isLoading = ref(false);

    const handleRun = async (options) => {
        isLoading.value = true;
        backtestResult.value = null;

        try {
            const symbolsToFetch = [
                ...options.symbols,
                options.comparisonSymbol,
            ]
                .filter((s) => s && s !== 'None')
                .join(',');
            const toDate = new Date(options.endDate);
            toDate.setDate(toDate.getDate() + 1);

            const apiResponse = await fetch(
                `/api/getBacktestData?symbols=${symbolsToFetch}&from=${options.startDate}&to=${toDate.toISOString().split('T')[0]}`
            );
            if (!apiResponse.ok)
                throw new Error('Failed to fetch historical data from server.');
            const apiData = await apiResponse.json();

            const holidayResponse = await fetch(
                joinURL(import.meta.env.BASE_URL, 'holidays.json')
            );
            const holidays = await holidayResponse.json();

            const result = runBacktest({ ...options, apiData, holidays });
            backtestResult.value = result;
        } catch (error) {
            console.error('Backtest Error:', error);
            toast.add({
                severity: 'error',
                summary: '백테스팅 오류',
                detail: error.message,
                life: 5000,
            });
            backtestResult.value = { error: error.message };
        } finally {
            isLoading.value = false;
        }
    };
</script>

<template>
    <div>
        <Toast />
        <BacktesterControls @run="handleRun" :is-loading="isLoading" />
        <BacktesterResults :result="backtestResult" :is-loading="isLoading" />
    </div>
</template>
