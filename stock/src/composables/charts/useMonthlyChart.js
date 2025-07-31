import { getChartColorsByGroup } from '@/utils/chartColors.js';
import { getDynamicChartWidth, getChartAspectRatio, getBarStackFontSize, getCommonPlugins } from '@/utils/chartUtils.js';

export function useMonthlyChart(options) {
    const { data, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const { dividend: colorDividend, highlight: colorHighlight } = getChartColorsByGroup(group);

    const labels = data.map(item => item['배당락']);
    const chartContainerWidth = getDynamicChartWidth(labels.length, deviceType, 45);
    const barLabelSize = getBarStackFontSize(labels.length, deviceType, 'default');
    const tickFontSize = getBarStackFontSize(labels.length, deviceType, 'axis');
    const lastDataIndex = data.length - 1;

    const monthlyChartData = {
        labels,
        datasets: [{
            type: 'bar', label: '배당금',
            backgroundColor: context => context.dataIndex === lastDataIndex ? colorHighlight : colorDividend,
            data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
            datalabels: {
                display: labels.length <= 15, color: '#fff',
                anchor: 'end', align: 'end',
                formatter: value => value > 0 ? `$${value.toFixed(4)}` : null,
                font: { size: barLabelSize, weight: 'bold' }
            }
        }]
    };

    const maxAmount = Math.max(0, ...monthlyChartData.datasets[0].data);
    const yAxisMax = maxAmount * 1.25;

    const monthlyChartOptions = {
        maintainAspectRatio: false,
        aspectRatio: getChartAspectRatio(deviceType),
        plugins: getCommonPlugins({
            theme: { ...theme, tickFontSize },
            tooltipCallbacks: {
                callbacks: {
                    label: context => `${context.dataset.label}: $${Number(context.raw).toFixed(4)}`
                }
            }
        }),
        scales: {
            x: { ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder } },
            y: { ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder }, max: yAxisMax }
        }
    };

    return { monthlyChartData, monthlyChartOptions, chartContainerWidth };
}