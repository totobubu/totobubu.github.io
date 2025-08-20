import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { useQuarterlyChart } from './charts/useQuarterlyChart.js';
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
    const chartData = ref(null);
    const chartOptions = ref(null);
    const chartContainerWidth = ref('100%');
    const timeRangeOptions = ref([]);

    const { deviceType } = useBreakpoint();

    const hasDividendChartMode = computed(() => {
        const freq = tickerInfo.value?.frequency;
        return ['매주', '분기', '4주', '매월'].includes(freq);
    });

    // 데이터를 필터링하는 로직은 여기에 두는 것이 좋습니다.
    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) {
            return [];
        }

        const range = selectedTimeRange.value;
        if (!range || range === 'ALL' || range === 'Max') {
            // 'ALL'과 'Max' 모두 처리
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
            (item) => parseYYMMDD(item['배당락']) >= cutoffDate
        );
    });

    const updateChart = () => {
        if (
            !tickerInfo.value ||
            !chartDisplayData.value ||
            chartDisplayData.value.length === 0
        ) {
            chartData.value = { labels: [], datasets: [] };
            chartOptions.value = {};
            return;
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

        let result;
        const frequency = tickerInfo.value?.frequency;

        if (isPriceChartMode.value) {
            // hasDividendChartMode 조건 제거
            result = usePriceChart(sharedOptions);
        } else if (frequency === '매주' || frequency === '4주') {
            result = useWeeklyChart(sharedOptions);
        } else if (frequency === '분기') {
            result = useQuarterlyChart(sharedOptions);
        } else if (frequency === '매월') {
            result = useMonthlyChart(sharedOptions);
        } else {
            // 배당 주기가 없는 종목 등 기본값으로 Price Chart를 보여줌
            result = usePriceChart(sharedOptions);
        }

        // --- 핵심 수정: 결과값을 각 ref에 할당 ---
        // 각 하위 Composable이 반환하는 키 이름에 맞게 조정해야 합니다.
        // (예: weeklyChartData, monthlyChartData 등)
        chartData.value =
            result.chartData ||
            result.priceChartData ||
            result.weeklyChartData ||
            result.monthlyChartData ||
            result.quarterlyChartData;
        chartOptions.value =
            result.chartOptions ||
            result.priceChartOptions ||
            result.weeklyChartOptions ||
            result.monthlyChartOptions ||
            result.quarterlyChartOptions;
        chartContainerWidth.value = result.chartContainerWidth || '100%';
        timeRangeOptions.value = result.timeRangeOptions || [];
    };

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        hasDividendChartMode,
        updateChart,
    };
}
