// src/composables/charts/usePriceChart.js
import { ref, computed } from 'vue';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import { parseYYMMDD } from '@/utils/date.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getPriceChartFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

const generateDynamicTimeRangeOptions = (history) => {
    if (!history || history.length === 0)
        return [{ label: '전체', value: 'ALL' }];
    const dates = history
        .map((h) => parseYYMMDD(h['배당락']))
        .sort((a, b) => a - b);
    const lastDate = dates[dates.length - 1];
    const today = new Date();

    const options = [];
    const oneMonthAgo = new Date(new Date().setMonth(today.getMonth() - 1));
    if (lastDate >= oneMonthAgo) options.push({ label: '1M', value: '1M' });

    const threeMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 3));
    if (lastDate >= threeMonthsAgo) options.push({ label: '3M', value: '3M' });

    const sixMonthsAgo = new Date(new Date().setMonth(today.getMonth() - 6));
    if (lastDate >= sixMonthsAgo) options.push({ label: '6M', value: '6M' });

    const oneYearAgo = new Date(
        new Date().setFullYear(today.getFullYear() - 1)
    );
    if (lastDate >= oneYearAgo) options.push({ label: '1Y', value: '1Y' });

    options.push({ label: 'ALL', value: 'ALL' });

    return options.map((opt) => ({
        ...opt,
        label: opt.value === 'ALL' ? '전체' : opt.label,
    }));
};

export function usePriceChart(options) {
    const { data: fullData, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const selectedTimeRange = ref('1Y');
    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(fullData)
    );

    const data = computed(() => {
        if (
            !fullData ||
            !selectedTimeRange.value ||
            selectedTimeRange.value === 'ALL'
        )
            return fullData;
        const now = new Date();
        const cutoffDate = new Date();
        const rangeValue = parseInt(selectedTimeRange.value);
        const rangeUnit = selectedTimeRange.value.slice(-1);

        if (rangeUnit === 'M') cutoffDate.setMonth(now.getMonth() - rangeValue);
        else if (rangeUnit === 'Y')
            cutoffDate.setFullYear(now.getFullYear() - rangeValue);

        return fullData.filter((h) => parseYYMMDD(h['배당락']) >= cutoffDate);
    });

    const colors = getChartColorsByGroup(group);
    const chartContainerWidth = computed(() =>
        getDynamicChartWidth(data.value.length, deviceType, 45)
    );
    const barLabelSize = computed(() =>
        getPriceChartFontSize(data.value.length, deviceType, 'default')
    );
    const lineLabelSize = computed(() =>
        getPriceChartFontSize(data.value.length, deviceType, 'line')
    );
    const tickFontSize = computed(() =>
        getPriceChartFontSize(data.value.length, deviceType, 'axis')
    );

    const chartData = computed(() => {
        if (!data.value || data.value.length === 0)
            return { labels: [], datasets: [] };
        const lastDataIndex = data.value.length - 1;
        const prices = data.value
            .flatMap((item) => [
                parseFloat(item['전일종가']?.replace('$', '')),
                parseFloat(item['당일종가']?.replace('$', '')),
                parseFloat(item['당일시가']?.replace('$', '')),
                parseFloat(item['익일종가']?.replace('$', '')),
            ])
            .filter((p) => !isNaN(p));
        const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
        const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;

        return {
            labels: data.value.map((item) => item['배당락']),
            datasets: [
                {
                    type: 'line',
                    label: '전일종가',
                    yAxisID: 'y1',
                    order: 1,
                    borderColor: colors.prevPrice || '#9ca3af',
                    borderDash: [5, 5],
                    data: data.value.map((item) =>
                        parseFloat(item['전일종가']?.replace('$', ''))
                    ),
                    tension: 0.4,
                    borderWidth: 1,
                    fill: false,
                    datalabels: {
                        display: data.value.length <= 15,
                        align: 'top',
                        color: colors.prevPriceText || '#9ca3af',
                        formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
                        font: { size: lineLabelSize.value * 0.9 },
                    },
                },
                {
                    type: 'line',
                    label: '당일시가',
                    yAxisID: 'y1',
                    order: 2,
                    borderColor: colors.openPrice || '#f97316',
                    pointStyle: 'rect',
                    data: data.value.map((item) =>
                        parseFloat(item['당일시가']?.replace('$', ''))
                    ),
                    tension: 0.4,
                    borderWidth: 2,
                    fill: false,
                    datalabels: {
                        display: data.value.length <= 15,
                        align: 'center',
                        color: colors.openPriceText || '#f97316',
                        formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
                        font: { size: lineLabelSize.value },
                    },
                },
                {
                    type: 'line',
                    label: '당일종가',
                    yAxisID: 'y1',
                    order: 3,
                    borderColor: colors.currentPrice || '#3b82f6',
                    data: data.value.map((item) =>
                        parseFloat(item['당일종가']?.replace('$', ''))
                    ),
                    tension: 0.4,
                    borderWidth: 3,
                    fill: false,
                    datalabels: {
                        display: data.value.length <= 15,
                        align: 'bottom',
                        color: colors.currentPriceText || '#3b82f6',
                        formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
                        font: { size: lineLabelSize.value },
                    },
                },
                {
                    type: 'line',
                    label: '익일종가',
                    yAxisID: 'y1',
                    order: 4,
                    borderColor: colors.nextPrice || '#14b8a6',
                    pointStyle: 'triangle',
                    data: data.value.map((item) =>
                        parseFloat(item['익일종가']?.replace('$', ''))
                    ),
                    tension: 0.4,
                    borderWidth: 2,
                    fill: false,
                    datalabels: {
                        display: data.value.length <= 15,
                        align: 'bottom',
                        color: colors.nextPriceText || '#14b8a6',
                        formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
                        font: { size: lineLabelSize.value },
                    },
                },
                {
                    type: 'bar',
                    label: '배당금',
                    yAxisID: 'y',
                    order: 5,
                    hidden: true,
                    backgroundColor: (c) =>
                        c.dataIndex === lastDataIndex
                            ? colors.highlight
                            : colors.dividend,
                    borderColor: colors.lineDividend,
                    borderWidth: 1,
                    data: data.value.map((item) =>
                        parseFloat(item['배당금']?.replace('$', '') || 0)
                    ),
                    datalabels: {
                        display: data.value.length <= 15,
                        align: 'center',
                        anchor: 'start',
                        offset: 8,
                        color: (c) =>
                            c.dataIndex === lastDataIndex
                                ? colors.highlightText
                                : colors.dividendText,
                        formatter: (v) => (v > 0 ? `$${v.toFixed(2)}` : null),
                        font: (c) => ({
                            size:
                                c.dataIndex === lastDataIndex
                                    ? barLabelSize.value + 2
                                    : barLabelSize.value,
                            weight:
                                c.dataIndex === lastDataIndex
                                    ? 'bold'
                                    : 'normal',
                        }),
                    },
                },
            ],
        };
    });

    const chartOptions = computed(() => {
        if (!data.value || data.value.length === 0) return {};
        const prices = data.value
            .flatMap((item) => [
                parseFloat(item['전일종가']?.replace('$', '')),
                parseFloat(item['당일종가']?.replace('$', '')),
                parseFloat(item['당일시가']?.replace('$', '')),
                parseFloat(item['익일종가']?.replace('$', '')),
            ])
            .filter((p) => !isNaN(p));
        const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
        const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;

        return {
            maintainAspectRatio: false,
            aspectRatio: getChartAspectRatio(deviceType),
            plugins: getCommonPlugins({
                theme: { ...theme, tickFontSize: tickFontSize.value },
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
                        font: { size: tickFontSize.value },
                    },
                    grid: { color: surfaceBorder },
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: {
                        color: textColorSecondary,
                        font: { size: tickFontSize.value },
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
                        font: { size: tickFontSize.value },
                    },
                    grid: { drawOnChartArea: false, color: surfaceBorder },
                },
            },
        };
    });

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        selectedTimeRange,
    };
}
