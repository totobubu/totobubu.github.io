// src/composables/charts/useWeeklyChart.js
import { parseYYMMDD } from '@/utils/date.js';
import { createNumericFormatter } from '@/utils/formatters.js';

export function useWeeklyChart(options) {
    const { data, theme, currency = 'USD' } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency, {
        maximumFractionDigits: 4,
    });
    const weekColors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01'];

    const monthlyAggregated = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const weekOfMonth = Math.floor((date.getDate() - 1) / 7);
        const amount = item['배당금'];

        if (!acc[yearMonth])
            acc[yearMonth] = { weeks: [0, 0, 0, 0, 0], total: 0 };
        if (weekOfMonth < 5) {
            acc[yearMonth].weeks[weekOfMonth] += amount;
            acc[yearMonth].total += amount;
        }
        return acc;
    }, {});

    const months = Object.keys(monthlyAggregated).sort((a, b) => {
        const [ya, ma] = a.split('.').map(Number);
        const [yb, mb] = b.split('.').map(Number);
        if (ya !== yb) return ya - yb;
        return ma - mb;
    });

    const chartContainerHeight = `${Math.max(250, months.length * 60)}px`;

    const series = [0, 1, 2, 3, 4].map((w) => ({
        name: `${w + 1}주차`,
        type: 'bar',
        stack: 'total',
        label: {
            show: true,
            formatter: (params) =>
                params.value > 0 ? formatCurrency(params.value) : '',
        },
        emphasis: { focus: 'series' },
        data: months.map((month) => monthlyAggregated[month].weeks[w]),
        itemStyle: { color: weekColors[w] },
    }));

    series.push({
        name: '월간 총액',
        type: 'bar',
        stack: 'total',
        label: {
            show: true,
            position: 'right',
            formatter: (params) =>
                formatCurrency(monthlyAggregated[params.name].total),
            color: textColor,
            fontWeight: 'bold',
        },
        data: months.map(() => 0),
    });

    const chartOptions = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const month = params[0].name;
                const total = monthlyAggregated[month].total;
                let tooltip = `${month}<br/>`;
                params
                    .filter((p) => p.seriesName !== '월간 총액' && p.value > 0)
                    .forEach((p) => {
                        tooltip += `${p.marker} ${p.seriesName}: <strong>${formatCurrency(p.value)}</strong><br/>`;
                    });
                tooltip += `<strong>총액: ${formatCurrency(total)}</strong>`;
                return tooltip;
            },
        },
        legend: { show: true, textStyle: { color: textColorSecondary } },
        grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: { color: textColorSecondary },
            splitLine: { lineStyle: { color: surfaceBorder, type: 'dashed' } },
        },
        yAxis: {
            type: 'category',
            data: months,
            axisLabel: { color: textColorSecondary },
        },
        series: series,
    };

    return { chartOptions, chartContainerHeight };
}
