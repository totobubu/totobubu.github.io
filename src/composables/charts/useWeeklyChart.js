// src\composables\charts\useWeeklyChart.js
import { ref, computed } from 'vue'; // ref, computed 추가
import { parseYYMMDD } from '@/utils/date.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
    createStackedBarDatasets,
} from '@/utils/chartUtils.js';

// --- 1. generateDynamicTimeRangeOptions 함수 추가 ---
// StockView.vue에 있던 함수를 그대로 가져옵니다.
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

export function useWeeklyChart(options) {
    const { data, deviceType, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    // --- 2. selectedTimeRange 상태 추가 ---
    const selectedTimeRange = ref('1Y'); // 기본값

    // --- 3. timeRangeOptions 생성 로직 추가 ---
    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(data)
    );

    const monthlyAggregated = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
        const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
        if (!acc[yearMonth]) acc[yearMonth] = { total: 0, stacks: {} };
        if (!acc[yearMonth].stacks[weekOfMonth])
            acc[yearMonth].stacks[weekOfMonth] = 0;
        acc[yearMonth].stacks[weekOfMonth] += amount;
        acc[yearMonth].total += amount;
        return acc;
    }, {});

    const labels = Object.keys(monthlyAggregated);
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
    const totalLabelSize = getBarStackFontSize(
        labels.length,
        deviceType,
        'total'
    );
    const tickFontSize = getBarStackFontSize(labels.length, deviceType, 'axis');

    const weekColors = {
        1: '#4285F4',
        2: '#EA4335',
        3: '#FBBC04',
        4: '#34A853',
        5: '#FF6D01',
    };

    const datasets = createStackedBarDatasets({
        aggregatedData: monthlyAggregated,
        primaryLabels: labels,
        colorMap: weekColors,
        labelPrefix: '주차',
        dataLabelConfig: {
            display: (context) =>
                (context.dataset.data[context.dataIndex] || 0) > 0.0001 &&
                labels.length <= 15,
            formatter: (value) => `$${value.toFixed(4)}`,
            color: '#fff',
            font: { size: barLabelSize, weight: 'bold' },
            align: 'center',
            anchor: 'center',
        },
        totalLabelConfig: {
            display: labels.length <= 15,
            formatter: (value, context) => {
                const total =
                    monthlyAggregated[labels[context.dataIndex]]?.total || 0;
                return total > 0 ? `$${total.toFixed(4)}` : '';
            },
            color: textColor,
            anchor: 'end',
            align: 'end',
            offset: (context) =>
                (context.chart.options.plugins.datalabels.font.size ||
                    totalLabelSize) /
                    -2 +
                2,
            font: { size: totalLabelSize, weight: 'bold' },
        },
    });

    const chartData = { labels, datasets };
    const maxTotal = Math.max(
        0,
        ...Object.values(monthlyAggregated).map((m) => m.total)
    );
    const yAxisMax = maxTotal * 1.25;

    const chartOptions = {
        maintainAspectRatio: false,
        aspectRatio: getChartAspectRatio(deviceType),
        plugins: getCommonPlugins({
            theme: { ...theme, tickFontSize },
            tooltipCallbacks: {
                callbacks: {
                    label: (item) =>
                        item.raw > 0 && item.dataset.label !== 'Total'
                            ? `${item.dataset.label}: $${Number(item.raw).toFixed(4)}`
                            : null,
                    footer: (items) => {
                        const valid = items.filter(
                            (i) => i.raw > 0 && i.dataset.label !== 'Total'
                        );
                        if (valid.length === 0) return '';
                        const sum = valid.reduce((t, c) => t + c.raw, 0);
                        return `Total: $${sum.toFixed(4)}`;
                    },
                },
            },
        }),
        scales: {
            x: {
                stacked: true,
                ticks: {
                    color: textColorSecondary,
                    font: { size: tickFontSize },
                },
                grid: { color: surfaceBorder },
            },
            y: {
                stacked: true,
                ticks: {
                    color: textColorSecondary,
                    font: { size: tickFontSize },
                },
                grid: { color: surfaceBorder },
                max: yAxisMax,
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
