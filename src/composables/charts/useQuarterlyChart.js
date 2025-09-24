// src\composables\charts\useQuarterlyChart.js
import { computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
    createStackedBarDatasets,
} from '@/utils/chartUtils.js';

const defaultQuarterColors = {
    1: '#4285F4',
    2: '#EA4335',
    3: '#FBBC04',
    4: '#34A853',
};

export function useQuarterlyChart(options) {
    const {
        data,
        deviceType,
        theme,
        aggregation = 'quarter',
        colorMap = defaultQuarterColors,
        labelPrefix = '분기',
    } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const yearlyAggregated = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const year = date.getFullYear().toString();

        const subCategory =
            aggregation === 'quarter'
                ? Math.floor(date.getMonth() / 3) + 1
                : date.getMonth() + 1;

        const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
        if (!acc[year]) acc[year] = { total: 0, stacks: {} };
        if (!acc[year].stacks[subCategory]) acc[year].stacks[subCategory] = 0;
        acc[year].stacks[subCategory] += amount;
        acc[year].total += amount;
        return acc;
    }, {});

    const labels = Object.keys(yearlyAggregated).sort((a, b) => b - a);
    const itemWidth = aggregation === 'quarter' ? 90 : 60;
    const chartContainerWidth = getDynamicChartWidth(
        labels.length,
        deviceType,
        itemWidth
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

    const datasets = createStackedBarDatasets({
        aggregatedData: yearlyAggregated,
        primaryLabels: labels,
        colorMap: colorMap,
        labelPrefix: labelPrefix,
        dataLabelConfig: {
            display: (context) =>
                (context.dataset.data[context.dataIndex] || 0) > 0.0001 &&
                labels.length <= 11 &&
                aggregation === 'quarter',
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

    const chartData = { labels, datasets };
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

    // [핵심 수정] return 문에서 존재하지 않는 timeRangeOptions와 selectedTimeRange를 제거합니다.
    return {
        chartData,
        chartOptions,
        chartContainerWidth,
    };
}
