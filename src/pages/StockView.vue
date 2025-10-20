<!-- src/pages/StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import {
        useWeeklyChart,
        useQuarterlyChart,
        useMonthlyChart,
        useAnnualChart,
        usePriceChart,
    } from '@/composables/charts';
    import { parseYYMMDD, generateTimeRangeOptions } from '@/utils';

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

    // [핵심 수정] 뷰 상태 관리
    const currentView = ref('배당'); // '배당', '주가', '목록'
    const viewOptions = computed(() => {
        const options = ['배당'];
        if (backtestData.value && backtestData.value.length > 0)
            options.push('주가');
        if (dividendHistory.value && dividendHistory.value.length > 0)
            options.push('목록');
        return options;
    });

    const selectedTimeRange = ref('1Y');
    const isPriceChartMode = computed(() => currentView.value === '주가');

    const timeRangeOptions = computed(() => {
        const allPeriods = tickerInfo.value?.periods;
        if (!allPeriods || allPeriods.length === 0) {
            return []; // 데이터가 없으면 버튼 숨김
        }

        const freq = tickerInfo.value.frequency;
        let options = generateTimeRangeOptions(allPeriods);

        // [핵심 수정] 분기 배당일 때 3Y 미만 옵션 제거
        if (freq === '분기') {
            options = options.filter(
                (opt) => !['6M', '1Y'].includes(opt.value)
            );
            // 필터링 후 옵션이 '전체'만 남으면 빈 배열 반환하여 숨김
            if (options.length <= 1) return [];
        }

        // [핵심 수정] 매년 배당일 때 10Y 미만 옵션 제거
        if (freq === '매년') {
            const has10Y = allPeriods.includes('10Y');
            if (!has10Y) return []; // 10년 기록 없으면 버튼 숨김
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
        if (!tickerInfo.value || displayData.value.length === 0) return {};
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

    watch(
        () => route.params.ticker,
        (newTicker) => {
            if (newTicker) {
                loadData(newTicker.toLowerCase());
                currentView.value = '배당'; // 페이지 변경 시 기본 뷰로 리셋
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

            <!-- [핵심 수정] 뷰 전환 UI 통합 -->
            <StockChartCard
                :tickerInfo="tickerInfo"
                :time-range-options="timeRangeOptions"
                v-model:currentView="currentView"
                v-model:selectedTimeRange="selectedTimeRange"
                :viewOptions="viewOptions" />

            <!-- 배당 또는 주가 차트 뷰 -->
            <div v-if="currentView === '배당' || currentView === '주가'">
                <div v-if="chartData" class="chart-wrapper">
                    <div
                        class="chart-container"
                        :style="{ minWidth: chartContainerWidth }">
                        <PrimeVueChart
                            type="bar"
                            :data="chartData"
                            :options="chartOptions" />
                    </div>
                </div>
                <div
                    v-else-if="
                        currentView === '주가' && backtestData.length > 0
                    ">
                    <StockPriceCandlestickChart :price-data="backtestData" />
                </div>
                <div v-else class="text-center p-4">
                    차트 데이터가 없습니다.
                </div>
            </div>

            <!-- 목록 뷰 -->
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

            <span v-if="tickerInfo.Update" ...
                >업데이트: {{ tickerInfo.Update }}</span
            >
        </div>
        <!-- ... -->
    </div>
</template>
