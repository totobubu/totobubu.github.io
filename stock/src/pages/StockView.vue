<!-- stock\src\pages\StockView.vue -->
<script setup>
    import { ref, computed, watch, provide } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useStockChart } from '@/composables/useStockChart';
    import { useBreakpoint } from '@/composables/useBreakpoint'; // --- 이 줄을 추가합니다 ---

    import ProgressSpinner from 'primevue/progressspinner';
    import StockHeader from '@/components/StockHeader.vue';
    import StockChartCard from '@/components/StockChartCard.vue';
    import StockCalculators from '@/components/StockCalculators.vue';
    import StockHistoryPanel from '@/components/StockHistoryPanel.vue';

    const route = useRoute();
    const { myBookmarks } = useFilterState();
    const { isDesktop } = useBreakpoint(); // --- 이 줄을 추가합니다 ---

    // useStockData를 호출하여 전역 상태와 함수에 접근합니다.
    const { tickerInfo, dividendHistory, isLoading, error, loadData } =
        useStockData();

    // --- 3. 디버그 로그 추가 ---
    // tickerInfo가 변경될 때마다 로그를 찍어봅니다.
    watch(
        tickerInfo,
        (newInfo) => {
            console.log('[StockView] tickerInfo 변경 감지:', newInfo);
        },
        { deep: true }
    );
    // -------------------------
    // --- 핵심 수정: computed를 provide 합니다. ---
    // provide('stock-ticker-info', readonly(tickerInfo));

    const isPriceChartMode = ref(false);
    const selectedTimeRange = ref('1Y');

    const {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions, // useStockChart로부터 직접 받음
        hasDividendChartMode,
        updateChart,
    } = useStockChart(
        dividendHistory,
        tickerInfo,
        isPriceChartMode,
        selectedTimeRange
    );

    // 라우트 파라미터가 변경될 때마다 전역 상태를 업데이트합니다.
    watch(
        () => route.params.ticker,
        (newTicker) => {
            if (newTicker && typeof newTicker === 'string') {
                loadData(newTicker);
            }
        },
        { immediate: true }
    );

    watch(
        [dividendHistory, tickerInfo, isPriceChartMode, selectedTimeRange],
        () => {
            updateChart();
        },
        { deep: true, immediate: true }
    );

    const currentUserBookmark = computed(() => {
        if (!route.params.ticker) return null;
        const currentTicker = route.params.ticker.toUpperCase();
        return myBookmarks.value[currentTicker] || null;
    });
</script>

<template>
    <div class="card" ref="chartContainer">
        <div v-if="isLoading" class="flex justify-center items-center h-screen">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500" />
            <p class="text-red-500 text-xl mt-4">{{ error }}</p>
        </div>
        <div
            v-else-if="tickerInfo && dividendHistory"
            class="flex flex-column gap-5">
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
            <span
                v-if="tickerInfo.Update"
                class="text-surface-500 dark:text-surface-400 text-center">
                업데이트: {{ tickerInfo.Update }}
            </span>
        </div>
        <div v-else class="text-center mt-8">
            <i class="pi pi-inbox text-5xl text-surface-500" />
            <p class="text-xl mt-4">표시할 데이터가 없습니다.</p>
        </div>
    </div>
</template>
