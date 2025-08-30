// src/composables/useStockChart.js

// [핵심 수정 1] import 문에 'watchEffect'를 추가합니다.
import { ref, computed, watchEffect } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { useQuarterlyChart } from './charts/useQuarterlyChart';
import { useMonthlyChart } from './charts/useMonthlyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { parseYYMMDD } from '@/utils/date.js';
import { generateTimeRangeOptions } from '@/utils/chartUtils.js';

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

    const timeRangeOptions = computed(() => {
        if (!tickerInfo.value || !tickerInfo.value.periods) {
            return [{ label: '전체', value: 'ALL' }];
        }
        return generateTimeRangeOptions(tickerInfo.value.periods);
    });

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) {
            return [];
        }
        
        const validHistory = dividendHistory.value.filter((item) => {
            const dividendDate = parseYYMMDD(item['배당락']);
            const dividendAmount = parseFloat(item['배당금']?.replace('$', ''));
            return dividendDate && !isNaN(dividendAmount);
        });

        if (validHistory.length === 0) {
            return [];
        }

        let filteredHistory = validHistory;
        const range = selectedTimeRange.value;

        if (range && range !== 'ALL') {
            const now = new Date();
            let cutoffDate = new Date(); // let으로 변경

            const rangeValue = parseInt(range);
            const rangeUnit = range.slice(-1);

            if (rangeUnit === 'M') {
                cutoffDate.setMonth(now.getMonth() - rangeValue);
            } else if (rangeUnit === 'Y') {
                // [핵심 수정] N년 필터 시, N년 전의 1월 1일을 기준으로 설정합니다.
                // 예: '25년 8월'에 '3Y' 클릭 -> '22년 1월 1일'이 기준이 됨
                const startYear = now.getFullYear() - rangeValue;
                cutoffDate = new Date(startYear, 0, 1); // 월(month)은 0부터 시작하므로 0이 1월입니다.
            }

            filteredHistory = validHistory.filter(
                (item) => parseYYMMDD(item['배당락']) >= cutoffDate
            );
        }

        return filteredHistory.sort(
            (a, b) => parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
        );
    });

    const chartData = ref({ labels: [], datasets: [] });
    const chartOptions = ref({});
    const chartContainerWidth = ref('100%');

    watchEffect(() => {
        if (
            !tickerInfo.value ||
            !chartDisplayData.value ||
            chartDisplayData.value.length === 0
        ) {
            chartData.value = { labels: [], datasets: [] };
            chartOptions.value = {};
            chartContainerWidth.value = '100%';
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
        if (isPriceChartMode.value) {
            result = usePriceChart(sharedOptions);
        } else {
            const frequency = tickerInfo.value?.frequency;
            if (frequency === '매주' || frequency === '4주') {
                result = useWeeklyChart(sharedOptions);
            } else if (frequency === '분기') {
                result = useQuarterlyChart(sharedOptions);
            } else if (frequency === '매월') {
                result = useMonthlyChart(sharedOptions);
            } else {
                result = usePriceChart(sharedOptions);
            }
        }

        chartData.value = result.chartData || result.priceChartData;
        chartOptions.value = result.chartOptions || result.priceChartOptions;
        chartContainerWidth.value = result.chartContainerWidth;
    });

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        hasDividendChartMode,
    };
}