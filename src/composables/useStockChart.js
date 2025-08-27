// src\composables\useStockChart.js
import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { useQuarterlyChart } from './charts/useQuarterlyChart';
import { useMonthlyChart } from './charts/useMonthlyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { parseYYMMDD } from '@/utils/date.js';

export function useStockChart(
    dividendHistory,
    tickerInfo,
    isPriceChartMode,
    selectedTimeRange
) {
    const { deviceType } = useBreakpoint();

    const hasDividendChartMode = computed(() => {
        const freq = tickerInfo.value?.frequency;
        return ['매주', '분기', '4주', '매월'].includes(freq);
    });

    const generateDynamicTimeRangeOptions = (history) => {
        if (!history || history.length === 0) {
            return [{ label: '전체', value: 'ALL' }];
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

        return options.map((opt) => ({
            ...opt,
            label: opt.value === 'ALL' ? '전체' : opt.label,
        }));
    };

    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(dividendHistory.value)
    );

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) {
            return [];
        }

        const now = new Date();
        const validPastHistory = dividendHistory.value.filter((item) => {
            const dividendDate = parseYYMMDD(item['배당락']);
            const dividendAmount = parseFloat(item['배당금']?.replace('$', ''));
            return dividendDate && dividendDate <= now && dividendAmount > 0;
        });

        if (validPastHistory.length === 0) {
            return [];
        }

        const range = selectedTimeRange.value;
        if (!range || range === 'ALL' || range === 'Max') {
            return validPastHistory;
        }

        const cutoffDate = new Date();
        const rangeValue = parseInt(range);
        const rangeUnit = range.slice(-1);

        if (rangeUnit === 'M') {
            cutoffDate.setMonth(now.getMonth() - rangeValue);
        } else if (rangeUnit === 'Y') {
            cutoffDate.setFullYear(now.getFullYear() - rangeValue);
        }

        return validPastHistory.filter(
            (item) => parseYYMMDD(item['배당락']) >= cutoffDate
        );
    });

    const chartResult = computed(() => {
        if (
            !tickerInfo.value ||
            !chartDisplayData.value ||
            chartDisplayData.value.length === 0
        ) {
            return {
                chartData: { labels: [], datasets: [] },
                chartOptions: {},
                chartContainerWidth: '100%',
            };
        }

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

        if (isPriceChartMode.value) {
            return usePriceChart(sharedOptions);
        }

        const frequency = tickerInfo.value?.frequency;
        if (frequency === '매주' || frequency === '4주') {
            return useWeeklyChart(sharedOptions);
        }
        if (frequency === '분기') {
            return useQuarterlyChart(sharedOptions);
        }
        if (frequency === '매월') {
            return useMonthlyChart(sharedOptions);
        }

        return usePriceChart(sharedOptions);
    });

    const chartData = computed(
        () =>
            chartResult.value.chartData ||
            chartResult.value.priceChartData ||
            chartResult.value.weeklyChartData ||
            chartResult.value.monthlyChartData ||
            chartResult.value.quarterlyChartData
    );
    const chartOptions = computed(
        () =>
            chartResult.value.chartOptions ||
            chartResult.value.priceChartOptions ||
            chartResult.value.weeklyChartOptions ||
            chartResult.value.monthlyChartOptions ||
            chartResult.value.quarterlyChartOptions
    );
    const chartContainerWidth = computed(
        () => chartResult.value.chartContainerWidth || '100%'
    );

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        hasDividendChartMode,
    };
}
