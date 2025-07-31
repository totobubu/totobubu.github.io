import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { useQuarterlyChart } from './charts/useQuarterlyChart';
import { useMonthlyChart } from './charts/useMonthlyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { parseYYMMDD } from '@/utils/date.js';

export function useStockChart(dividendHistory, tickerInfo, isPriceChartMode, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);
    const chartContainerWidth = ref('100%');

    const { deviceType } = useBreakpoint();

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) return [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const pastAndPresentData = dividendHistory.value.filter(item => {
            const itemDate = parseYYMMDD(item["배당락"]);
            return itemDate && itemDate <= today;
        });

        if (selectedTimeRange.value === 'Max' || !selectedTimeRange.value) {
            return [...pastAndPresentData].reverse();
        }

        let cutoffDate;
        const rangeValue = parseInt(selectedTimeRange.value);
        const rangeUnit = selectedTimeRange.value.slice(-1);

        if ((['매주', '분기', '4주', '매월'].includes(tickerInfo.value?.frequency)) && !isPriceChartMode.value) {
            let startDate = new Date(now);
            if (rangeUnit === 'M') {
                startDate.setMonth(now.getMonth() - rangeValue);
            } else {
                startDate.setFullYear(now.getFullYear() - rangeValue);
            }
            cutoffDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        } else {
            if (rangeUnit === 'M') {
                cutoffDate = new Date(new Date().setMonth(now.getMonth() - rangeValue));
            } else {
                cutoffDate = new Date(new Date().setFullYear(now.getFullYear() - rangeValue));
            }
        }
        
        return pastAndPresentData.filter((item) => parseYYMMDD(item["배당락"]) >= cutoffDate).reverse();
    });

    const updateChart = () => {
        const data = chartDisplayData.value;
        const frequency = tickerInfo.value?.frequency;
        
        if (!data || data.length === 0) {
            chartData.value = null; chartOptions.value = null; return;
        }

        const documentStyle = getComputedStyle(document.documentElement);
        const themeOptions = {
            textColor: documentStyle.getPropertyValue("--p-text-color"),
            textColorSecondary: documentStyle.getPropertyValue("--p-text-muted-color"),
            surfaceBorder: documentStyle.getPropertyValue("--p-content-border-color"),
            zoomOptions: {
                pan: { enabled: true, mode: "x", onPanComplete: () => { selectedTimeRange.value = null; } },
                zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x", onZoomComplete: () => { selectedTimeRange.value = null; } },
            },
        };
        const sharedOptions = { data, deviceType: deviceType.value, group: tickerInfo.value?.group, theme: themeOptions };

        if (isPriceChartMode.value && ['매주', '분기', '4주', '매월'].includes(frequency)) {
            const { priceChartData, priceChartOptions, chartContainerWidth: newWidth } = usePriceChart(sharedOptions);
            chartData.value = priceChartData; chartOptions.value = priceChartOptions; chartContainerWidth.value = newWidth;
        } else if (frequency === "매주") {
            const { weeklyChartData, weeklyChartOptions, chartContainerWidth: newWidth } = useWeeklyChart(sharedOptions);
            chartData.value = weeklyChartData; chartOptions.value = weeklyChartOptions; chartContainerWidth.value = newWidth;
        } else if (frequency === "분기") {
            const { quarterlyChartData, quarterlyChartOptions, chartContainerWidth: newWidth } = useQuarterlyChart(sharedOptions);
            chartData.value = quarterlyChartData; chartOptions.value = quarterlyChartOptions; chartContainerWidth.value = newWidth;
        } else if (frequency === "4주" || frequency === "매월") {
            const { monthlyChartData, monthlyChartOptions, chartContainerWidth: newWidth } = useMonthlyChart(sharedOptions);
            chartData.value = monthlyChartData; chartOptions.value = monthlyChartOptions; chartContainerWidth.value = newWidth;
        } else {
            // 토글 버튼이 없는 기타 종목
            const { priceChartData, priceChartOptions, chartContainerWidth: newWidth } = usePriceChart(sharedOptions);
            chartData.value = priceChartData; chartOptions.value = priceChartOptions; chartContainerWidth.value = newWidth;
        }
    };

    return { chartData, chartOptions, chartContainerWidth, updateChart };
}