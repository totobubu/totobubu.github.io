import { parseYYMMDD } from "@/utils/date.js";
import { getChartColorsByGroup } from '@/utils/chartColors.js';

function getFontSize(itemCount, deviceType, type = "default") {
    let baseSize = 16;
    if (type === 'axis') baseSize = 12;
    let finalSize;
    if (itemCount <= 6) finalSize = baseSize + 4;
    else if (itemCount <= 12) finalSize = baseSize;
    else if (itemCount <= 24) finalSize = baseSize - 2;
    else finalSize = baseSize - 4;
    if (deviceType === "tablet") finalSize *= 0.8;
    if (deviceType === "mobile") finalSize *= 0.7;
    return Math.max(8, Math.round(finalSize));
}

function getDynamicChartWidth(itemCount, deviceType) {
    if (deviceType !== 'mobile') return '100%';
    if (itemCount <= 6) return '100%';
    const calculatedWidth = itemCount * 45;
    return `${calculatedWidth}px`;
}

export function useMonthlyChart(options) {
    const { data, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = theme;
    const { dividend: colorDividend, highlight: colorHighlight } = getChartColorsByGroup(group);

    const labels = data.map(item => item['배당락']);
    const chartContainerWidth = getDynamicChartWidth(labels.length, deviceType);
    const barLabelSize = getFontSize(labels.length, deviceType, 'default');
    const tickFontSize = getFontSize(labels.length, deviceType, 'axis');
    const lastDataIndex = data.length - 1;

    const monthlyChartData = {
        labels,
        datasets: [{
            type: 'bar',
            label: '배당금',
            backgroundColor: (context) => context.dataIndex === lastDataIndex ? colorHighlight : colorDividend,
            data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
            datalabels: {
                display: labels.length <= 15,
                color: '#fff',
                anchor: 'end',
                align: 'end',
                formatter: (value) => value > 0 ? `$${value.toFixed(4)}` : null,
                font: { size: barLabelSize, weight: 'bold' }
            }
        }]
    };

    const maxAmount = Math.max(0, ...monthlyChartData.datasets[0].data);
    const yAxisMax = maxAmount * 1.25;

    const monthlyChartOptions = {
        maintainAspectRatio: false,
        aspectRatio: deviceType === 'mobile' ? null : (deviceType === "desktop" ? 16/10 : 3/2),
        plugins: {
            title: { display: false },
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => `${context.dataset.label}: $${Number(context.raw).toFixed(4)}`
                }
            },
            zoom: zoomOptions
        },
        scales: {
            x: { ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder } },
            y: { ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder }, max: yAxisMax }
        }
    };

    return { monthlyChartData, monthlyChartOptions, chartContainerWidth };
}