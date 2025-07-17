// stock/src/composables/charts/useWeeklyChart.js
import { parseYYMMDD } from '@/utils/date.js';

export function useWeeklyChart(options) {
    // --- DEBUG ---
    console.log('%c[WeeklyChart Expert] 호출됨!', 'background-color: #4285F4; color: white;');
    
const { data, isDesktop, getDynamicFontSize, selectedTimeRange } = options;
    const { textColor, textColorSecondary, surfaceBorder, zoomOptions } = options.theme;

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
            color: '#fff', font: { size: getDynamicFontSize(selectedTimeRange, isDesktop, 'default'), weight: 'bold' },
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
            offset: -8, font: { size: getDynamicFontSize(selectedTimeRange, isDesktop, 'total'), weight: 'bold' }
        }
    });

    const weeklyChartData = { labels, datasets };
    const maxTotal = Math.max(0, ...Object.values(monthlyAggregated).map(m => m.total));
    const yAxisMax = maxTotal * 1.25;

    // --- DEBUG ---
    // JSON.stringify 대신 원본 객체를 그대로 출력하여 모든 속성을 확인
    console.log('%c[WeeklyChart Expert] 생성된 최종 데이터셋 객체:', 'color: orange; font-weight: bold;', datasets);

    const weeklyChartOptions = {
        maintainAspectRatio: false,
        aspectRatio: isDesktop ? (16 / 9) : (4 / 3),
        plugins: {
            title: { display: false },
            tooltip: { mode: 'index', intersect: false, callbacks: {
                filter: item => item.raw > 0 && item.dataset.label !== 'Total',
                footer: items => 'Total: $' + items.reduce((sum, i) => sum + i.raw, 0).toFixed(4),
            }},
            legend: { display: false },
            // 👇 [핵심 수정] 여기에 datalabels 전역 설정을 다시 추가합니다.
            datalabels: {
                // 이 설정은 "마스터 스위치를 켜고, 기본 포맷은 각 데이터셋에 맡긴다"는 의미입니다.
                display: true,
                formatter: () => null, // 전역 formatter는 비워두어 개별 설정을 우선시
            },
            zoom: zoomOptions
        },
        scales: {
            x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
            y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder }, max: yAxisMax }
        }
    };


    return { weeklyChartData, weeklyChartOptions };
}