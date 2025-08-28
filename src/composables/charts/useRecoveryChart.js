// src\composables\charts\useRecoveryChart.js
import { computed } from 'vue';
import { formatLargeNumber } from '@/utils/numberFormat.js'; // formatLargeNumber가 아닌 formatMonthsToYearsForLabel 사용 가정

export function useRecoveryChart(options) {
    // --- 1. 받는 prop 이름을 avgPrice, quantity로 수정 ---
    const {
        avgPrice,
        quantity,
        accumulatedDividend,
        dividendStats,
        payoutsPerYear,
        applyTax,
        currentPrice,
        theme,
    } = options;

    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const formatMonthsToYearsForLabel = (totalMonths) => {
        /* ... */
    };

    // --- 2. 사용하는 변수명을 avgPrice, quantity로 수정 ---
    const investmentPrincipal = computed(
        () => (avgPrice.value || 0) * (quantity.value || 0)
    );
    const remainingPrincipal = computed(
        () => investmentPrincipal.value - (accumulatedDividend.value || 0)
    );

    const recoveryTimes = computed(() => {
        // --- 3. 방어 코드 강화 ---
        if (
            !dividendStats ||
            !dividendStats.value ||
            !payoutsPerYear ||
            !currentPrice
        ) {
            return {
                hope_reinvest: 0,
                avg_reinvest: 0,
                despair_reinvest: 0,
                hope_no_reinvest: 0,
                avg_no_reinvest: 0,
                despair_no_reinvest: 0,
            };
        }

        const results = {};
        const scenarios = ['hope', 'avg', 'despair'];
        const statsMap = { hope: 'max', avg: 'avg', despair: 'min' };

        scenarios.forEach((scenario) => {
            const dividendPerShare = dividendStats.value[statsMap[scenario]];

            if (
                (quantity.value || 0) <= 0 ||
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

            // --- 4. 사용하는 변수명을 quantity로 수정 ---
            const totalDividendPerPayout_noReinvest =
                quantity.value * finalDividend;
            const payoutsNoReinvest =
                remainingPrincipal.value / totalDividendPerPayout_noReinvest;
            results[`${scenario}_no_reinvest`] =
                (payoutsNoReinvest * 12) / payoutsPerYear.value;

            let currentShares = quantity.value;
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
        if (!recoveryTimes.value) return { labels: [], datasets: [] }; // 방어 코드
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
                    backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
                    borderColor: ['#16a34a', '#ca8a04', '#dc2626'],
                    borderWidth: 2,
                },
                {
                    label: '재투자 X (단리)',
                    data: [
                        times.hope_no_reinvest,
                        times.avg_no_reinvest,
                        times.despair_no_reinvest,
                    ].map((t) => (t > 0 ? t : 0)),
                    backgroundColor: ['#22c55e80', '#eab30880', '#ef444480'], // 반투명 색상
                    borderColor: ['#16a34a', '#ca8a04', '#dc2626'],
                    borderWidth: 1,
                    borderDash: [5, 5],
                },
            ],
        };
    });

    const recoveryChartOptions = computed(() => {
        if (!recoveryTimes.value) return {}; // 방어 코드
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
