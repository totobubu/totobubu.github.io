<!-- src\pages\BacktesterView.vue -->
<script setup>
    import { ref } from 'vue';
    import { useHead } from '@vueuse/head';
    import BacktesterControls from '@/components/backtester/BacktesterControls.vue';
    import BacktesterResults from '@/components/backtester/BacktesterResults.vue';
    import { runBacktest } from '@/services/backtester/engine.js';
    import { useToast } from 'primevue/usetoast';
    import { joinURL } from 'ufo';
    import Toast from 'primevue/toast';
    import Message from 'primevue/message';
    import { useBacktestData } from '@/composables/useBacktestData.js';

    useHead({ title: '백테스팅' });

    const toast = useToast();
    const { fetchDataForBacktest, adjustedDateMessage } = useBacktestData();
    const backtestResult = ref(null);
    const isLoading = ref(false);

    const handleRun = async (options) => {
        isLoading.value = true;
        backtestResult.value = null;

        try {
            const { effectiveStartDate, apiData, holidays } =
                await fetchDataForBacktest(
                    options.portfolio,
                    options.comparisonSymbol,
                    options.startDate,
                    options.endDate
                );

            const result = runBacktest({
                ...options,
                startDate: effectiveStartDate,
                apiData,
                holidays,
            });

            backtestResult.value = result;
        } catch (error) {
            console.error('Backtest Run Failed:', error);
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
    <div id="t-backtester">
        <Toast />
        <BacktesterControls
            @run="handleRun"
            :is-loading="isLoading"
            :result="backtestResult" />
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
