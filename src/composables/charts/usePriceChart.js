import { ref, computed } from 'vue';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import { parseYYMMDD } from '@/utils/date.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getPriceChartFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

// --- 1. generateDynamicTimeRangeOptions 함수를 이 파일 안으로 가져옵니다. ---
// (또는 별도의 utils 파일로 만들어 import 해도 좋습니다.)
const generateDynamicTimeRangeOptions = (history) => {
    if (!history || history.length === 0) {
        return [{ label: '전체', value: 'ALL' }];
    }
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
    const { data, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    // --- 핵심 수정: 색상 객체를 안전하게 가져오고 모든 변수에 기본값을 설정합니다. ---
    const colors = getChartColorsByGroup(group) || {}; // getChartColorsByGroup이 undefined를 반환할 경우를 대비

    const dividend = colors.dividend || '#4ade80';
    const highlight = colors.highlight || '#818cf8';
    const lineDividend = colors.lineDividend || '#16a34a';
    const prevPrice = colors.prevPrice || '#9ca3af';
    const currentPrice = colors.currentPrice || '#3b82f6';
    const openPrice = colors.openPrice || '#f97316';
    const nextPrice = colors.nextPrice || '#14b8a6';
    const dividendText = colors.dividendText || '#ffffff';
    const highlightText = colors.highlightText || '#ffffff';
    const prevPriceText = colors.prevPriceText || '#9ca3af'; // 에러가 발생한 변수
    const currentPriceText = colors.currentPriceText || '#3b82f6';
    const openPriceText = colors.openPriceText || '#f97316';
    const nextPriceText = colors.nextPriceText || '#14b8a6';
    // -------------------------------------------------------------------------


    // --- 2. timeRangeOptions와 selectedTimeRange를 내부 상태로 관리 ---
    const selectedTimeRange = ref('1Y');
    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(data)
    );

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

    // --- Y축 범위 계산 (기존과 동일) ---
    const prices = data
        .flatMap((item) => [
            parseFloat(item['전일종가']?.replace('$', '')),
            parseFloat(item['당일종가']?.replace('$', '')),
            parseFloat(item['당일시가']?.replace('$', '')),
            parseFloat(item['익일종가']?.replace('$', '')),
        ])
        .filter((p) => !isNaN(p));
    const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
    const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;

    // --- 3. 반환할 객체의 키 이름을 표준에 맞게 수정 ---
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
                data: data.map((item) =>
                    parseFloat(item['전일종가']?.replace('$', ''))
                ),
                tension: 0.4,
                borderWidth: 1,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'top',
                    color: prevPriceText,
                    formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
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
                data: data.map((item) =>
                    parseFloat(item['당일시가']?.replace('$', ''))
                ),
                tension: 0.4,
                borderWidth: 2,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'center',
                    color: openPriceText,
                    formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
                    font: { size: lineLabelSize },
                },
            },
            {
                type: 'line',
                label: '당일종가',
                yAxisID: 'y1',
                order: 3,
                borderColor: currentPrice,
                data: data.map((item) =>
                    parseFloat(item['당일종가']?.replace('$', ''))
                ),
                tension: 0.4,
                borderWidth: 3,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'bottom',
                    color: currentPriceText,
                    formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
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
                data: data.map((item) =>
                    parseFloat(item['익일종가']?.replace('$', ''))
                ),
                tension: 0.4,
                borderWidth: 2,
                fill: false,
                datalabels: {
                    display: data.length <= 15,
                    align: 'bottom',
                    color: nextPriceText,
                    formatter: (v) => (v ? `$${v.toFixed(2)}` : null),
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
                    c.dataIndex === lastDataIndex ? highlight : dividend,
                borderColor: lineDividend,
                borderWidth: 1,
                data: data.map((item) =>
                    parseFloat(item['배당금']?.replace('$', '') || 0)
                ),
                datalabels: {
                    display: data.length <= 15,
                    align: 'center',
                    anchor: 'start',
                    offset: 8,
                    color: (c) =>
                        c.dataIndex === lastDataIndex
                            ? highlightText
                            : dividendText,
                    formatter: (v) => (v > 0 ? `$${v.toFixed(2)}` : null),
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

    // --- 4. 표준화된 객체 반환 ---
    return {
        priceChartData,
        priceChartOptions,
        chartContainerWidth,
        // timeRangeOptions,
        // selectedTimeRange,
    };
}
