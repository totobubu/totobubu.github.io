<!-- stock\src\pages\StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useStockChart } from '@/composables/useStockChart';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    import ProgressSpinner from 'primevue/progressspinner';
    import StockHeader from '@/components/StockHeader.vue';
    import StockChartCard from '@/components/StockChartCard.vue';
    import StockPriceCandlestickChart from '@/components/charts/StockPriceCandlestickChart.vue'; // [신규] import
    import StockCalculators from '@/components/StockCalculators.vue';
    import StockHistoryPanel from '@/components/StockHistoryPanel.vue';

    const route = useRoute();
    const { myBookmarks } = useFilterState();
    const { isDesktop } = useBreakpoint();

    const {
        tickerInfo,
        dividendHistory,
        backtestData, // [신규] backtestData 가져오기
        isLoading,
        error,
        loadData,
        isUpcoming,
    } = useStockData();

    const tickerSymbol = computed(() => (route.params.ticker || '').toString());
    const pageTitle = computed(() => {
        if (!tickerInfo.value?.longName) { // longName으로 변경
            return tickerSymbol.value
                ? `${tickerSymbol.value.toUpperCase()} | 정보`
                : '종목 정보 로딩 중...';
        }
        return `${tickerInfo.value.longName} (${tickerSymbol.value.toUpperCase()}) | 정보`;
    });
    useHead({
        title: pageTitle,
    });

    const isPriceChartMode = ref(false);
    const selectedTimeRange = ref(null);

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
    
    // [신규] 배당 기록이 거의 없는 성장주인지 판단
    const isGrowthStockChart = computed(() => {
        return !dividendHistory.value || dividendHistory.value.length < 5;
    });

    watch(
        () => tickerInfo.value?.periods,
        (newPeriods) => {
            if (newPeriods && newPeriods.length > 0) {
                selectedTimeRange.value = newPeriods[0];
            } else {
                selectedTimeRange.value = '1Y';
            }
        },
        { immediate: true }
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
    <div class="card">
        <div v-if="isLoading" class="flex justify-center items-center h-screen">
            <ProgressSpinner />
        </div>

        <div v-else-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500" />
            <p class="text-red-500 text-xl mt-4">{{ error }}</p>
        </div>

        <div
            v-else-if="isUpcoming && tickerInfo"
            class="flex flex-column gap-5">
            <StockHeader :info="tickerInfo" />
            <div class="text-center my-8">
                <i class="pi pi-box text-5xl text-surface-500" />
                <p class="text-xl mt-4">출시 예정 종목입니다.</p>
                <p class="text-surface-500">
                    데이터가 집계되면 차트와 상세 정보가 표시됩니다.
                </p>
            </div>
        </div>

        <div
            v-else-if="tickerInfo"
            class="flex flex-column gap-5">
            <StockHeader :info="tickerInfo" />

            <!-- [핵심 수정] 조건부 차트 렌더링 -->
            <StockChartCard
                v-if="!isGrowthStockChart"
                :tickerInfo="tickerInfo"
                :has-dividend-chart-mode="hasDividendChartMode"
                :chart-data="chartData"
                :chart-options="chartOptions"
                :chart-container-width="chartContainerWidth"
                :time-range-options="timeRangeOptions"
                v-model:isPriceChartMode="isPriceChartMode"
                v-model:selectedTimeRange="selectedTimeRange" />
            <StockPriceCandlestickChart
                v-else
                :price-data="backtestData?.prices"
            />
            
            <StockCalculators
                v-if="!isGrowthStockChart"
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="currentUserBookmark" />

            <!-- 배당 내역이 있을 때만 표시 -->
            <StockHistoryPanel
                v-if="dividendHistory && dividendHistory.length > 0"
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