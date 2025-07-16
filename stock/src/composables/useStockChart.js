// stock/src/composables/useStockChart.js

import { ref, computed } from 'vue';

// 날짜 파싱 함수는 여기서도 필요하므로 가져옵니다.
// 또는 별도의 utils 파일로 만들어 공유할 수도 있습니다.
const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map(part => part.trim());
    if (parts.length !== 3) return null;
    return new Date(`20${parts[0]}`, parseInt(parts[1], 10) - 1, parts[2]);
};

// stock/src/composables/useStockChart.js

// ... (파일 상단의 import 및 parseYYMMDD 함수 등은 그대로 유지) ...

export function useStockChart(chartDisplayData, tickerInfo, isPriceChartMode, isDesktop, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);

    const setChartDataAndOptions = (data, frequency) => {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--p-text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
        const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');
        const individualLabelSize = isDesktop.value ? 12 : 10;
        const totalLabelSize = isDesktop.value ? 15 : 12;
        const lineLabelSize = isDesktop.value ? 11 : 9;
        const zoomOptions = {
            pan: { enabled: true, mode: 'x', onPanComplete: () => { selectedTimeRange.value = null; }},
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x', onZoomComplete: () => { selectedTimeRange.value = null; }}
        };

        if (frequency === 'Weekly' && !isPriceChartMode.value) {
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
                    font: { size: individualLabelSize, weight: 'bold' },
                    align: 'center', anchor: 'center'
                }
            }));

            datasets.push({
                type: 'bar', label: 'Total', data: new Array(labels.length).fill(0),
                backgroundColor: 'transparent',
                datalabels: {
                    display: (context) => isDesktop.value && (monthlyAggregated[labels[context.dataIndex]]?.total || 0) > 0,
                    formatter: (value, context) => {
                        const total = monthlyAggregated[labels[context.dataIndex]]?.total || 0;
                        return `$${total.toFixed(4)}`;
                    },
                    color: textColor, anchor: 'end', align: 'end',
                    offset: -8, font: { size: totalLabelSize, weight: 'bold' }
                }
            });

            chartData.value = { labels, datasets };
            const maxTotal = Math.max(...Object.values(monthlyAggregated).map(m => m.total));
            const yAxisMax = maxTotal * 1.25;
            chartOptions.value = {
                maintainAspectRatio: false, aspectRatio: 0.8,
                plugins: {
                    title: { display: false },
                    tooltip: { mode: 'index', intersect: false, callbacks: {
                        filter: item => item.dataset.label !== 'Total' && item.parsed.y > 0,
                        footer: items => 'Total: $' + items.reduce((a, b) => a + b.parsed.y, 0).toFixed(4),
                    }},
                    legend: { display: false },
                    datalabels: { display: true },
                    zoom: zoomOptions
                },
                scales: {
                    x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
                    y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder }, max: yAxisMax }
                }
            };

        } else {
            // 👇 가격 차트(else 블록) 로직을 여기서부터 수정합니다.
            
            const prices = data.flatMap(item => [parseFloat(item['전일가']?.replace('$', '')), parseFloat(item['당일가']?.replace('$', ''))]).filter(p => !isNaN(p));
            const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
            const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;
            
            // 지정된 색상 프리셋 정의
            const colorDividend = '#FFA726'; // 배당금 (Gold)
            const colorPrevPrice = '#BDBDBD'; // 전일가 (Gray)
            const colorCurrentPrice = '#1e88e5'; // 당일가 (Dark Blue)

            chartData.value = {
                labels: data.map(item => item['배당락']),
                datasets: [
                    {
                        type: 'bar',
                        label: '배당금',
                        yAxisID: 'y',
                        order: 2,
                        backgroundColor: colorDividend, // Gold 색상 적용
                        data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
                        datalabels: { display: isDesktop.value, anchor: 'end', align: 'end', color: textColor, formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null, font: { size: individualLabelSize } }
                    },
                    {
                        type: 'line',
                        label: '전일가',
                        yAxisID: 'y1',
                        order: 1,
                        borderColor: colorPrevPrice, // Gray 색상 적용
                        data: data.map(item => parseFloat(item['전일가']?.replace('$', ''))),
                        tension: 0.4,
                        borderWidth: 2,
                        fill: false,
                        datalabels: { display: isDesktop.value, align: 'top', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
                    },
                    {
                        type: 'line',
                        label: '당일가',
                        yAxisID: 'y1',
                        order: 1,
                        borderColor: colorCurrentPrice, // Dark Blue 색상 적용
                        data: data.map(item => parseFloat(item['당일가']?.replace('$', ''))),
                        tension: 0.4,
                        borderWidth: 2,
                        fill: false,
                        datalabels: { display: isDesktop.value, align: 'bottom', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
                    }
                ]
            };
            
            chartOptions.value = {
                maintainAspectRatio: false,
                aspectRatio: 0.6,
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (context.parsed.y !== null) { label += `: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y)}`; }
                                return label;
                            }
                        }
                    },
                    zoom: zoomOptions
                },
                scales: {
                    x: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
                    y: { type: 'linear', display: true, position: 'left', ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: priceMin,
                        max: priceMax,
                        ticks: { color: textColorSecondary },
                        grid: { drawOnChartArea: false, color: surfaceBorder }
                    }
                }
            };
        }
    };

    // 외부에서 사용할 수 있도록 chartData, chartOptions와 이들을 업데이트하는 함수를 반환합니다.
    return {
        chartData,
        chartOptions,
        updateChart: () => {
             if (chartDisplayData.value && chartDisplayData.value.length > 0 && tickerInfo.value) {
                setChartDataAndOptions(chartDisplayData.value, tickerInfo.value.frequency);
            } else {
                chartData.value = null;
                chartOptions.value = null;
            }
        }
    };
}