// stock/src/composables/charts/usePriceChart.js

function getPriceFontSize(range, isDesktop, type = 'default') {
    let baseSize = isDesktop ? 12 : 10;
    if (type === 'line') baseSize = isDesktop ? 11 : 9;

    switch (range) {
        case '3M': case '6M': return baseSize;
        case '9M': case '1Y': return baseSize - 1 < 8 ? 8 : baseSize - 1;
        case 'Max': return baseSize - 2 < 8 ? 8 : baseSize - 2;
        default: return 8;
    }
}

export function usePriceChart(options) {
    const { data, isDesktop, selectedTimeRange } = options;
    const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = options.theme;

    const barLabelSize = getPriceFontSize(selectedTimeRange, isDesktop, 'default');
    const lineLabelSize = getPriceFontSize(selectedTimeRange, isDesktop, 'line');
    
    const prices = data.flatMap(item => [parseFloat(item['전일가']?.replace('$', '')), parseFloat(item['당일가']?.replace('$', ''))]).filter(p => !isNaN(p));
    const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
    const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;
    const lastDataIndex = data.length - 1;

    const colorDividend = '#FFC107', LineDividend = '#5f5f5f', colorHighlight = '#FB8C00';
    const colorPrevPrice = '#9E9E9E', colorCurrentPrice = '#212121';

    const priceChartData = {
        labels: data.map(item => item['배당락']),
        datasets: [
            {
                type: 'bar', label: '배당금', yAxisID: 'y', order: 2,
                backgroundColor: (context) => context.dataIndex === lastDataIndex ? colorHighlight : colorDividend,
                borderColor: LineDividend, borderWidth: 1,
                data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
                datalabels: {
                    display: true, anchor: 'end', align: 'end', color: textColor,
                    formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null,
                    font: (context) => ({
                        size: context.dataIndex === lastDataIndex ? barLabelSize + 2 : barLabelSize,
                        weight: context.dataIndex === lastDataIndex ? 'bold' : 'normal'
                    })
                }
            },
            {
                type: 'line', label: '전일가', yAxisID: 'y1', order: 1,
                borderColor: colorPrevPrice, data: data.map(item => parseFloat(item['전일가']?.replace('$', ''))),
                tension: 0.4, borderWidth: 2, fill: false,
                datalabels: {
                    display: true, align: 'top', color: textColor,
                    formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                    font: { size: lineLabelSize }
                }
            },
            {
                type: 'line', label: '당일가', yAxisID: 'y1', order: 1,
                borderColor: colorCurrentPrice, data: data.map(item => parseFloat(item['당일가']?.replace('$', ''))),
                tension: 0.4, borderWidth: 2, fill: false,
                datalabels: {
                    display: true, align: 'bottom', color: textColor,
                    formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                    font: { size: lineLabelSize }
                }
            }
        ]
    };
    const priceChartOptions = {
        maintainAspectRatio: false, 
        aspectRatio: options.aspectRatio,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index', 
                intersect: false,
                callbacks: {
                    label: (context) => `${context.dataset.label || ''}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y)}`
                }
            },
            zoom: zoomOptions
        },
        scales: {
            x: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
            y: { type: 'linear', display: true, position: 'left', ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
            y1: {
                type: 'linear', display: true, position: 'right',
                min: priceMin, max: priceMax, 
                ticks: { color: textColorSecondary }, 
                grid: { drawOnChartArea: false, color: surfaceBorder }
            }
        }
    };

    return { priceChartData, priceChartOptions };
}