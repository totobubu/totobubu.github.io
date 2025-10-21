// src\composables\charts\useAnnualChart.js
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
        (a, b) => parseInt(b) - parseInt(a)
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
                formatter: (val) => formatCurrency(val, { showSymbol: false }),
            },
            splitLine: { lineStyle: { color: surfaceBorder } },
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

    return { chartData: {}, chartOptions, chartContainerHeight };
}

// import { getChartColorsByGroup } from '@/utils/chartColors.js';
// import {
//     getDynamicChartWidth,
//     getChartAspectRatio,
//     getBarStackFontSize,
//     getCommonPlugins,
// } from '@/utils/chartUtils.js';

// const parsePrice = (value) => {
//     if (value === null || typeof value === 'undefined' || value === 'N/A')
//         return null;
//     const number = parseFloat(
//         String(value).replace(/[$,₩]/g, '').replace(/,/g, '')
//     );
//     return isNaN(number) ? null : number;
// };

// export function useAnnualChart(options) {
//     const { data, deviceType, group, theme, currency = 'USD' } = options;
//     const currencySymbol = currency === 'KRW' ? '₩' : '$';
//     const { textColorSecondary, surfaceBorder } = theme;
//     const { dividend: colorDividend, highlight: colorHighlight } =
//         getChartColorsByGroup(group);

//     const labels = data.map((item) => item['배당락'].split('.')[0]); // '25.10.02' -> '25'
//     const chartContainerWidth = getDynamicChartWidth(
//         labels.length,
//         deviceType,
//         80
//     ); // 바 넓이 증가
//     const barLabelSize = getBarStackFontSize(
//         labels.length,
//         deviceType,
//         'default'
//     );
//     const tickFontSize = getBarStackFontSize(labels.length, deviceType, 'axis');
//     const newestDataIndex = 0;
//     const dividendData = data.map((item) => parsePrice(item['배당금']));

//     const chartData = {
//         labels,
//         datasets: [
//             {
//                 type: 'bar',
//                 label: '배당금',
//                 backgroundColor: (context) =>
//                     context.dataIndex === newestDataIndex
//                         ? colorHighlight
//                         : colorDividend,
//                 data: dividendData,
//                 datalabels: {
//                     display: true, // 항상 표시
//                     color: '#fff',
//                     anchor: 'end',
//                     align: 'end',
//                     formatter: (value) =>
//                         value > 0
//                             ? `${currencySymbol}${value.toFixed(currency === 'KRW' ? 0 : 4)}`.replace(
//                                   /\.0+$/,
//                                   ''
//                               )
//                             : null,
//                     font: { size: barLabelSize, weight: 'bold' },
//                 },
//             },
//         ],
//     };

//     const validDividends = dividendData.filter((d) => d > 0);
//     const minAmount =
//         validDividends.length > 0 ? Math.min(...validDividends) : 0;
//     const maxAmount =
//         validDividends.length > 0 ? Math.max(...validDividends) : 0;
//     // [수정] y축을 0부터 시작하도록 변경
//     const yAxisMin = 0;
//     const yAxisMax = maxAmount * 1.2;

//     const chartOptions = {
//         maintainAspectRatio: false,
//         aspectRatio: getChartAspectRatio(deviceType),
//         plugins: getCommonPlugins({
//             theme: { ...theme, tickFontSize },
//             tooltipCallbacks: {
//                 callbacks: {
//                     label: (context) =>
//                         `${context.dataset.label}: ${currencySymbol}${Number(context.raw).toFixed(currency === 'KRW' ? 0 : 4)}`,
//                 },
//             },
//         }),
//         scales: {
//             x: {
//                 ticks: {
//                     color: textColorSecondary,
//                     font: { size: tickFontSize },
//                 },
//                 grid: { color: surfaceBorder },
//             },
//             y: {
//                 min: yAxisMin,
//                 max: yAxisMax,
//                 ticks: {
//                     color: textColorSecondary,
//                     font: { size: tickFontSize },
//                 },
//                 grid: { color: surfaceBorder },
//             },
//         },
//     };

//     return { chartData, chartOptions, chartContainerWidth };
// }
