<!-- src/pages/StockView.vue -->
<script setup>
import { ref, computed, watch, provide } from 'vue';
import { useRoute } from 'vue-router';
import { useStockData } from '@/composables/useStockData';
import { useFilterState } from '@/composables/useFilterState';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { usePriceChart } from '@/composables/charts/usePriceChart';
import { useWeeklyChart } from '@/composables/charts/useWeeklyChart';
import { useMonthlyChart } from '@/composables/charts/useMonthlyChart';
import { useQuarterlyChart } from '@/composables/charts/useQuarterlyChart';

import ProgressSpinner from 'primevue/progressspinner';
import StockHeader from '@/components/StockHeader.vue';
import StockChartCard from '@/components/StockChartCard.vue';
import StockCalculators from '@/components/StockCalculators.vue';
import StockHistoryPanel from '@/components/StockHistoryPanel.vue';

const route = useRoute();
const { myBookmarks } = useFilterState();
const { isDesktop, deviceType } = useBreakpoint();

const { tickerInfo, dividendHistory, isLoading, error, loadData } = useStockData();
provide('stock-ticker-info', tickerInfo);

const isPriceChartMode = ref(false);
const selectedTimeRange = ref('1Y');

const chartComposableResult = computed(() => {
    if (!tickerInfo.value || !dividendHistory.value) {
        return {
            chartData: { labels: [], datasets: [] },
            chartOptions: {},
            chartContainerWidth: '100%',
            timeRangeOptions: [],
            selectedTimeRange: ref('1Y')
        };
    }

    const documentStyle = getComputedStyle(document.documentElement);
    const theme = {
        textColor: documentStyle.getPropertyValue('--p-text-color'),
        textColorSecondary: documentStyle.getPropertyValue('--p-text-muted-color'),
        surfaceBorder: documentStyle.getPropertyValue('--p-content-border-color'),
    };
    
    const options = {
        data: dividendHistory.value,
        deviceType: deviceType.value,
        group: tickerInfo.value.group,
        theme: theme,
    };

    if (isPriceChartMode.value) {
        return usePriceChart(options);
    }

    const frequency = tickerInfo.value.frequency;
    if (frequency === '매주' || frequency === '4주') {
        return useWeeklyChart(options);
    } else if (frequency === '분기') {
        return useQuarterlyChart(options);
    }
    return useMonthlyChart(options);
});

const chartData = computed(() => chartComposableResult.value.chartData);
const chartOptions = computed(() => chartComposableResult.value.chartOptions);
const timeRangeOptions = computed(() => chartComposableResult.value.timeRangeOptions);
const chartContainerWidth = computed(() => chartComposableResult.value.chartContainerWidth);

watch(() => chartComposableResult.value.selectedTimeRange, (newSelectedTimeRangeRef) => {
    if (newSelectedTimeRangeRef && selectedTimeRange.value !== newSelectedTimeRangeRef.value) {
        selectedTimeRange.value = newSelectedTimeRangeRef.value;
    }
}, { immediate: true });

watch(selectedTimeRange, (newValue) => {
    if (chartComposableResult.value && chartComposableResult.value.selectedTimeRange) {
        chartComposableResult.value.selectedTimeRange.value = newValue;
    }
});

watch(() => route.params.ticker, (newTicker) => {
    if (newTicker && typeof newTicker === 'string') {
        loadData(newTicker);
    }
}, { immediate: true });

const hasDividendChartMode = computed(() => {
    if (!dividendHistory.value) return false;
    return dividendHistory.value.some(h => h['배당금'] && parseFloat(h['배당금'].replace('$', '')) > 0);
});

const currentUserBookmark = computed(() => {
    if (!route.params.ticker) return null;
    const currentTicker = route.params.ticker.toUpperCase();
    return myBookmarks.value[currentTicker] || null;
});
</script>

<template>
    <div class="card">
        <div v-if="isLoading" class="flex justify-center items-center h-screen">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500" />
            <p class="text-red-500 text-xl mt-4">{{ error }}</p>
        </div>
        <div v-else-if="tickerInfo && dividendHistory" class="flex flex-column gap-5">
            <StockHeader :info="tickerInfo" />
            <StockChartCard
                :tickerInfo="tickerInfo"
                :has-dividend-chart-mode="hasDividendChartMode"
                :chart-data="chartData"
                :chart-options="chartOptions"
                :chart-container-width="chartContainerWidth"
                :time-range-options="timeRangeOptions"
                v-model:isPriceChartMode="isPriceChartMode"
                v-model:selectedTimeRange="selectedTimeRange" />
            <StockCalculators
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="currentUserBookmark" />
            <StockHistoryPanel
                :history="dividendHistory"
                :update-time="tickerInfo.Update"
                :is-desktop="isDesktop" />
            <span v-if="tickerInfo.Update" class="text-surface-500 dark:text-surface-400 text-center">
                업데이트: {{ tickerInfo.Update }}
            </span>
        </div>
        <div v-else class="text-center mt-8">
            <i class="pi pi-inbox text-5xl text-surface-500" />
            <p class="text-xl mt-4">표시할 데이터가 없습니다.</p>
        </div>
    </div>
</template>