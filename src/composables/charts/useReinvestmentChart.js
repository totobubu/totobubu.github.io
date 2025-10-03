import { computed } from 'vue';
import { formatLargeNumber, formatCurrency } from '@/utils/numberFormat.js';
import Annotation from 'chartjs-plugin-annotation';

export function useReinvestmentChart(options) {
    const {
        currentAssets,
        targetAmount,
        payoutsPerYear,
        dividendStats,
        annualGrowthRateScenario,
        currentPrice,
        goalAchievementTimes,
        theme,
        currency,
    } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const calculateGrowthPath = (
        dividendPerShare,
        maxMonths,
        continueOnGoal = false
    ) => {
        if (
            currentAssets.value <= 0 ||
            dividendPerShare <= 0 ||
            currentPrice.value <= 0 ||
            payoutsPerYear.value <= 0
        ) {
            return [];
        }
        let assetValue = currentAssets.value;
        let months = 0;
        const monthlyGrowthRate =
            (1 + annualGrowthRateScenario.value) ** (1 / 12) - 1;
        const monthlyPayouts = payoutsPerYear.value / 12;
        const path = [{ x: 0, y: assetValue }];

        while (months < maxMonths) {
            months++;
            assetValue *= 1 + monthlyGrowthRate;
            const currentShares = assetValue / currentPrice.value;
            const dividendReceived =
                currentShares * dividendPerShare * monthlyPayouts;
            assetValue += dividendReceived;
            path.push({ x: months, y: assetValue });
            if (!continueOnGoal && assetValue >= targetAmount.value) break;
        }
        return path;
    };

    const reinvestmentChartData = computed(() => {
        if (!dividendStats.value || !goalAchievementTimes.value)
            return { datasets: [] };
        const avgMonths = Math.ceil(goalAchievementTimes.value.avg);
        if (!isFinite(avgMonths) || avgMonths <= 0) return { datasets: [] };

        const hopePath = calculateGrowthPath(
            dividendStats.value.max,
            avgMonths,
            true
        );
        const avgPath = calculateGrowthPath(
            dividendStats.value.avg,
            avgMonths,
            false
        );
        const despairPath = calculateGrowthPath(
            dividendStats.value.min,
            avgMonths,
            false
        );

        return {
            datasets: [
                {
                    label: '희망',
                    data: hopePath,
                    borderColor: '#22c55e',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0,
                },
                {
                    label: '평균',
                    data: avgPath,
                    borderColor: '#eab308',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0,
                },
                {
                    label: '절망',
                    data: despairPath,
                    borderColor: '#ef4444',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0,
                },
            ],
        };
    });

    const reinvestmentChartOptions = computed(() => {
        if (
            !goalAchievementTimes.value ||
            !isFinite(goalAchievementTimes.value.avg)
        ) {
            return {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
            };
        }
        const hopeTime = goalAchievementTimes.value.hope;
        const avgTime = goalAchievementTimes.value.avg;
        const xAxisMin =
            isFinite(hopeTime) && hopeTime > 1 ? Math.floor(hopeTime) - 1 : 0;
        const xAxisMax = isFinite(avgTime) ? Math.ceil(avgTime) : 120;

        return {
            maintainAspectRatio: false,
            aspectRatio: 1.5,
            parsing: { xAxisKey: 'x', yAxisKey: 'y' },
            plugins: {
                datalabels: { display: false },
                legend: { position: 'bottom', labels: { color: textColor } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: (tooltipItems) =>
                            `${tooltipItems[0].raw.x}개월 후`,
                        label: (context) =>
                            `${context.dataset.label}: ${formatCurrency(context.raw.y, currency.value)}`,
                    },
                },
                annotation: {
                    annotations: {
                        targetLine: {
                            type: 'line',
                            yMin: targetAmount.value,
                            yMax: targetAmount.value,
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            label: {
                                content: `목표: ${formatCurrency(targetAmount.value, currency.value)}`,
                                display: true,
                                position: 'end',
                                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                            },
                        },
                        hopeTargetPoint: {
                            type: 'point',
                            xValue: hopeTime,
                            yValue: targetAmount.value,
                            backgroundColor: 'rgba(34, 197, 94, 0.8)',
                            radius: 8,
                            borderColor: 'rgba(255, 255, 255, 0.8)',
                            borderWidth: 2,
                        },
                        avgTargetPoint: {
                            type: 'point',
                            xValue: avgTime,
                            yValue: targetAmount.value,
                            backgroundColor: 'rgba(234, 179, 8, 0.8)',
                            radius: 8,
                            borderColor: 'rgba(255, 255, 255, 0.8)',
                            borderWidth: 2,
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    min: xAxisMin,
                    max: xAxisMax,
                    ticks: {
                        color: theme.textColorSecondary,
                        stepSize: Math.max(1, Math.ceil(xAxisMax / 5)),
                        callback: (value) => `${value}개월`,
                    },
                    grid: { color: theme.surfaceBorder },
                },
                y: {
                    type: 'logarithmic',
                    ticks: {
                        color: textColorSecondary,
                        callback: (value) => {
                            if (value === 0) return '0';
                            const log10 = Math.log10(value);
                            if (log10 === Math.floor(log10))
                                return formatCurrency(value, currency.value);
                            return '';
                        },
                    },
                    grid: { color: surfaceBorder },
                },
            },
        };
    });

    return { reinvestmentChartData, reinvestmentChartOptions };
}
