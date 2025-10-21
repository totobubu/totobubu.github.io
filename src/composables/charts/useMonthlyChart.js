// src/composables/charts/useMonthlyChart.js
import { createNumericFormatter } from '@/utils/formatters.js';

export function useMonthlyChart(options) {
    const { data, theme, currency = 'USD' } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency, {
        maximumFractionDigits: 4,
    });

    const reversedData = [...data].reverse();
    const labels = reversedData.map((item) => item['배당락']);
    const dividendData = reversedData.map((item) => item['배당금']);
    const chartContainerHeight = `${Math.max(250, data.length * 40)}px`;

    const chartOptions = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) =>
                `${params[0].name}<br/>${params[0].marker} 배당금: <strong>${formatCurrency(params[0].value)}</strong>`,
        },
        grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: {
                color: textColorSecondary,
                formatter: (val) => formatCurrency(val).replace(/[$,₩]/, ''),
            },
            splitLine: { lineStyle: { color: surfaceBorder, type: 'dashed' } },
        },
        yAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: textColorSecondary },
        },
        series: [
            {
                name: '배당금',
                type: 'bar',
                data: dividendData,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (params) => formatCurrency(params.value),
                    color: textColor,
                },
            },
        ],
    };

    return { chartOptions, chartContainerHeight };
}
