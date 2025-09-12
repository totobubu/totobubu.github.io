// src/composables/useStockChart.js
import { ref, computed, watchEffect } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { useQuarterlyChart } from './charts/useQuarterlyChart';
import { useMonthlyChart } from './charts/useMonthlyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { parseYYMMDD } from '@/utils/date.js';
import { generateTimeRangeOptions, monthColors } from '@/utils/chartUtils.js'; // [추가] monthColors import

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
            let cutoffDate = new Date();
            
            const rangeValue = parseInt(range);
            const rangeUnit = range.slice(-1);

            if (rangeUnit === 'M') {
                cutoffDate.setMonth(now.getMonth() - rangeValue);
            } else if (rangeUnit === 'Y') {
                // [핵심 수정] frequency에 따라 연도 필터링 방식을 분기합니다.
                if (tickerInfo.value?.frequency === '분기') {
                    // '분기' 배당일 경우: N년 전의 1월 1일을 기준으로 설정
                    const startYear = now.getFullYear() - rangeValue;
                    cutoffDate = new Date(startYear, 0, 1);
                } else {
                    // 그 외(매주, 매월 등)일 경우: 오늘로부터 정확히 N년 전을 기준으로 설정
                    cutoffDate.setFullYear(now.getFullYear() - rangeValue);
                }
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
            !chartDisplayData.value.length === 0
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

            // [핵심 수정] 월배당이면서 데이터가 60개(5년)를 초과하면 분기 차트(연도별 누적) 로직을 사용
            if (frequency === '매월' && chartDisplayData.value.length > 59) {
                // 분기 차트 컴포저블을 재활용하되, 월별 설정을 추가로 전달
                result = useQuarterlyChart({
                    ...sharedOptions,
                    aggregation: 'month', // 'month' 또는 'quarter'
                    colorMap: monthColors,
                    labelPrefix: '월',
                });
            } else if (frequency === '매주' || frequency === '4주') {
                result = useWeeklyChart(sharedOptions);
            } else if (frequency === '분기') {
                // 기존 분기 차트 호출 시, 분기별 설정을 명시적으로 전달
                result = useQuarterlyChart({
                    ...sharedOptions,
                    aggregation: 'quarter',
                });
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
