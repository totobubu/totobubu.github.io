// stock/src/composables/charts/usePriceChart.js
import { getChartColorsByGroup } from '@/utils/chartColors.js';

function getPriceFontSize(itemCount, deviceType, type = 'default') {
    let baseSize = 14;
    if (type === 'line') baseSize = 13;
    if (type === 'axis') baseSize = 12;

    let finalSize;
    if (itemCount <= 7) finalSize = baseSize + 2;
    else if (itemCount <= 15) finalSize = baseSize;
    else if (itemCount <= 30) finalSize = baseSize - 2;
    else if (itemCount <= 60) finalSize = baseSize - 3;
    else finalSize = baseSize - 4;

    if (deviceType === 'tablet') finalSize *= 0.9;
    if (deviceType === 'mobile') finalSize *= 0.8;

    return Math.max(9, Math.round(finalSize));
}

export function usePriceChart(options) {
    const { data, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = theme;

    const { 
        dividend: colorDividend, 
        highlight: colorHighlight, 
        lineDividend: LineDividend, 
        prevPrice: colorPrevPrice, 
        currentPrice: colorCurrentPrice,
        openPrice: colorOpenPrice,
        nextPrice: colorNextPrice,
        dividendText,
        highlightText,
        prevPriceText,
        currentPriceText,
        openPriceText,
        nextPriceText
    } = getChartColorsByGroup(group);

    const barLabelSize = getPriceFontSize(data.length, deviceType, 'default');
    const lineLabelSize = getPriceFontSize(data.length, deviceType, 'line');
    const tickFontSize = getPriceFontSize(data.length, deviceType, 'axis');
    const lastDataIndex = data.length - 1;

    const prices = data
        .flatMap(item => [
            parseFloat(item['전일종가']?.replace('$', '')),
            parseFloat(item['당일종가']?.replace('$', '')),
            parseFloat(item['당일시가']?.replace('$', '')),
            parseFloat(item['익일종가']?.replace('$', ''))
        ])
        .filter(p => !isNaN(p));
    const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
    const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;
    
    const priceChartData = {
        labels: data.map(item => item['배당락']),
        datasets: [
            // ... (datasets 배열 내용은 그대로) ...
            {
                type: 'line', label: '전일종가', yAxisID: 'y1', order: 1,
                borderColor: colorPrevPrice,
                borderDash: [5, 5],
                data: data.map(item => parseFloat(item['전일종가']?.replace('$', ''))),
                tension: 0.4, borderWidth: 1, fill: false,
                datalabels: {
                    display: true, align: 'top',
                    color: prevPriceText,
                    formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                    font: { size: lineLabelSize * 0.9 }
                }
            },
            {
                type: 'line', label: '당일시가', yAxisID: 'y1', order: 2,
                borderColor: colorOpenPrice,
                pointStyle: 'rect',
                data: data.map(item => parseFloat(item['당일시가']?.replace('$', ''))),
                tension: 0.4, borderWidth: 2, fill: false,
                datalabels: {
                    display: true, align: 'center',
                    color: openPriceText,
                    formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                    font: { size: lineLabelSize }
                }
            },
            {
                type: 'line', label: '당일종가', yAxisID: 'y1', order: 3,
                borderColor: colorCurrentPrice,
                data: data.map(item => parseFloat(item['당일종가']?.replace('$', ''))),
                tension: 0.4, borderWidth: 3, fill: false,
                datalabels: {
                    display: true, align: 'bottom',
                    color: currentPriceText,
                    formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                    font: { size: lineLabelSize }
                }
            },
            {
                type: 'line', label: '익일종가', yAxisID: 'y1', order: 4,
                borderColor: colorNextPrice,
                pointStyle: 'triangle',
                data: data.map(item => parseFloat(item['익일종가']?.replace('$', ''))),
                tension: 0.4, borderWidth: 2, fill: false,
                datalabels: {
                    display: true, align: 'bottom',
                    color: nextPriceText,
                    formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                    font: { size: lineLabelSize }
                }
            },
            {
                type: 'bar',
                label: '배당금',
                yAxisID: 'y',
                order: 5,
                backgroundColor: (context) => context.dataIndex === lastDataIndex ? colorHighlight : colorDividend,
                borderColor: LineDividend,
                borderWidth: 1,
                data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
                datalabels: {
                    display: true,
                    align: "center",
                    anchor: "center",
                    color: (context) => context.dataIndex === lastDataIndex ? highlightText : dividendText,
                    formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null,
                    font: (context) => ({
                        size: context.dataIndex === lastDataIndex ? barLabelSize + 2 : barLabelSize,
                        weight: context.dataIndex === lastDataIndex ? 'bold' : 'normal'
                    })
                }
            },
        ]
    };
    
    const priceChartOptions = {
        maintainAspectRatio: false,
        aspectRatio: (() => {
            // ... (비율 계산 로직은 그대로) ...
        })(),
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: "index",
                intersect: false,
                // 👇 [핵심 수정] 툴팁 항목 정렬을 위한 itemSort 함수 추가
                itemSort: function(a, b) {
                    // 각 데이터셋에 부여한 'order' 속성을 기준으로 정렬합니다.
                    return a.dataset.order - b.dataset.order;
                },
                callbacks: {
                    label: (context) => `${context.dataset.label || ""}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(context.parsed.y)}`
                }
            },
            zoom: zoomOptions
        },
        scales: {
            // ... (scales 설정은 그대로) ...
        }
    };

    return { priceChartData, priceChartOptions };
}