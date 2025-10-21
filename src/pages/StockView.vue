<!-- src/pages/StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useStockCharts } from '@/composables/useStockCharts.js';
    import { parseYYMMDD, generateTimeRangeOptions } from '@/utils';
    import VChart from 'vue-echarts';

    import Skeleton from 'primevue/skeleton';
    import StockHeader from '@/components/StockHeader.vue';
    import StockChartCard from '@/components/StockChartCard.vue';
    import StockPriceCandlestickChart from '@/components/charts/StockPriceCandlestickChart.vue';
    import StockHistoryPanel from '@/components/StockHistoryPanel.vue';

    const route = useRoute();
    const { myBookmarks } = useFilterState();
    const { isDesktop, deviceType } = useBreakpoint();

    const {
        tickerInfo,
        dividendHistory,
        backtestData,
        isLoading,
        error,
        loadData,
        isUpcoming,
    } = useStockData();

    const tickerSymbol = computed(() =>
        (route.params.ticker || '').toString().replace(/-/g, '.')
    );
    const pageTitle = computed(() => {
        const upperTicker = tickerSymbol.value.toUpperCase();
        if (isLoading.value) return '종목 정보 로딩 중...';
        return tickerInfo.value?.longName
            ? `${tickerInfo.value.longName} (${upperTicker}) | 정보`
            : `${upperTicker} | 정보`;
    });
    useHead({ title: pageTitle });

    const currentView = ref('배당');
    const viewOptions = computed(() => {
        const options = [];
        if (dividendHistory.value && dividendHistory.value.length > 0)
            options.push('배당', '목록');
        if (backtestData.value && backtestData.value.length > 0)
            options.push('주가');
        return options;
    });

    // --- [핵심 수정 1] 초기값을 null로 변경 ---
    const selectedTimeRange = ref(null);

    const timeRangeOptions = computed(() => {
        return generateTimeRangeOptions(tickerInfo.value?.periods);
    });

    const displayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0)
            return [];
        const range = selectedTimeRange.value;
        if (!range || range === 'ALL' || currentView.value === '목록')
            return dividendHistory.value;

        const now = new Date();
        let cutoffDate = new Date();
        const val = parseInt(range);
        const unit = range.slice(-1);
        if (unit === 'M') cutoffDate.setMonth(now.getMonth() - val);
        else if (unit === 'Y') cutoffDate.setFullYear(now.getFullYear() - val);

        return dividendHistory.value.filter(
            (item) => parseYYMMDD(item['배당락']) >= cutoffDate
        );
    });

    const { chartOptions, chartContainerHeight } = useStockCharts({
        tickerInfo,
        displayData,
        currentView,
        deviceType,
    });

    watch(
        () => route.params.ticker,
        (newTicker) => {
            if (newTicker) {
                loadData(newTicker.toLowerCase()).then(() => {
                    const hasDividends =
                        dividendHistory.value &&
                        dividendHistory.value.length > 0;
                    currentView.value = hasDividends ? '배당' : '주가';

                    // --- [핵심 수정 2] 데이터 로드 후 기본 기간 설정 ---
                    if (
                        timeRangeOptions.value &&
                        timeRangeOptions.value.length > 1
                    ) {
                        // '전체'가 아닌 첫 번째(가장 짧은) 기간을 기본값으로 설정
                        selectedTimeRange.value =
                            timeRangeOptions.value[0].value;
                    } else {
                        // 기간 옵션이 없거나 '전체'만 있을 경우 '전체'를 기본값으로 설정
                        selectedTimeRange.value = 'ALL';
                    }
                });
            }
        },
        { immediate: true }
    );

    const currentUserBookmark = computed(
        () => myBookmarks.value[tickerSymbol.value.toUpperCase()] || null
    );
</script>

<template>
    <div class="card">
        <!-- Skeleton UI -->
        <div v-if="isLoading" class="flex flex-column gap-5">
            <div id="t-stock-header">
                <Skeleton
                    v-for="i in 6"
                    :key="i"
                    height="5rem"
                    borderRadius="0.5rem"></Skeleton>
            </div>
            <Skeleton height="30rem" borderRadius="1rem"></Skeleton>
        </div>
        <!-- Error UI -->
        <div v-else-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500" />
            <p class="text-red-500 text-xl mt-4">{{ error }}</p>
        </div>
        <!-- Upcoming UI -->
        <div
            v-else-if="isUpcoming && tickerInfo"
            class="flex flex-column gap-5">
            <StockHeader :info="tickerInfo" />
            <div class="text-center my-8">
                <i class="pi pi-box text-5xl dark:text-surface-500" />
                <p class="text-xl mt-4">출시 예정 종목입니다.</p>
                <p class="dark:text-surface-500">
                    데이터가 집계되면 차트와 상세 정보가 표시됩니다.
                </p>
            </div>
        </div>
        <div v-else-if="tickerInfo" class="flex flex-column gap-5">
            <StockHeader :info="tickerInfo" />

            <StockChartCard
                v-if="viewOptions.length > 0"
                :tickerInfo="tickerInfo"
                :dividendHistory="dividendHistory"
                :userBookmark="currentUserBookmark"
                :time-range-options="timeRangeOptions"
                v-model:currentView="currentView"
                v-model:selectedTimeRange="selectedTimeRange"
                :viewOptions="viewOptions" />

            <div v-if="currentView === '배당'">
                <div
                    v-if="chartOptions && Object.keys(chartOptions).length > 0"
                    class="chart-wrapper">
                    <div
                        class="chart-container"
                        :style="{ height: chartContainerHeight }">
                        <v-chart :option="chartOptions" autoresize />
                    </div>
                </div>
                <div v-else class="text-center p-4">
                    선택된 기간에 대한 배당 차트 데이터가 없습니다.
                </div>
            </div>

            <div v-if="currentView === '주가'">
                <StockPriceCandlestickChart
                    v-if="backtestData && backtestData.length > 0"
                    :price-data="backtestData" />
                <div v-else class="text-center p-4">
                    주가 데이터가 없습니다.
                </div>
            </div>

            <StockHistoryPanel
                v-if="currentView === '목록'"
                :history="displayData"
                :is-desktop="isDesktop"
                :currency="tickerInfo.currency" />

            <span
                v-if="tickerInfo.Update"
                class="dark:text-surface-500 dark:text-surface-400 text-center">
                업데이트: {{ tickerInfo.Update }}
            </span>
        </div>
        <div v-else class="text-center mt-8">
            <i class="pi pi-inbox text-5xl dark:text-surface-500" />
            <p class="text-xl mt-4">표시할 데이터가 없습니다.</p>
        </div>
    </div>
</template>
