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

function getDynamicPriceChartWidth(itemCount, deviceType) {
    if (deviceType !== 'mobile') return '100%';
    if (itemCount <= 6) return '100%';
    const calculatedWidth = itemCount * 60;
    return `${calculatedWidth}px`;
}

export function usePriceChart(options) {
    const { data, deviceType, group, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = theme;

    const { 
        dividend: colorDividend, highlight: colorHighlight, lineDividend: LineDividend, 
        prevPrice: colorPrevPrice, currentPrice: colorCurrentPrice, openPrice: colorOpenPrice, nextPrice: colorNextPrice,
        dividendText, highlightText, prevPriceText, currentPriceText, openPriceText, nextPriceText
    } = getChartColorsByGroup(group);

    const chartContainerWidth = getDynamicPriceChartWidth(data.length, deviceType);
    const barLabelSize = getPriceFontSize(data.length, deviceType, 'default');
    const lineLabelSize = getPriceFontSize(data.length, deviceType, 'line');
    const tickFontSize = getPriceFontSize(data.length, deviceType, 'axis');
    const lastDataIndex = data.length - 1;

    const prices = data.flatMap(item => [
            parseFloat(item['전일종가']?.replace('$', '')), parseFloat(item['당일종가']?.replace('$', '')),
            parseFloat(item['당일시가']?.replace('$', '')), parseFloat(item['익일종가']?.replace('$', ''))
        ]).filter(p => !isNaN(p));
    const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
    const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;
    
    const priceChartData = {
        labels: data.map(item => item['배당락']),
        datasets: [
            {
                type: 'line', label: '전일종가', yAxisID: 'y1', order: 1, borderColor: colorPrevPrice, borderDash: [5, 5],
                data: data.map(item => parseFloat(item['전일종가']?.replace('$', ''))), tension: 0.4, borderWidth: 1, fill: false,
                datalabels: { display: true, align: 'top', color: prevPriceText, formatter: (v) => v ? `$${v.toFixed(2)}` : null, font: { size: lineLabelSize * 0.9 } }
            },
            {
                type: 'line', label: '당일시가', yAxisID: 'y1', order: 2, borderColor: colorOpenPrice, pointStyle: 'rect',
                data: data.map(item => parseFloat(item['당일시가']?.replace('$', ''))), tension: 0.4, borderWidth: 2, fill: false,
                datalabels: { display: true, align: 'center', color: openPriceText, formatter: (v) => v ? `$${v.toFixed(2)}` : null, font: { size: lineLabelSize } }
            },
            {
                type: 'line', label: '당일종가', yAxisID: 'y1', order: 3, borderColor: colorCurrentPrice,
                data: data.map(item => parseFloat(item['당일종가']?.replace('$', ''))), tension: 0.4, borderWidth: 3, fill: false,
                datalabels: { display: true, align: 'bottom', color: currentPriceText, formatter: (v) => v ? `$${v.toFixed(2)}` : null, font: { size: lineLabelSize } }
            },
            {
                type: 'line', label: '익일종가', yAxisID: 'y1', order: 4, borderColor: colorNextPrice, pointStyle: 'triangle',
                data: data.map(item => parseFloat(item['익일종가']?.replace('$', ''))), tension: 0.4, borderWidth: 2, fill: false,
                datalabels: { display: true, align: 'bottom', color: nextPriceText, formatter: (v) => v ? `$${v.toFixed(2)}` : null, font: { size: lineLabelSize } }
            },
            {
                type: 'bar', label: '배당금', yAxisID: 'y', order: 5,
                backgroundColor: (c) => c.dataIndex === lastDataIndex ? colorHighlight : colorDividend,
                borderColor: LineDividend, borderWidth: 1,
                data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
                datalabels: {
                    display: true, align: "center", anchor: "center",
                    color: (c) => c.dataIndex === lastDataIndex ? highlightText : dividendText,
                    formatter: (v) => v > 0 ? `$${v.toFixed(2)}` : null,
                    font: (c) => ({ size: c.dataIndex === lastDataIndex ? barLabelSize + 2 : barLabelSize, weight: c.dataIndex === lastDataIndex ? 'bold' : 'normal' })
                }
            },
        ]
    };
    
    const priceChartOptions = {
        maintainAspectRatio: false,
        aspectRatio: deviceType === "desktop" ? 16 / 10 : (deviceType === "tablet" ? 3 / 2 : 4 / 3),
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: textColor,
                    font: {
                        size: tickFontSize
                    }
                }
            },
            tooltip: {
                mode: "index", intersect: false, itemSort: (a, b) => a.dataset.order - b.dataset.order,
                callbacks: { label: (c) => `${c.dataset.label || ""}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c.parsed.y)}` }
            },
            zoom: zoomOptions
        },
        scales: {
            x: { ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder } },
            y: { type: 'linear', display: true, position: 'left', ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { color: surfaceBorder } },
            y1: { type: 'linear', display: true, position: 'right', min: priceMin, max: priceMax, ticks: { color: textColorSecondary, font: { size: tickFontSize } }, grid: { drawOnChartArea: false, color: surfaceBorder } }
        }
    };

    return { priceChartData, priceChartOptions, chartContainerWidth };
}