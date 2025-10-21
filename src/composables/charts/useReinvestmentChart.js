// src\composables\charts\useReinvestmentChart.js
import { computed } from 'vue';
import { createNumericFormatter } from '@/utils/formatters.js';

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
        currency = 'USD',
    } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency);

    const calculateGrowthPath = (dividendPerShare, maxMonths) => {
        if (
            currentAssets.value <= 0 ||
            dividendPerShare <= 0 ||
            currentPrice.value <= 0 ||
            payoutsPerYear.value <= 0
        )
            return [];
        let assetValue = currentAssets.value,
            months = 0;
        const monthlyGrowthRate =
            (1 + annualGrowthRateScenario.value) ** (1 / 12) - 1;
        const monthlyPayouts = payoutsPerYear.value / 12;
        const path = [[0, assetValue]];
        while (months < maxMonths) {
            months++;
            assetValue *= 1 + monthlyGrowthRate;
            assetValue +=
                (assetValue / currentPrice.value) *
                dividendPerShare *
                monthlyPayouts;
            path.push([months, assetValue]);
            if (assetValue >= targetAmount.value) break;
        }
        return path;
    };

    const chartData = computed(() => ({}));

    const chartOptions = computed(() => {
        if (
            !dividendStats.value ||
            !goalAchievementTimes.value ||
            !isFinite(goalAchievementTimes.value.avg) ||
            goalAchievementTimes.value.avg <= 0
        ) {
            return {
                title: {
                    text: '계산 불가',
                    left: 'center',
                    top: 'center',
                    textStyle: { color: textColorSecondary },
                },
            };
        }
        const avgMonths = Math.ceil(goalAchievementTimes.value.avg);
        return {
            tooltip: {
                trigger: 'axis',
                formatter: (params) =>
                    `${params[0].value[0]}개월 후<br/>${params.map((p) => `${p.marker} ${p.seriesName}: <strong>${formatCurrency(p.value[1])}</strong>`).join('<br/>')}`,
            },
            legend: {
                data: ['희망', '평균', '절망'],
                textStyle: { color: textColorSecondary },
                bottom: 0,
            },
            grid: {
                left: '3%',
                right: '10%',
                bottom: '10%',
                containLabel: true,
            },
            xAxis: {
                type: 'value',
                min: 0,
                max: avgMonths,
                axisLabel: {
                    color: textColorSecondary,
                    formatter: '{value}개월',
                },
                splitLine: { lineStyle: { color: surfaceBorder } },
            },
            yAxis: {
                type: 'logarithmic',
                axisLabel: {
                    color: textColorSecondary,
                    formatter: (val) =>
                        formatCurrency(val).replace(/(\.00|₩|,)/g, '')[0] +
                        (String(val).length > 4 ? '...' : ''),
                },
                splitLine: { lineStyle: { color: surfaceBorder } },
            },
            series: [
                {
                    name: '희망',
                    type: 'line',
                    showSymbol: false,
                    data: calculateGrowthPath(
                        dividendStats.value.max,
                        avgMonths
                    ),
                    lineStyle: { color: '#22c55e' },
                },
                {
                    name: '평균',
                    type: 'line',
                    showSymbol: false,
                    data: calculateGrowthPath(
                        dividendStats.value.avg,
                        avgMonths
                    ),
                    lineStyle: { color: '#eab308' },
                },
                {
                    name: '절망',
                    type: 'line',
                    showSymbol: false,
                    data: calculateGrowthPath(
                        dividendStats.value.min,
                        avgMonths
                    ),
                    lineStyle: { color: '#ef4444' },
                },
            ],
            graphic: [
                {
                    type: 'text',
                    left: 'center',
                    top: 'center',
                    style: {
                        text:
                            targetAmount.value > currentAssets.value
                                ? ''
                                : '목표 달성 완료',
                        fill: textColor,
                        fontSize: 20,
                    },
                },
            ],
        };
    });

    return { chartData, chartOptions };
}
