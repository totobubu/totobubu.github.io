<!-- stock\src\pages\StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch, provide } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useStockChart } from '@/composables/useStockChart';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    import ProgressSpinner from 'primevue/progressspinner';

    import StockHeader from '@/components/StockHeader.vue';
    import StockChartCard from '@/components/StockChartCard.vue';
    import StockCalculators from '@/components/StockCalculators.vue';
    import StockHistoryPanel from '@/components/StockHistoryPanel.vue';

    const route = useRoute();
    const { myBookmarks } = useFilterState();
    const { isDesktop } = useBreakpoint();

    const { tickerInfo, dividendHistory, isLoading, error, loadData } =
        useStockData();
    provide('stock-ticker-info', tickerInfo);

    // --- SEO 및 페이지 타이틀 설정 ---
    const tickerSymbol = computed(() => (route.params.ticker || '').toString());
    const pageTitle = computed(() => {
        if (!tickerInfo.value?.name) {
            return tickerSymbol.value
                ? `${tickerSymbol.value.toUpperCase()} | 배당 정보`
                : '종목 정보 로딩 중...';
        }
        return `${tickerInfo.value.name} (${tickerSymbol.value.toUpperCase()}) | 배당 정보`;
    });
    useHead({
        // computed 값을 직접 전달하면 값이 바뀔 때마다 브라우저 타이틀이 자동으로 업데이트됩니다.
        title: pageTitle,
    });
    // --- // SEO 및 페이지 타이틀 설정 ---

    const isPriceChartMode = ref(false);
    const selectedTimeRange = ref('1Y');

    const {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        hasDividendChartMode,
    } = useStockChart(
        dividendHistory,
        tickerInfo,
        isPriceChartMode,
        selectedTimeRange
    );

    watch(
        () => route.params.ticker,
        (newTicker) => {
            if (newTicker && typeof newTicker === 'string') {
                loadData(newTicker);
            }
        },
        { immediate: true }
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
