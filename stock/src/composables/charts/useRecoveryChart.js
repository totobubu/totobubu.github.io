import { computed } from 'vue';

export function useRecoveryChart(options) {
    const {
        myAveragePrice,
        myShares,
        recoveryRate,
        dividendStats,
        payoutsPerYear,
        applyTax,
        currentPrice,
        theme,
    } = options;

    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const formatMonthsToYearsForLabel = (totalMonths) => {
        if (totalMonths === Infinity || isNaN(totalMonths) || totalMonths <= 0)
            return '';
        const years = Math.floor(totalMonths / 12);
        const months = Math.round(totalMonths % 12);
        return years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
    };

    const totalInvestment = computed(
        () => (myAveragePrice.value || 0) * (myShares.value || 0)
    );
    const remainingPrincipal = computed(
        () => totalInvestment.value * (1 - (recoveryRate.value || 0) / 100)
    );

    const recoveryTimes = computed(() => {
        const results = {};
        const scenarios = ['hope', 'avg', 'despair'];
        const statsMap = { hope: 'max', avg: 'avg', despair: 'min' };

        scenarios.forEach((scenario) => {
            const dividendPerShare = dividendStats.value[statsMap[scenario]];

            if (
                (myShares.value || 0) <= 0 ||
                dividendPerShare <= 0 ||
                payoutsPerYear.value <= 0 ||
                remainingPrincipal.value <= 0
            ) {
                results[`${scenario}_reinvest`] = 0;
                results[`${scenario}_no_reinvest`] = 0;
                return;
            }

            const finalDividend = applyTax.value
                ? dividendPerShare * 0.85
                : dividendPerShare;
            if (finalDividend <= 0) {
                results[`${scenario}_reinvest`] = Infinity;
                results[`${scenario}_no_reinvest`] = Infinity;
                return;
            }

            const totalDividendPerPayout_noReinvest =
                myShares.value * finalDividend;
            const payoutsNoReinvest =
                remainingPrincipal.value / totalDividendPerPayout_noReinvest;
            results[`${scenario}_no_reinvest`] =
                (payoutsNoReinvest * 12) / payoutsPerYear.value;

            let currentShares = myShares.value;
            let recoveredAmount = 0;
            let payoutsReinvest = 0;
            const priceForReinvest = currentPrice.value;

            if (priceForReinvest > 0) {
                while (recoveredAmount < remainingPrincipal.value) {
                    if (payoutsReinvest > payoutsPerYear.value * 100) {
                        payoutsReinvest = Infinity;
                        break;
                    }
                    const dividendReceived = currentShares * finalDividend;
                    recoveredAmount += dividendReceived;
                    const newShares = dividendReceived / priceForReinvest;
                    currentShares += newShares;
                    payoutsReinvest++;
                }
                results[`${scenario}_reinvest`] =
                    (payoutsReinvest * 12) / payoutsPerYear.value;
            } else {
                results[`${scenario}_reinvest`] = Infinity;
            }
        });
        return results;
    });

    const recoveryChartData = computed(() => {
        const times = recoveryTimes.value;
        return {
            labels: ['희망', '평균', '절망'],
            datasets: [
                {
                    label: '재투자 O (복리)',
                    data: [
                        times.hope_reinvest,
                        times.avg_reinvest,
                        times.despair_reinvest,
                    ].map((t) => (t > 0 ? t : 0)),
                    backgroundColor: '#22c55e',
                },
                {
                    label: '재투자 X (단리)',
                    data: [
                        times.hope_no_reinvest,
                        times.avg_no_reinvest,
                        times.despair_no_reinvest,
                    ].map((t) => (t > 0 ? t : 0)),
                    backgroundColor: '#64748b',
                },
            ],
        };
    });

    const recoveryChartOptions = computed(() => {
        const allTimes = Object.values(recoveryTimes.value);
        const maxTime =
            allTimes.length > 0
                ? Math.max(...allTimes.filter((t) => t !== Infinity && t > 0))
                : 0;
        const yAxisMax = maxTime > 0 ? Math.ceil(maxTime / 6) * 6 : 12;

        return {
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor } },
                tooltip: {
                    callbacks: {
                        label: (context) =>
                            ` ${formatMonthsToYearsForLabel(context.raw)}`,
                    },
                },
                datalabels: {
                    color: '#ffffff',
                    anchor: 'end',
                    align: 'end',
                    offset: -4,
                    font: { weight: 'bold', size: 10 },
                    formatter: (value) => formatMonthsToYearsForLabel(value),
                },
            },
            scales: {
                x: {
                    ticks: { color: textColorSecondary },
                    grid: { color: surfaceBorder },
                },
                y: {
                    beginAtZero: true,
                    max: yAxisMax,
                    ticks: {
                        color: textColorSecondary,
                        callback: (value) => `${value.toFixed(0)}개월`,
                    },
                    grid: { color: surfaceBorder },
                },
            },
        };
    });

    return { recoveryTimes, recoveryChartData, recoveryChartOptions };
}
