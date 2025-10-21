<!-- src/pages/StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useStockCharts } from '@/composables/useStockCharts.js';
    import { parseYYMMDD } from '@/utils/date.js';
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

    const selectedTimeRange = ref('1Y');

    const timeRangeOptions = computed(() => {
        const options = [{ label: '전체', value: 'ALL' }];
        const historyYears =
            dividendHistory.value.length > 0
                ? new Date().getFullYear() -
                  parseYYMMDD(
                      dividendHistory.value[dividendHistory.value.length - 1][
                          '배당락'
                      ]
                  ).getFullYear()
                : 0;

        if (historyYears >= 1) options.unshift({ label: '1Y', value: '1Y' });
        if (historyYears >= 3) options.unshift({ label: '3Y', value: '3Y' });
        if (historyYears >= 5) options.unshift({ label: '5Y', value: '5Y' });

        return options;
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
        <div v-else-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500" />
            <p class="text-red-500 text-xl mt-4">{{ error }}</p>
        </div>
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
                <div v-if="chartOptions" class="chart-wrapper">
                    <div
                        class="chart-container"
                        :style="{ height: chartContainerHeight }">
                        <v-chart :option="chartOptions" autoresize />
                    </div>
                </div>
                <div v-else class="text-center p-4">
                    배당 차트 데이터가 없습니다.
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
