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

export function useStockChart(chartDisplayData, tickerInfo, isPriceChartMode, isDesktop, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);

    const setChartDataAndOptions = (data, frequency) => {
        // 이 함수는 StockView.vue에 있던 원본과 거의 동일합니다.
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
            // ... (Weekly 차트 로직 전체를 여기에 붙여넣습니다)
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
            // ... (가격 차트 로직 전체를 여기에 붙여넣습니다)
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
