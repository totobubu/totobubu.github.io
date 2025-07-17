// stock/src/composables/charts/useWeeklyChart.js
import { parseYYMMDD } from '@/utils/date.js';

// 👇 [핵심 수정] 함수 이름을 더 명확하게 바꾸고, deviceType을 인자로 받습니다.
function getWeeklyFontSize(range, deviceType, type = 'default') {
    // 1. 데스크톱을 기준으로 기본 크기를 설정합니다.
    let baseSize = 14;
    if (type === 'total') baseSize = 16;

    // 2. 기간에 따라 크기를 조절합니다.
    let sizeByRange;
    switch (range) {
        case '3M': sizeByRange = baseSize + 2; break;
        case '6M': sizeByRange = baseSize + 1; break;
        case '9M': sizeByRange = baseSize; break;
        case '1Y': sizeByRange = baseSize - 1; break;
        case 'Max': sizeByRange = baseSize - 2; break;
        default: sizeByRange = 10;
    }

    // 3. 기기 타입에 따라 보정값을 곱합니다.
    let finalSize;
    if (deviceType === 'tablet') {
        finalSize = sizeByRange * 0.9;
    } else if (deviceType === 'mobile') {
        finalSize = sizeByRange * 0.8;
    } else { // desktop
        finalSize = sizeByRange;
    }
    
    // 4. 최종 크기가 너무 작아지지 않도록 최소값을 보장하고, 정수로 반환합니다.
    return Math.max(10, Math.round(finalSize));
}

export function useWeeklyChart(options) {
    const { data, deviceType, selectedTimeRange } = options;
    const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = options.theme;

    const barLabelSize = getWeeklyFontSize(selectedTimeRange, deviceType, 'default');
    const totalLabelSize = getWeeklyFontSize(selectedTimeRange, deviceType, 'total');

    const monthlyAggregated = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
        const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
        if (!acc[yearMonth]) { acc[yearMonth] = { total: 0, weeks: {} }; }
        if (!acc[yearMonth].weeks[weekOfMonth]) { acc[yearMonth].weeks[weekOfMonth] = 0; }
        acc[yearMonth].weeks[weekOfMonth] += amount;
        acc[yearMonth].total += amount;
        return acc;
    }, {});

    const labels = Object.keys(monthlyAggregated);
    const weekColors = { 1: '#4285F4', 2: '#EA4335', 3: '#FBBC04', 4: '#34A853', 5: '#FF6D01' };
    const existingWeeks = [...new Set(Object.values(monthlyAggregated).flatMap(m => Object.keys(m.weeks)))].map(Number).sort();
    
    const datasets = existingWeeks.map(week => ({
        type: 'bar', label: `${week}주차`, backgroundColor: weekColors[week],
        data: labels.map(label => monthlyAggregated[label].weeks[week] || 0),
        datalabels: {
            display: context => (context.dataset.data[context.dataIndex] || 0) > 0.0001,
            formatter: (value) => `$${value.toFixed(4)}`,
            color: '#fff', 
            font: { size: barLabelSize, weight: 'bold' },
            align: 'center', anchor: 'center'
        }
    }));

    datasets.push({
        type: 'bar', label: 'Total', data: new Array(labels.length).fill(0),
        backgroundColor: 'transparent',
        datalabels: {
            display: true, 
            formatter: (value, context) => {
                const total = monthlyAggregated[labels[context.dataIndex]]?.total || 0;
                return total > 0 ? `$${total.toFixed(4)}` : '';
            },
            color: textColor, anchor: 'end', align: 'end',
            offset: -8, 
            font: { size: totalLabelSize, weight: 'bold' }
        }
    });

    const weeklyChartData = { labels, datasets };
    const maxTotal = Math.max(0, ...Object.values(monthlyAggregated).map(m => m.total));
    const yAxisMax = maxTotal * 1.25;

    const weeklyChartOptions = {
        maintainAspectRatio: false, 
        aspectRatio: options.aspectRatio,
        plugins: {
            title: { display: false },
            tooltip: { 
                mode: 'index', 
                intersect: false, 
                callbacks: {
                    label: function(tooltipItem) {
                        if (tooltipItem.raw > 0 && tooltipItem.dataset.label !== 'Total') {
                            return `${tooltipItem.dataset.label}: $${Number(tooltipItem.raw).toFixed(4)}`;
                        }
                        return null;
                    },
                    footer: function(tooltipItems) {
                        const validItems = tooltipItems.filter(item => item.raw > 0 && item.dataset.label !== 'Total');
                        if (validItems.length === 0) return '';
                        const sum = validItems.reduce((total, currentItem) => total + currentItem.raw, 0);
                        return 'Total: $' + sum.toFixed(4);
                    }
                }
            },
            legend: { display: false },
            zoom: zoomOptions
        },
        scales: {
            x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
            y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder }, max: yAxisMax }
        }
    };

    return { weeklyChartData, weeklyChartOptions };
}