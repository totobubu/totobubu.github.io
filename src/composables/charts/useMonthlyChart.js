// src\composables\charts\useMonthlyChart.js
import { ref, computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

// --- 1. generateDynamicTimeRangeOptions 함수 추가 ---
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

    const threeMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 3));
    if (lastDate >= threeMonthsAgo) options.push({ label: '3M', value: '3M' });

    const sixMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 6));
    if (lastDate >= sixMonthsAgo) options.push({ label: '6M', value: '6M' });

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

export function useMonthlyChart(options) {
    const { data, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const selectedTimeRange = ref('1Y');
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
    const newestDataIndex = 0;
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
                    // [핵심 수정] lastDataIndex -> newestDataIndex
                    context.dataIndex === newestDataIndex
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
        chartData, // monthlyChartData -> chartData
        chartOptions, // monthlyChartOptions -> chartOptions
        chartContainerWidth,
        timeRangeOptions,
        selectedTimeRange,
    };
}
