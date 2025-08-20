import { ref, computed } from 'vue'; // ref, computed 추가
import { parseYYMMDD } from '@/utils/date.js';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

// --- 1. generateDynamicTimeRangeOptions 함수 추가 ---
// StockView.vue에 있던 함수를 그대로 가져옵니다.
const generateDynamicTimeRangeOptions = (history) => {
    if (!history || history.length === 0)
        return [{ label: '전체', value: 'ALL' }];
    // ... (StockView에 있던 로직과 동일)
};

export function useMonthlyChart(options) {
    const { data, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    // --- 2. selectedTimeRange 상태 추가 ---
    const selectedTimeRange = ref('1Y'); // 기본값

    // --- 3. timeRangeOptions 생성 로직 추가 ---
    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(data)
    );

    const { dividend: colorDividend, highlight: colorHighlight } =
        getChartColorsByGroup(group);

    const labels = data.map((item) => item['배당락']);
    const chartContainerWidth = getDynamicChartWidth(
        labels.length,
        deviceType,
        45
    );
    const barLabelSize = getBarStackFontSize(
        labels.length,
        deviceType,
        'default'
    );
    const tickFontSize = getBarStackFontSize(labels.length, deviceType, 'axis');
    const lastDataIndex = data.length - 1;

    const dividendData = data.map((item) =>
        parseFloat(item['배당금']?.replace('$', '') || 0)
    );

    const chartData = {
        labels,
        datasets: [
            {
                type: 'bar',
                label: '배당금',
                backgroundColor: (context) =>
                    context.dataIndex === lastDataIndex
                        ? colorHighlight
                        : colorDividend,
                data: dividendData,
                datalabels: {
                    display: labels.length <= 15,
                    color: '#fff',
                    anchor: 'end', // 중앙 정렬로 되돌립니다 (이전 버전 참조)
                    align: 'end', // 중앙 정렬로 되돌립니다 (이전 버전 참조)
                    formatter: (value) =>
                        value > 0 ? `$${value.toFixed(4)}` : null,
                    font: { size: barLabelSize, weight: 'bold' },
                },
            },
        ],
    };

    const validDividends = dividendData.filter((d) => d > 0);
    const minAmount =
        validDividends.length > 0 ? Math.min(...validDividends) : 0;
    const maxAmount =
        validDividends.length > 0 ? Math.max(...validDividends) : 0;

    const yAxisMin = minAmount * 0.95;
    const yAxisMax = maxAmount * 1.05;

    const chartOptions = {
        maintainAspectRatio: false,
        aspectRatio: getChartAspectRatio(deviceType),
        plugins: getCommonPlugins({
            theme: { ...theme, tickFontSize },
            tooltipCallbacks: {
                callbacks: {
                    label: (context) =>
                        `${context.dataset.label}: $${Number(context.raw).toFixed(4)}`,
                },
            },
        }),
        scales: {
            x: {
                ticks: {
                    color: textColorSecondary,
                    font: { size: tickFontSize },
                },
                grid: { color: surfaceBorder },
            },
            y: {
                min: yAxisMin,
                max: yAxisMax,
                ticks: {
                    color: textColorSecondary,
                    font: { size: tickFontSize },
                },
                grid: { color: surfaceBorder },
            },
        },
    };

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        selectedTimeRange,
    };
}
