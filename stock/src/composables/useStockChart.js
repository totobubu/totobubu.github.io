// stock/src/composables/useStockChart.js

import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { usePriceChart } from './charts/usePriceChart';
import { parseYYMMDD } from '@/utils/date.js';

function getDynamicFontSize(range, isDesktop, type = 'default') {
    let baseSize = isDesktop ? 12 : 10;
    if (type === 'total') baseSize = isDesktop ? 15 : 12;
    if (type === 'line') baseSize = isDesktop ? 11 : 9;
    switch (range) {
        case '3M': case '6M': return baseSize;
        case '9M': case '1Y': return baseSize - 1 < 8 ? 8 : baseSize - 1;
        case 'Max': return baseSize - 2 < 8 ? 8 : baseSize - 2;
        default: return 8;
    }
}

export function useStockChart(dividendHistory, tickerInfo, isPriceChartMode, isDesktop, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) return [];
        if (tickerInfo.value?.frequency === 'Weekly' && !isPriceChartMode.value && selectedTimeRange.value && selectedTimeRange.value !== 'Max') {
            const now = new Date();
            const rangeValue = parseInt(selectedTimeRange.value);
            const rangeUnit = selectedTimeRange.value.slice(-1);
            let startDate = new Date(now);
            if (rangeUnit === 'M') startDate.setMonth(now.getMonth() - rangeValue);
            else startDate.setFullYear(now.getFullYear() - rangeValue);
            const cutoffDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            return dividendHistory.value.filter(item => parseYYMMDD(item['배당락']) >= cutoffDate).reverse();
        }
        if (selectedTimeRange.value === 'Max' || !selectedTimeRange.value) {
            return [...dividendHistory.value].reverse();
        }
        const now = new Date();
        const rangeValue = parseInt(selectedTimeRange.value);
        const rangeUnit = selectedTimeRange.value.slice(-1);
        let cutoffDate;
        if (rangeUnit === 'M') cutoffDate = new Date(new Date().setMonth(now.getMonth() - rangeValue));
        else cutoffDate = new Date(new Date().setFullYear(now.getFullYear() - rangeValue));
        return dividendHistory.value.filter(item => parseYYMMDD(item['배당락']) >= cutoffDate).reverse();
    });

    const updateChart = () => {
        const data = chartDisplayData.value;
        const frequency = tickerInfo.value?.frequency;
        
        if (!data || data.length === 0 || !frequency) {
            chartData.value = null; chartOptions.value = null; return;
        }

        const documentStyle = getComputedStyle(document.documentElement);
        const themeOptions = {
            textColor: documentStyle.getPropertyValue('--p-text-color'),
            textColorSecondary: documentStyle.getPropertyValue('--p-text-muted-color'),
            surfaceBorder: documentStyle.getPropertyValue('--p-content-border-color'),
            zoomOptions: {
                pan: { enabled: true, mode: 'x', onPanComplete: () => { selectedTimeRange.value = null; } },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x', onZoomComplete: () => { selectedTimeRange.value = null; } }
            }
        };

        const sharedOptions = {
            data,
            isDesktop: isDesktop.value,
            getDynamicFontSize,
            selectedTimeRange: selectedTimeRange.value,
            theme: themeOptions
        };

        if (frequency === 'Weekly' && !isPriceChartMode.value) {
            const { weeklyChartData, weeklyChartOptions } = useWeeklyChart(sharedOptions);
            chartData.value = weeklyChartData;
            chartOptions.value = weeklyChartOptions;
        } else {
            const { priceChartData, priceChartOptions } = usePriceChart(sharedOptions);
            chartData.value = priceChartData;
            chartOptions.value = priceChartOptions;
        }
    };

    return { chartData, chartOptions, updateChart };
}