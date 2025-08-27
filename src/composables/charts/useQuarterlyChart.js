// src\composables\charts\useQuarterlyChart.js
import { ref, computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
    createStackedBarDatasets,
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

export function useQuarterlyChart(options) {
    const { data, deviceType, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const selectedTimeRange = ref('1Y');
    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(data)
    );

    const yearlyAggregated = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const year = date.getFullYear().toString();
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
        if (!acc[year]) acc[year] = { total: 0, stacks: {} };
        if (!acc[year].stacks[quarter]) acc[year].stacks[quarter] = 0;
        acc[year].stacks[quarter] += amount;
        acc[year].total += amount;
        return acc;
    }, {});
    const labels = Object.keys(yearlyAggregated);
    const chartContainerWidth = getDynamicChartWidth(
        labels.length,
        deviceType,
        90
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

    const quarterColors = {
        1: '#4285F4',
        2: '#EA4335',
        3: '#FBBC04',
        4: '#34A853',
    };
    const datasets = createStackedBarDatasets({
        aggregatedData: yearlyAggregated,
        primaryLabels: labels,
        colorMap: quarterColors,
        labelPrefix: '분기',
        dataLabelConfig: {
            display: (context) =>
                (context.dataset.data[context.dataIndex] || 0) > 0.0001 &&
                labels.length <= 11,
            formatter: (value) => `$${value.toFixed(2)}`,
            color: '#fff',
            font: { size: barLabelSize, weight: 'bold' },
            align: 'center',
            anchor: 'center',
        },
        totalLabelConfig: {
            display: labels.length <= 11,
            formatter: (value, context) => {
                const total =
                    yearlyAggregated[labels[context.dataIndex]]?.total || 0;
                return total > 0 ? `$${total.toFixed(2)}` : '';
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

    const chartData = { labels, datasets }; // quarterlyChartData -> chartData
    const maxTotal = Math.max(
        0,
        ...Object.values(yearlyAggregated).map((y) => y.total)
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
                            ? `${item.dataset.label}: $${Number(item.raw).toFixed(2)}`
                            : null,
                    footer: (items) => {
                        const valid = items.filter(
                            (i) => i.raw > 0 && i.dataset.label !== 'Total'
                        );
                        if (valid.length === 0) return '';
                        const sum = valid.reduce((t, c) => t + c.raw, 0);
                        return `Total: $${sum.toFixed(2)}`;
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
        chartData, // quarterlyChartData -> chartData
        chartOptions, // quarterlyChartOptions -> chartOptions
        chartContainerWidth,
        timeRangeOptions,
        selectedTimeRange,
    };
}
