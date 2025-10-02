<!-- REFACTORED: src/pages/StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useWeeklyChart } from '@/composables/charts/useWeeklyChart';
    import { useQuarterlyChart } from '@/composables/charts/useQuarterlyChart';
    import { useMonthlyChart } from '@/composables/charts/useMonthlyChart';
    import { usePriceChart } from '@/composables/charts/usePriceChart';
    import { parseYYMMDD } from '@/utils/date.js';
    import {
        monthColors,
        generateTimeRangeOptions,
    } from '@/utils/chartUtils.js';

    import Skeleton from 'primevue/skeleton';
    import StockHeader from '@/components/StockHeader.vue';
    import StockChartCard from '@/components/StockChartCard.vue';
    import StockPriceCandlestickChart from '@/components/charts/StockPriceCandlestickChart.vue';
    import StockCalculators from '@/components/StockCalculators.vue';
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

    const isPriceChartMode = ref(false);
    const selectedTimeRange = ref('1Y');

    const timeRangeOptions = computed(() => {
        if (!tickerInfo.value?.periods) {
            return [
                { label: '1Y', value: '1Y' },
                { label: '전체', value: 'ALL' },
            ];
        }
        return generateTimeRangeOptions(tickerInfo.value.periods);
    });

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0)
            return [];
        const validHistory = dividendHistory.value.filter(
            (item) =>
                parseYYMMDD(item['배당락']) &&
                !isNaN(parseFloat(item['배당금']?.replace('$', '')))
        );
        if (validHistory.length === 0) return [];

        let filtered = validHistory;
        const range = selectedTimeRange.value;
        if (range && range !== 'ALL') {
            const now = new Date();
            let cutoffDate = new Date();
            const val = parseInt(range);
            const unit = range.slice(-1);
            if (unit === 'M') cutoffDate.setMonth(now.getMonth() - val);
            else if (unit === 'Y') {
                if (tickerInfo.value?.frequency === '분기') {
                    cutoffDate = new Date(now.getFullYear() - val, 0, 1);
                } else {
                    cutoffDate.setFullYear(now.getFullYear() - val);
                }
            }
            filtered = validHistory.filter(
                (item) => parseYYMMDD(item['배당락']) >= cutoffDate
            );
        }
        return filtered.sort(
            (a, b) => parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
        );
    });

    const chartComposableResult = computed(() => {
        if (!tickerInfo.value || chartDisplayData.value.length === 0) return {};

        const documentStyle = getComputedStyle(document.documentElement);
        const themeOptions = {
            textColor: documentStyle.getPropertyValue('--p-text-color'),
            textColorSecondary: documentStyle.getPropertyValue(
                '--p-text-muted-color'
            ),
            surfaceBorder: documentStyle.getPropertyValue(
                '--p-content-border-color'
            ),
        };
        const sharedOptions = {
            data: chartDisplayData.value,
            deviceType: deviceType.value,
            group: tickerInfo.value?.group,
            theme: themeOptions,
        };

        if (isPriceChartMode.value) return usePriceChart(sharedOptions);

        const freq = tickerInfo.value.frequency;
        if (freq === '매월' && chartDisplayData.value.length > 59) {
            return useQuarterlyChart({
                ...sharedOptions,
                aggregation: 'month',
                colorMap: monthColors,
                labelPrefix: '월',
            });
        }
        if (freq === '매주' || freq === '4주')
            return useWeeklyChart(sharedOptions);
        if (freq === '분기')
            return useQuarterlyChart({
                ...sharedOptions,
                aggregation: 'quarter',
            });
        if (freq === '매월') return useMonthlyChart(sharedOptions);
        return usePriceChart(sharedOptions);
    });

    const chartData = computed(
        () =>
            chartComposableResult.value.chartData ||
            chartComposableResult.value.priceChartData
    );
    const chartOptions = computed(
        () =>
            chartComposableResult.value.chartOptions ||
            chartComposableResult.value.priceChartOptions
    );
    const chartContainerWidth = computed(
        () => chartComposableResult.value.chartContainerWidth
    );

    const hasDividendChartMode = computed(() => {
        const freq = tickerInfo.value?.frequency;
        return ['매주', '분기', '4주', '매월'].includes(freq);
    });
    const isGrowthStockChart = computed(
        () => !dividendHistory.value || dividendHistory.value.length < 5
    );

    watch(
        () => route.params.ticker,
        (newTicker) => {
            if (newTicker && typeof newTicker === 'string') loadData(newTicker);
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
            <Skeleton height="5rem" borderRadius="1rem"></Skeleton>
            <Skeleton height="20rem" borderRadius="1rem"></Skeleton>
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
        <div v-else-if="tickerInfo" class="flex flex-column gap-5">
            <StockHeader :info="tickerInfo" />
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
                :price-data="backtestData?.prices" />
            <StockCalculators
                v-if="dividendHistory && dividendHistory.length > 0"
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="currentUserBookmark" />
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
