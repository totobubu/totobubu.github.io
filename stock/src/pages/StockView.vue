<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/useStockData';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { parseYYMMDD } from '@/utils/date';

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

    const currentUserBookmark = computed(() => {
        if (!route.params.ticker) return null;
        const currentTicker = route.params.ticker.toUpperCase();
        return myBookmarks.value[currentTicker] || null;
    });

    const chartContainer = ref(null);
    const chartContainerWidth = ref(0);
    const isPriceChartMode = ref(false);
    const selectedTimeRange = ref('1Y');
    const timeRangeOptions = ref([]);

    const hasDividendChartMode = computed(() => {
        if (!dividendHistory.value) return false;
        return dividendHistory.value.some(
            (h) => h['배당금'] && parseFloat(h['배당금'].replace('$', '')) > 0
        );
    });

    const generateDynamicTimeRangeOptions = (history) => {
        if (!history || history.length === 0) {
            return [{ label: '데이터 없음', value: 'ALL', disabled: true }];
        }

        const dates = history
            .map((h) => parseYYMMDD(h['배당락']))
            .sort((a, b) => a - b);
        const lastDate = dates[dates.length - 1];
        const today = new Date();

        const options = [];

        const oneMonthAgo = new Date(new Date().setMonth(today.getMonth() - 1));
        if (lastDate >= oneMonthAgo) options.push({ label: '1M', value: '1M' });

        const threeMonthsAgo = new Date(
            new Date().setMonth(today.getMonth() - 3)
        );
        if (lastDate >= threeMonthsAgo)
            options.push({ label: '3M', value: '3M' });

        const sixMonthsAgo = new Date(
            new Date().setMonth(today.getMonth() - 6)
        );
        if (lastDate >= sixMonthsAgo)
            options.push({ label: '6M', value: '6M' });

        const oneYearAgo = new Date(
            new Date().setFullYear(today.getFullYear() - 1)
        );
        if (lastDate >= oneYearAgo) options.push({ label: '1Y', value: '1Y' });

        options.push({ label: 'ALL', value: 'ALL' });

        if (options.length === 1 && options[0].value === 'ALL') {
            return [{ label: '전체', value: 'ALL' }];
        }

        return options.map((opt) => ({
            ...opt,
            label: opt.value === 'ALL' ? '전체' : opt.label,
        }));
    };

    const filteredHistory = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) {
            return [];
        }
        const range =
            typeof selectedTimeRange.value === 'object'
                ? selectedTimeRange.value.value
                : selectedTimeRange.value;

        if (!range || range === 'ALL') {
            return dividendHistory.value;
        }

        const now = new Date();
        const cutoffDate = new Date();
        const rangeValue = parseInt(range);
        const rangeUnit = range.slice(-1);

        if (rangeUnit === 'M') {
            cutoffDate.setMonth(now.getMonth() - rangeValue);
        } else if (rangeUnit === 'Y') {
            cutoffDate.setFullYear(now.getFullYear() - rangeValue);
        }

        return dividendHistory.value.filter(
            (h) => parseYYMMDD(h['배당락']) >= cutoffDate
        );
    });

    const chartData = computed(() => {
        const validHistory = filteredHistory.value.filter(
            (h) => h['배당금'] && parseFloat(h['배당금'].replace('$', '')) > 0
        );

        if (!validHistory || validHistory.length === 0) {
            return { labels: [], datasets: [] };
        }

        const labels = validHistory.map((h) => h['배당락']);
        const dividendData = validHistory.map((h) =>
            parseFloat(h['배당금'].replace('$', ''))
        );
        const priceData = validHistory.map(
            (h) => parseFloat(h['당일종가']?.replace('$', '')) || 0
        );

        return {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: '주당 배당금',
                    yAxisID: 'y-dividend',
                    backgroundColor: '#4ade80',
                    data: dividendData,
                    hidden: isPriceChartMode.value,
                },
                {
                    type: 'line',
                    label: '당일 종가',
                    yAxisID: 'y-price',
                    borderColor: '#60a5fa',
                    data: priceData,
                    hidden: !isPriceChartMode.value,
                    pointRadius: 0,
                    tension: 0.1,
                },
            ],
        };
    });

    const chartOptions = computed(() => {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--p-text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--p-text-muted-color'
        );
        const surfaceBorder = documentStyle.getPropertyValue(
            '--p-content-border-color'
        );

        return {
            maintainAspectRatio: false,
            aspectRatio: 1.5,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false },
                datalabels: {
                    display: chartContainerWidth.value > 768,
                    color: '#fff',
                    anchor: 'end',
                    align: 'end',
                    offset: -4,
                    font: { weight: 'bold' },
                    formatter: (value) => `$${value.toFixed(4)}`,
                },
            },
            scales: {
                x: {
                    ticks: { color: textColorSecondary },
                    grid: { color: surfaceBorder },
                },
                'y-dividend': {
                    type: 'linear',
                    display: !isPriceChartMode.value,
                    position: 'left',
                    ticks: { color: '#4ade80' },
                    grid: { drawOnChartArea: false },
                },
                'y-price': {
                    type: 'linear',
                    display: isPriceChartMode.value,
                    position: 'right',
                    ticks: { color: '#60a5fa' },
                    grid: { drawOnChartArea: false },
                },
            },
        };
    });

    watch(
        dividendHistory,
        (newHistory) => {
            const newOptions = generateDynamicTimeRangeOptions(newHistory);
            timeRangeOptions.value = newOptions;
            if (
                !newOptions.some((opt) => opt.value === selectedTimeRange.value)
            ) {
                selectedTimeRange.value =
                    newOptions.length > 0
                        ? newOptions[newOptions.length - 1].value
                        : 'ALL';
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

    const updateChartWidth = () => {
        if (chartContainer.value) {
            chartContainerWidth.value = chartContainer.value.offsetWidth;
        }
    };

    onMounted(() => {
        const cardElement = document.querySelector('.card');
        if (cardElement) {
            chartContainer.value = cardElement;
            updateChartWidth();
            window.addEventListener('resize', updateChartWidth);
        }
    });

    onUnmounted(() => {
        window.removeEventListener('resize', updateChartWidth);
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
