// stock/src/composables/useStockChart.js

import { ref } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';

function getDynamicFontSize(range, isDesktop, type = 'default') {
    let baseSize = isDesktop ? 12 : 10;
    if (type === 'total') baseSize = isDesktop ? 15 : 12;
    if (type === 'line') baseSize = isDesktop ? 11 : 9;
    switch (range) {
        case '3M': case '6M': return baseSize;
        case '9M': case '1Y': return baseSize - 1 < 8 ? 8 : baseSize - 1;
        case 'Max': return baseSize - 2 < 8 ? 8 : baseSize - 2;
        default: return 8;
    }
}

export function useStockChart(dividendHistory, tickerInfo, isPriceChartMode, isDesktop, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);

    const chartDisplayData = computed(() => {
        // ... (이전과 동일한 chartDisplayData 계산 로직)
        if (!dividendHistory.value || dividendHistory.value.length === 0) return [];
        if (tickerInfo.value?.frequency === 'Weekly' && !isPriceChartMode.value && selectedTimeRange.value && selectedTimeRange.value !== 'Max') {
            const now = new Date();
            const rangeValue = parseInt(selectedTimeRange.value);
            const rangeUnit = selectedTimeRange.value.slice(-1);
            let startDate = new Date(now);
            if (rangeUnit === 'M') startDate.setMonth(now.getMonth() - rangeValue);
            else startDate.setFullYear(now.getFullYear() - rangeValue);
            const cutoffDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            return dividendHistory.value.filter(item => parseYYMMDD(item['배당락']) >= cutoffDate).reverse();
        }
        if (selectedTimeRange.value === 'Max' || !selectedTimeRange.value) {
            return [...dividendHistory.value].reverse();
        }
        const now = new Date();
        const rangeValue = parseInt(selectedTimeRange.value);
        const rangeUnit = selectedTimeRange.value.slice(-1);
        let cutoffDate;
        if (rangeUnit === 'M') cutoffDate = new Date(new Date().setMonth(now.getMonth() - rangeValue));
        else cutoffDate = new Date(new Date().setFullYear(now.getFullYear() - rangeValue));
        return dividendHistory.value.filter(item => parseYYMMDD(item['배당락']) >= cutoffDate).reverse();
    });

    const setChartDataAndOptions = () => {
        const data = chartDisplayData.value;
        const frequency = tickerInfo.value?.frequency;
        if (!data || data.length === 0 || !frequency) {
            chartData.value = null;
            chartOptions.value = null;
            return;
        }

        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--p-text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
        const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

        const zoomOptions = {
            pan: { enabled: true, mode: 'x', onPanComplete: () => { selectedTimeRange.value = null; } },
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x', onZoomComplete: () => { selectedTimeRange.value = null; } }
        };

        const barLabelSize = getDynamicFontSize(selectedTimeRange.value, isDesktop.value, 'default');
        const lineLabelSize = getDynamicFontSize(selectedTimeRange.value, isDesktop.value, 'line');
        const totalLabelSize = getDynamicFontSize(selectedTimeRange.value, isDesktop.value, 'total');
        const lastDataIndex = data.length - 1;

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
                    offset: -8, font: { size: totalLabelSize, weight: 'bold' }
                }
            });

            chartData.value = { labels, datasets };
            const maxTotal = Math.max(...Object.values(monthlyAggregated).map(m => m.total));
            const yAxisMax = maxTotal * 1.25;
            chartOptions.value = {
                maintainAspectRatio: false,
                aspectRatio: isDesktop.value ? (16 / 9) : (4 / 3),
                plugins: {
                    title: { display: false },
                    tooltip: { mode: 'index', intersect: false, callbacks: {
                        filter: item => item.raw > 0 && item.dataset.label !== 'Total',
                        footer: items => 'Total: $' + items.reduce((sum, i) => sum + i.raw, 0).toFixed(4),
                    }},
                    legend: { display: false },
                    // 👇 [핵심 수정] datalabels 전역 설정을 완전히 제거합니다.
                    // 이제 각 dataset의 설정이 100% 적용됩니다.
                    zoom: zoomOptions
                },
                scales: {
                    x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
                    y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder }, max: yAxisMax }
                }
            };
        } else {
            const prices = data.flatMap(item => [parseFloat(item['전일가']?.replace('$', '')), parseFloat(item['당일가']?.replace('$', ''))]).filter(p => !isNaN(p));
            const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
            const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;

            const colorDividend = '#FFC107';
            const LineDividend = '#5f5f5f';
            const colorHighlight = '#FB8C00';
            const colorPrevPrice = '#9E9E9E';
            const colorCurrentPrice = '#212121';

            chartData.value = {
                labels: data.map(item => item['배당락']),
                datasets: [
                    {
                        type: 'bar', label: '배당금', yAxisID: 'y', order: 2,
                        backgroundColor: (context) => context.dataIndex === lastDataIndex ? colorHighlight : colorDividend,
                        borderColor: LineDividend,
                        borderWidth: 1,
                        data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
                        datalabels: {
                            display: true,
                            anchor: 'end', align: 'end', color: textColor,
                            formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null,
                            font: (context) => ({
                                size: context.dataIndex === lastDataIndex ? barLabelSize + 2 : barLabelSize,
                                weight: context.dataIndex === lastDataIndex ? 'bold' : 'normal'
                            })
                        }
                    },
                    {
                        type: 'line', label: '전일가', yAxisID: 'y1', order: 1,
                        borderColor: colorPrevPrice,
                        data: data.map(item => parseFloat(item['전일가']?.replace('$', ''))),
                        tension: 0.4, borderWidth: 2, fill: false,
                        datalabels: {
                            display: true,
                            align: 'top', color: textColor,
                            formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                            font: { size: lineLabelSize }
                        }
                    },
                    {
                        type: 'line', label: '당일가', yAxisID: 'y1', order: 1,
                        borderColor: colorCurrentPrice,
                        data: data.map(item => parseFloat(item['당일가']?.replace('$', ''))),
                        tension: 0.4, borderWidth: 2, fill: false,
                        datalabels: {
                            display: true,
                            align: 'bottom', color: textColor,
                            formatter: (value) => value ? `$${value.toFixed(2)}` : null,
                            font: { size: lineLabelSize }
                        }
                    }
                ]
            };
            chartOptions.value = {
                maintainAspectRatio: false,
                aspectRatio: isDesktop.value ? (16 / 9) : (4 / 3),
                plugins: {
                    legend: { display: false },
                    // 👇 [핵심 수정] 여기도 동일하게 전역 설정을 제거합니다.
                    tooltip: {
                        mode: 'index', intersect: false,
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
        }
    };

    return {
        chartData,
        chartOptions,
        updateChart: setChartDataAndOptions
    };
}