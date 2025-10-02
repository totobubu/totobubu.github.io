// REFACTORED: src/composables/charts/usePriceChart.js
import { computed } from 'vue';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getPriceChartFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

const parsePrice = (value) => {
    if (value === null || typeof value === 'undefined' || value === 'N/A') {
        return null;
    }
    const number = parseFloat(String(value).replace('$', ''));
    return isNaN(number) ? null : number;
};

export function usePriceChart(options) {
    const { data, deviceType, group, theme } = options;
    const { textColorSecondary, surfaceBorder } = theme;

    const colors = getChartColorsByGroup(group) || {};
    const {
        dividend = '#4ade80',
        highlight = '#818cf8',
        lineDividend = '#16a34a',
        prevPrice = '#9ca3af',
        currentPrice = '#3b82f6',
        openPrice = '#f97316',
        nextPrice = '#14b8a6',
        prevPriceText = '#9ca3af',
        currentPriceText = '#3b82f6',
        openPriceText = '#f97316',
        nextPriceText = '#14b8a6',
    } = colors;

    const chartContainerWidth = getDynamicChartWidth(
        data.length,
        deviceType,
        45
    );
    const barLabelSize = getPriceChartFontSize(
        data.length,
        deviceType,
        'default'
    );
    const lineLabelSize = getPriceChartFontSize(
        data.length,
        deviceType,
        'line'
    );
    const tickFontSize = getPriceChartFontSize(data.length, deviceType, 'axis');
    const lastDataIndex = data.length - 1;
    const newestDataIndex = 0;

    const prices = data
        .flatMap((item) => [
            parsePrice(item['전일종가']),
            parsePrice(item['당일종가']),
            parsePrice(item['당일시가']),
            parsePrice(item['익일종가']),
        ])
        .filter((p) => p !== null);

    const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
    const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;

    const priceChartData = {
        labels: data.map((item) => item['배당락']),
        datasets: [
            {
                type: 'line',
                label: '전일종가',
                yAxisID: 'y1',
                order: 1,
                borderColor: prevPrice,
                borderDash: [5, 5],
                data: data.map((item) => parsePrice(item['전일종가'])),
                tension: 0.4,
                borderWidth: 1,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'top',
                    color: prevPriceText,
                    formatter: (v) => (v !== null ? `$${v.toFixed(2)}` : null),
                    font: { size: lineLabelSize * 0.9 },
                },
            },
            {
                type: 'line',
                label: '당일시가',
                yAxisID: 'y1',
                order: 2,
                borderColor: openPrice,
                pointStyle: 'rect',
                data: data.map((item) => parsePrice(item['당일시가'])),
                tension: 0.4,
                borderWidth: 2,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'center',
                    color: openPriceText,
                    formatter: (v) => (v !== null ? `$${v.toFixed(2)}` : null),
                    font: { size: lineLabelSize },
                },
            },
            {
                type: 'line',
                label: '당일종가',
                yAxisID: 'y1',
                order: 3,
                borderColor: currentPrice,
                data: data.map((item) => parsePrice(item['당일종가'])),
                tension: 0.4,
                borderWidth: 3,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'bottom',
                    color: currentPriceText,
                    formatter: (v) => (v !== null ? `$${v.toFixed(2)}` : null),
                    font: { size: lineLabelSize },
                },
            },
            {
                type: 'line',
                label: '익일종가',
                yAxisID: 'y1',
                order: 4,
                borderColor: nextPrice,
                pointStyle: 'triangle',
                data: data.map((item) => parsePrice(item['익일종가'])),
                tension: 0.4,
                borderWidth: 2,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'bottom',
                    color: nextPriceText,
                    formatter: (v) => (v !== null ? `$${v.toFixed(2)}` : null),
                    font: { size: lineLabelSize },
                },
            },
            {
                type: 'bar',
                label: '배당금',
                yAxisID: 'y',
                order: 5,
                hidden: true,
                backgroundColor: (c) =>
                    c.dataIndex === newestDataIndex ? highlight : dividend,
                borderColor: lineDividend,
                borderWidth: 1,
                data: data.map((item) => parsePrice(item['배당금'] || 0)),
                datalabels: {
                    display: data.length <= 15,
                    align: 'center',
                    anchor: 'start',
                    offset: 8,
                    color: (c) =>
                        c.dataIndex === newestDataIndex ? 'bold' : 'normal',
                    formatter: (v) =>
                        v !== null && v > 0 ? `$${v.toFixed(2)}` : null,
                    font: (c) => ({
                        size:
                            c.dataIndex === lastDataIndex
                                ? barLabelSize + 2
                                : barLabelSize,
                        weight:
                            c.dataIndex === lastDataIndex ? 'bold' : 'normal',
                    }),
                },
            },
        ],
    };

    const priceChartOptions = {
        maintainAspectRatio: false,
        aspectRatio: getChartAspectRatio(deviceType),
        plugins: getCommonPlugins({
            theme: { ...theme, tickFontSize },
            legendDisplay: true,
            tooltipCallbacks: {
                itemSort: (a, b) => a.dataset.order - b.dataset.order,
                callbacks: {
                    label: (c) =>
                        `${c.dataset.label || ''}: ${new Intl.NumberFormat('EN-US', { style: 'currency', currency: 'USD' }).format(c.parsed.y)}`,
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
                type: 'linear',
                display: true,
                position: 'left',
                ticks: {
                    color: textColorSecondary,
                    font: { size: tickFontSize },
                },
                grid: { color: surfaceBorder },
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                min: priceMin,
                max: priceMax,
                ticks: {
                    color: textColorSecondary,
                    font: { size: tickFontSize },
                },
                grid: { drawOnChartArea: false, color: surfaceBorder },
            },
        },
    };

    return {
        priceChartData,
        priceChartOptions,
        chartContainerWidth,
    };
}
