import { computed } from 'vue';

export function useRecoveryChart(options) {
    const { 
        investmentAmount, 
        sharesToBuy, 
        dividendStats, 
        payoutsPerYear, 
        applyTax,
        theme 
    } = options;
    
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const formatMonthsToYearsForLabel = (totalMonths) => {
        if (totalMonths === Infinity || isNaN(totalMonths) || totalMonths <= 0) return '';
        const years = Math.floor(totalMonths / 12);
        const months = Math.round(totalMonths % 12);
        if (years > 0) return `${years}년 ${months}개월`;
        return `${months}개월`;
    };

    const calculateRecoveryMonths = (dividendPerShare) => {
        if (sharesToBuy.value <= 0 || dividendPerShare <= 0 || payoutsPerYear.value <= 0) return 0;
        const finalDividend = applyTax.value ? dividendPerShare * 0.85 : dividendPerShare;
        if (finalDividend <= 0) return 0;
        
        const totalDividendPerPayout = sharesToBuy.value * finalDividend;
        const payoutsToRecover = investmentAmount.value / totalDividendPerPayout;
        return (payoutsToRecover * 12) / payoutsPerYear.value;
    };

    const recoveryTimes = computed(() => ({
        hope: calculateRecoveryMonths(dividendStats.value.max),
        avg: calculateRecoveryMonths(dividendStats.value.avg),
        despair: calculateRecoveryMonths(dividendStats.value.min),
    }));

    const recoveryChartData = computed(() => {
        const times = recoveryTimes.value;
        const dataPoints = [
            times.hope > 0 ? times.hope : 0,
            times.avg > 0 ? times.avg : 0,
            times.despair > 0 ? times.despair : 0
        ];

        return {
            labels: ['희망 (최고 배당)', '평균', '절망 (최저 배당)'],
            datasets: [{
                label: '원금 회수 기간 (개월)',
                data: dataPoints,
                backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
                borderColor: ['#16a34a', '#ca8a04', '#dc2626'],
                borderWidth: 1,
                datalabels: {
                    color: '#ffffff',
                    anchor: 'center',
                    align: 'top',
                    offset: 4,
                    font: {
                        weight: 'bold'
                    },
                    formatter: (value) => formatMonthsToYearsForLabel(value),
                }
            }]
        };
    });

    const recoveryChartOptions = computed(() => {
        const maxTime = Math.max(...recoveryChartData.value.datasets[0].data);
        // [핵심 수정] max 값을 5의 배수로 올림 처리하여 깔끔하게 만듭니다.
        const yAxisMax = maxTime > 0 ? Math.ceil(maxTime / 5) * 5 : 12;

        return {
            maintainAspectRatio: false,
            aspectRatio: 1.5,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const months = context.raw;
                            return ` ${formatMonthsToYearsForLabel(months)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: surfaceBorder }
                },
                y: {
                    beginAtZero: true,
                    max: yAxisMax,
                    ticks: { 
                        color: textColor,
                        stepSize: 5, // Y축 눈금 단위를 5로 고정
                        callback: (value) => `${value}개월`
                    },
                    grid: { color: surfaceBorder }
                }
            }
        };
    });

    return { recoveryTimes, recoveryChartData, recoveryChartOptions };
}