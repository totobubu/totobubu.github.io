// stock/src/composables/useStockChart.js

import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { parseYYMMDD } from '@/utils/date.js';

export function useStockChart(dividendHistory, tickerInfo, isPriceChartMode, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);

    const { deviceType, isDesktop } = useBreakpoint();

    const aspectRatio = computed(() => {
        switch (deviceType.value) {
            case 'desktop': return 16 / 9;
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
        
        if (!data || data.length === 0) { // frequency 체크 제거
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
            deviceType: deviceType.value,
            isDesktop: isDesktop.value, // isDesktop도 전달
            aspectRatio: aspectRatio.value,
            selectedTimeRange: selectedTimeRange.value,
            theme: themeOptions
        };

        // 👇 [핵심 수정] 조건문 로직을 명확하게 변경합니다.
        if (isPriceChartMode.value) {
            // 1. 주가 차트 모드가 켜져있으면, 무조건 가격 차트를 그립니다.
            const { priceChartData, priceChartOptions } = usePriceChart(sharedOptions);
            chartData.value = priceChartData;
            chartOptions.value = priceChartOptions;
        } else {
            // 2. 주가 차트 모드가 꺼져있을 때만, frequency를 확인합니다.
            if (frequency === 'Weekly') {
                const { weeklyChartData, weeklyChartOptions } = useWeeklyChart(sharedOptions);
                chartData.value = weeklyChartData;
                chartOptions.value = weeklyChartOptions;
            } else {
                // 'Weekly'가 아닌 다른 모든 경우 (월배당 등)는 가격 차트와 동일한 로직을 사용합니다.
                const { priceChartData, priceChartOptions } = usePriceChart(sharedOptions);
                chartData.value = priceChartData;
                chartOptions.value = priceChartOptions;
            }
        }
    };

    return { chartData, chartOptions, updateChart };
}