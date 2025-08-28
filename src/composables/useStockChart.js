// src\composables\useStockChart.js
import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { useQuarterlyChart } from './charts/useQuarterlyChart';
import { useMonthlyChart } from './charts/useMonthlyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { parseYYMMDD } from '@/utils/date.js';
import { generateOptionsFromPeriodString } from '@/utils/chartUtils.js';

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

    // [수정] timeRangeOptions 계산 로직을 새 방식으로 완전히 교체합니다.
    const timeRangeOptions = computed(() => {
        // tickerInfo가 로드되기 전에는 기본 '전체' 옵션만 반환
        if (!tickerInfo.value) {
            return [{ label: '전체', value: 'ALL' }];
        }
        // tickerInfo에 포함된 period 문자열을 사용하여 옵션을 생성합니다.
        return generateOptionsFromPeriodString(tickerInfo.value.period);
    });

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) {
            return [];
        }

        const validHistory = dividendHistory.value.filter((item) => {
            const dividendDate = parseYYMMDD(item['배당락']);
            const dividendAmount = parseFloat(item['배당금']?.replace('$', ''));
            return dividendDate && !isNaN(dividendAmount) && dividendAmount > 0;
        });

        if (validHistory.length === 0) {
            return [];
        }

        const range = selectedTimeRange.value;
        // [수정] 'Max' 조건 제거, 'ALL'만 확인
        if (!range || range === 'ALL') {
            return validHistory.sort(
                (a, b) => parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락']) // [수정] 오름차순 정렬로 변경하여 차트가 왼쪽부터 그려지도록 함
            );
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

        return validHistory
            .filter((item) => parseYYMMDD(item['배당락']) >= cutoffDate)
            .sort(
                (a, b) => parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
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

    const chartData = computed(() => chartResult.value.chartData);
    const chartOptions = computed(() => chartResult.value.chartOptions);
    const chartContainerWidth = computed(
        () => chartResult.value.chartContainerWidth
    );

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        hasDividendChartMode,
    };
}
