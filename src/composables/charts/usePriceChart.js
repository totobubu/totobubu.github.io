import { ref, computed } from 'vue';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import { parseYYMMDD } from '@/utils/date.js';
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
    const number = parseFloat(String(value).replace(/[$,]/g, ''));
    return isNaN(number) ? null : number;
};

export function usePriceChart(options) {
    const { data, deviceType, group, theme, currency } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const colors = getChartColorsByGroup(group) || {};
    const dividend = colors.dividend || '#4ade80';
    const highlight = colors.highlight || '#818cf8';
    const lineDividend = colors.lineDividend || '#16a34a';
    const prevPrice = colors.prevPrice || '#9ca3af';
    const currentPrice = colors.currentPrice || '#3b82f6';
    const openPrice = colors.openPrice || '#f97316';
    const nextPrice = colors.nextPrice || '#14b8a6';
    const dividendText = colors.dividendText || '#ffffff';
    const highlightText = colors.highlightText || '#ffffff';
    const prevPriceText = colors.prevPriceText || '#9ca3af';
    const currentPriceText = colors.currentPriceText || '#3b82f6';
    const openPriceText = colors.openPriceText || '#f97316';
    const nextPriceText = colors.nextPriceText || '#14b8a6';

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
    const newestDataIndex = 0;

    const formatPriceLabel = (value) => {
        if (value === null || typeof value === 'undefined') return null;
        const prefix = currency === 'KRW' ? '₩' : '$';
        const digits = currency === 'KRW' ? 0 : 2;
        return `${prefix}${value.toFixed(digits)}`;
    };

    const formatTooltipPrice = (value) => {
        const locale = currency === 'KRW' ? 'ko-KR' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: currency === 'KRW' ? 0 : 2,
            maximumFractionDigits: currency === 'KRW' ? 0 : 2,
        }).format(value);
    };

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
                    formatter: (v) => formatPriceLabel(v),
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
                    formatter: (v) => formatPriceLabel(v),
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
                    formatter: (v) => formatPriceLabel(v),
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
                    formatter: (v) => formatPriceLabel(v),
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
                        v !== null && v > 0 ? formatPriceLabel(v) : null,
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
                        `${c.dataset.label || ''}: ${formatTooltipPrice(c.parsed.y)}`,
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
                    callback: function (value) {
                        const prefix = currency === 'KRW' ? '₩' : '$';
                        if (value >= 1000) return `${prefix}${value / 1000}k`;
                        return `${prefix}${value}`;
                    },
                },
                grid: { drawOnChartArea: false, color: surfaceBorder },
            },
        },
    };

    return { priceChartData, priceChartOptions, chartContainerWidth };
}
