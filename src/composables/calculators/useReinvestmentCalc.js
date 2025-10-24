import { computed } from 'vue';
import { useReinvestmentChart } from '@/composables/charts/useReinvestmentChart.js';

export function useReinvestmentCalc({ currentAssets, dividendStats, payoutsPerYear, applyTax, currentPrice, targetAsset, annualGrowthRate, currency, chartTheme }) {
    const growthRateForCalc = computed(() => annualGrowthRate.value / 100);

    const { goalAchievementTimes, chartOptions: reinvestmentChartOptions } = useReinvestmentChart({
        currentAssets,
        targetAmount: targetAsset,
        payoutsPerYear,
        dividendStats,
        annualGrowthRateScenario: growthRateForCalc,
        applyTax,
        currentPrice,
        currency,
        theme: chartTheme,
    });

    return {
        goalAchievementTimes,
        reinvestmentChartOptions,
    };
}