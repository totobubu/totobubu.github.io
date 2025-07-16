// stock/src/composables/useStockChart.js

import { ref } from 'vue';
import { parseYYMMDD } from '@/utils/date.js'; // 유틸리티 함수 import

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
            const prices = data.flatMap(item => [parseFloat(item['전일가']?.replace('$', '')), parseFloat(item['당일가']?.replace('$', ''))]).filter(p => !isNaN(p));
            const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
            const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;
            
            const colorDividend = '#FFC107';// 일반 배당금 (Gold)
            const LineDividend = '#5f5f5f';
            const colorHighlight = '#FB8C00'; // 강조할 배당금 (Vibrant Gold/Orange)
            const colorPrevPrice = '#9E9E9E';
            const colorCurrentPrice = '#212121';

            const lastDataIndex = data.length - 1;

            chartData.value = {
                labels: data.map(item => item['배당락']),
                datasets: [
                    {
                        type: 'bar',
                        label: '배당금',
                        yAxisID: 'y',
                        order: 2,
                        // --- 👇 [수정 1] backgroundColor를 함수로 변경 ---
                        backgroundColor: function(context) {
                            // 현재 데이터의 인덱스가 마지막 인덱스와 같으면 강조 색상을, 아니면 일반 색상을 반환
                            return context.dataIndex === lastDataIndex ? colorHighlight : colorDividend;
                        },
                        data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
                        datalabels: { 
                            display: isDesktop.value, 
                            anchor: 'end', 
                            align: 'end', 
                            color: textColor,
                            formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null, 
                            // --- 👇 [수정 2] font를 함수로 변경 ---
                            font: function(context) {
                                const isLast = context.dataIndex === lastDataIndex;
                                return {
                                    // 마지막 데이터일 경우 폰트 크기를 키우고 볼드체로 설정
                                    size: isLast ? individualLabelSize + 4 : individualLabelSize,
                                    weight: isLast ? 'bold' : 'normal'
                                };
                            }
                        }
                    },
                    {
                        type: 'line',
                        label: '전일가',
                        yAxisID: 'y1',
                        order: 1,
                        borderColor: colorPrevPrice,
                        data: data.map(item => parseFloat(item['전일가']?.replace('$', ''))),
                        tension: 0.4, borderWidth: 2, fill: false,
                        datalabels: { display: isDesktop.value, align: 'top', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
                    },
                    {
                        type: 'line',
                        label: '당일가',
                        yAxisID: 'y1',
                        order: 1,
                        borderColor: colorCurrentPrice,
                        data: data.map(item => parseFloat(item['당일가']?.replace('$', ''))),
                        tension: 0.4, borderWidth: 2, fill: false,
                        datalabels: { display: isDesktop.value, align: 'bottom', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
                    }
                ]
            };
            
            chartOptions.value = {
                maintainAspectRatio: false, aspectRatio: 0.6,
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false },
                    tooltip: {
                        mode: 'index', intersect: false,
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