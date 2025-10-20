<!-- src/pages/StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    // [핵심 수정] 올바른 import 경로로 수정
    import { useWeeklyChart } from '@/composables/charts/useWeeklyChart.js';
    import { useQuarterlyChart } from '@/composables/charts/useQuarterlyChart.js';
    import { useMonthlyChart } from '@/composables/charts/useMonthlyChart.js';
    import { useAnnualChart } from '@/composables/charts/useAnnualChart.js';
    import { usePriceChart } from '@/composables/charts/usePriceChart.js';
    import { parseYYMMDD } from '@/utils/date.js';
    import {
        generateTimeRangeOptions,
        monthColors,
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
    const documentStyle = computed(() =>
        getComputedStyle(document.documentElement)
    );

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
        return options.length > 1 ? options : [];
    });

    const selectedTimeRange = ref('1Y');

    const timeRangeOptions = computed(() => {
        const allPeriods = tickerInfo.value?.periods;
        if (!allPeriods || allPeriods.length === 0)
            return [{ label: '전체', value: 'ALL' }];

        let options = generateTimeRangeOptions(allPeriods);
        const freq = tickerInfo.value.frequency;

        if (freq === '분기' && options.length > 1) {
            options = options.filter(
                (opt) => !['6M', '1Y'].includes(opt.value)
            );
            if (options.length <= 1) return [];
        }
        if (freq === '매년' && options.length > 1) {
            if (!allPeriods.includes('10Y')) return [];
            options = options.filter(
                (opt) => !['6M', '1Y', '3Y', '5Y'].includes(opt.value)
            );
        }
        return options;
    });

    const displayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0)
            return [];

        const range = selectedTimeRange.value;
        if (!range || range === 'ALL') return dividendHistory.value;

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

    const chartComposableResult = computed(() => {
        if (
            !tickerInfo.value ||
            !displayData.value ||
            displayData.value.length === 0
        )
            return {};
        const themeOptions = {
            textColor: documentStyle.value.getPropertyValue('--p-text-color'),
            textColorSecondary: documentStyle.value.getPropertyValue(
                '--p-text-muted-color'
            ),
            surfaceBorder: documentStyle.value.getPropertyValue(
                '--p-content-border-color'
            ),
        };
        const sharedOptions = {
            data: displayData.value,
            deviceType: deviceType.value,
            group: tickerInfo.value?.group,
            theme: themeOptions,
            currency: tickerInfo.value.currency,
        };

        if (currentView.value === '주가') return usePriceChart(sharedOptions);
        if (currentView.value === '배당') {
            const freq = tickerInfo.value.frequency;
            if (freq === '매년') return useAnnualChart(sharedOptions);
            if (freq === '매주') return useWeeklyChart(sharedOptions);
            if (freq === '분기')
                return useQuarterlyChart({
                    ...sharedOptions,
                    aggregation: 'quarter',
                });
            if (freq === '매월' && displayData.value.length > 59) {
                return useQuarterlyChart({
                    ...sharedOptions,
                    aggregation: 'month',
                    colorMap: monthColors,
                    labelPrefix: '월',
                });
            }
            if (freq === '매월') return useMonthlyChart(sharedOptions);
        }
        return {};
    });

    const chartData = computed(() => chartComposableResult.value.chartData);
    const chartOptions = computed(
        () => chartComposableResult.value.chartOptions
    );
    const chartContainerWidth = computed(
        () => chartComposableResult.value.chartContainerWidth
    );

    const isGrowthStockChart = computed(
        () => !dividendHistory.value || dividendHistory.value.length < 5
    );

    watch(
        () => route.params.ticker,
        (newTicker) => {
            if (newTicker) {
                loadData(newTicker.toLowerCase());
                currentView.value = isGrowthStockChart.value ? '주가' : '배당';
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
                :time-range-options="timeRangeOptions"
                v-model:currentView="currentView"
                v-model:selectedTimeRange="selectedTimeRange"
                :viewOptions="viewOptions" />

            <div v-if="currentView === '배당' || currentView === '주가'">
                <div v-if="chartData" class="chart-wrapper">
                    <div
                        class="chart-container"
                        :style="{ minWidth: chartContainerWidth }">
                        <primevue-chart
                            type="bar"
                            :data="chartData"
                            :options="chartOptions" />
                    </div>
                </div>
                <div
                    v-else-if="
                        currentView === '주가' &&
                        backtestData &&
                        backtestData.length > 0
                    ">
                    <StockPriceCandlestickChart :price-data="backtestData" />
                </div>
                <div v-else class="text-center p-4">
                    차트 데이터가 없습니다.
                </div>
            </div>

            <StockHistoryPanel
                v-if="currentView === '목록'"
                :history="displayData"
                :is-desktop="isDesktop"
                :currency="tickerInfo.currency" />

            <StockCalculators
                v-if="dividendHistory && dividendHistory.length > 0"
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="currentUserBookmark" />

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
