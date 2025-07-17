// stock/src/composables/useStockChart.js

import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint'; // useBreakpoint를 여기서 직접 사용
import { parseYYMMDD } from '@/utils/date.js';

export function useStockChart(dividendHistory, tickerInfo, isPriceChartMode, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);

    const { deviceType, isDesktop } = useBreakpoint(); // 반응형 상태를 여기서 직접 가져옴

    // 디바이스 타입에 따라 동적으로 화면 비율을 계산하는 computed 속성
    const aspectRatio = computed(() => {
        switch (deviceType.value) {
            case 'desktop': return 16 / 10;
            case 'tablet': return 3 / 2;
            case 'mobile': return 4 / 3;
            default: return 16 / 10;
        }
    });

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) return [];
        if (tickerInfo.value?.frequency === 'Weekly' && !isPriceChartMode.value && selectedTimeRange.value && selectedTimeRange.value !== 'Max') {
            const now = new Date();
            const rangeValue = parseInt(selectedTimeRange.value);
            const rangeUnit = selectedTimeRange.value.slice(-1);
            let startDate = new Date(now);
            if (rangeUnit === 'M') {
                startDate.setMonth(now.getMonth() - rangeValue);
            } else {
                startDate.setFullYear(now.getFullYear() - rangeValue);
            }
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
        if (rangeUnit === 'M') {
            cutoffDate = new Date(new Date().setMonth(now.getMonth() - rangeValue));
        } else {
            cutoffDate = new Date(new Date().setFullYear(now.getFullYear() - rangeValue));
        }
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
            aspectRatio: aspectRatio.value, // 계산된 비율을 전달
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