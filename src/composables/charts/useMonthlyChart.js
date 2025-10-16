// src/composables/charts/useMonthlyChart.js
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

const parsePrice = (value) => {
    if (value === null || typeof value === 'undefined' || value === 'N/A')
        return null;
    const number = parseFloat(
        String(value).replace(/[$,₩]/g, '').replace(/,/g, '')
    );
    return isNaN(number) ? null : number;
};

export function useMonthlyChart(options) {
    const { data, deviceType, group, theme, currency = 'USD' } = options;
    const currencySymbol = currency === 'KRW' ? '₩' : '$';
    const { textColorSecondary, surfaceBorder } = theme;
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
    const dividendData = data.map((item) => parsePrice(item['배당금']));

    const chartData = {
        labels,
        datasets: [
            {
                type: 'bar',
                label: '배당금',
                backgroundColor: (context) =>
                    context.dataIndex === newestDataIndex
                        ? colorHighlight
                        : colorDividend,
                data: dividendData,
                datalabels: {
                    display: labels.length <= 15,
                    color: '#fff',
                    anchor: 'end',
                    align: 'end',
                    formatter: (value) =>
                        value > 0
                            ? `${currencySymbol}${value.toFixed(currency === 'KRW' ? 0 : 4)}`
                            : null,
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
                        `${context.dataset.label}: ${currencySymbol}${Number(context.raw).toFixed(currency === 'KRW' ? 0 : 4)}`,
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

    return { chartData, chartOptions, chartContainerWidth };
}
