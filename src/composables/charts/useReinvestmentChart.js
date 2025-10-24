// src/composables/charts/useReinvestmentChart.js
import { computed } from 'vue';
import { createNumericFormatter } from '@/utils/formatters.js';

export function useReinvestmentChart(options) {
    const {
        currentAssets,
        targetAmount,
        payoutsPerYear,
        dividendStats,
        annualGrowthRateScenario,
        applyTax, // goalAchievementTimes 대신 applyTax 받기
        currentPrice,
        theme,
        currency = 'USD',
    } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency);

    // --- [핵심 수정] goalAchievementTimes 계산 로직을 이 파일로 이동 ---
    const goalAchievementTimes = computed(() => {
        if (
            !dividendStats.value ||
            (dividendStats.value.avg === 0 && dividendStats.value.max === 0)
        ) {
            return { hope: Infinity, avg: Infinity, despair: Infinity };
        }

        const calculateMonths = (dividendPerShare) => {
            if (targetAmount.value <= currentAssets.value) return -1;
            if (
                currentAssets.value <= 0 ||
                dividendPerShare <= 0 ||
                currentPrice.value <= 0 ||
                payoutsPerYear.value <= 0
            ) {
                return Infinity;
            }
            // 여기서 applyTax.value를 직접 사용
            const finalDividendPerShare = applyTax.value
                ? dividendPerShare * 0.85
                : dividendPerShare;
            if (finalDividendPerShare <= 0) return Infinity;

            let assetValue = currentAssets.value;
            let months = 0;
            const monthlyGrowthRate =
                (1 + annualGrowthRateScenario.value) ** (1 / 12) - 1;
            const monthlyPayouts = payoutsPerYear.value / 12;

            while (assetValue < targetAmount.value) {
                if (months > 1200) return Infinity;
                assetValue *= 1 + monthlyGrowthRate;
                const currentShares = assetValue / currentPrice.value;
                const dividendReceived =
                    currentShares * finalDividendPerShare * monthlyPayouts;
                assetValue += dividendReceived;
                months++;
            }
            return months;
        };

        return {
            hope: calculateMonths(dividendStats.value.max),
            avg: calculateMonths(dividendStats.value.avg),
            despair: calculateMonths(dividendStats.value.min),
        };
    });
    // --- // ---

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
                splitLine: {
                    lineStyle: { color: surfaceBorder, type: 'dashed' },
                },
            },
            yAxis: {
                type: 'log',
                axisLabel: {
                    color: textColorSecondary,
                    formatter: (val) => `$${(val / 1000).toFixed(0)}k`,
                },
                splitLine: {
                    lineStyle: { color: surfaceBorder, type: 'dashed' },
                },
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

    return { chartOptions, goalAchievementTimes };
}
