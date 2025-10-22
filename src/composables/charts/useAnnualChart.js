// src/composables/charts/useAnnualChart.js
import { parseYYMMDD } from '@/utils/date.js';
import { createNumericFormatter } from '@/utils/formatters.js';

export function useAnnualChart(options) {
    const { data, theme, currency = 'USD' } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency);

    const yearlyAggregated = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const year = date.getFullYear().toString();
        if (!acc[year]) acc[year] = 0;
        acc[year] += item['배당금'];
        return acc;
    }, {});

    const years = Object.keys(yearlyAggregated).sort(
        (a, b) => parseInt(a) - parseInt(b)
    );
    const dividendData = years.map((year) => yearlyAggregated[year]);
    const chartContainerHeight = `${Math.max(250, years.length * 40)}px`;

    const chartOptions = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) =>
                `${params[0].name}년<br/>${params[0].marker} 배당금: <strong>${formatCurrency(params[0].value)}</strong>`,
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
            data: years,
            axisLabel: { color: textColorSecondary },
        },
        series: [
            {
                name: '연간 배당금',
                type: 'bar',
                data: dividendData,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (params) => formatCurrency(params.value),
                    color: textColor,
                    fontWeight: 'bold',
                },
            },
        ],
    };

    return { chartOptions, chartContainerHeight };
}
