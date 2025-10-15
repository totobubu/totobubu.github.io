// src/composables/charts/useWeeklyChart.js
import { parseYYMMDD } from '@/utils/date.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
    createStackedBarDatasets,
} from '@/utils/chartUtils.js';

const parsePrice = (value) => {
    if (value === null || typeof value === 'undefined' || value === 'N/A')
        return null;
    const number = parseFloat(
        String(value).replace(/[$,₩]/g, '').replace(/,/g, '')
    );
    return isNaN(number) ? null : number;
};

export function useWeeklyChart(options) {
    const { data, deviceType, theme, currency = 'USD' } = options;
    const currencySymbol = currency === 'KRW' ? '₩' : '$';
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const monthlyAggregated = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const amount = parsePrice(item['배당금']);
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
            formatter: (value) =>
                `${currencySymbol}${value.toFixed(currency === 'KRW' ? 0 : 4)}`,
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
                return total > 0
                    ? `${currencySymbol}${total.toFixed(currency === 'KRW' ? 0 : 4)}`
                    : '';
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
                            ? `${item.dataset.label}: ${currencySymbol}${Number(item.raw).toFixed(currency === 'KRW' ? 0 : 4)}`
                            : null,
                    footer: (items) => {
                        const valid = items.filter(
                            (i) => i.raw > 0 && i.dataset.label !== 'Total'
                        );
                        if (valid.length === 0) return '';
                        const sum = valid.reduce((t, c) => t + c.raw, 0);
                        return `Total: ${currencySymbol}${sum.toFixed(currency === 'KRW' ? 0 : 4)}`;
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

    return { chartData, chartOptions, chartContainerWidth };
}
