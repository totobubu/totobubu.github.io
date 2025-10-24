import { computed } from 'vue';
import { useRecoveryChart } from '@/composables/charts/useRecoveryChart.js';

export function useRecoveryCalc({ avgPrice, quantity, accumulatedDividend, dividendStats, payoutsPerYear, applyTax, currentPrice, currency, chartTheme }) {
    const investmentPrincipal = computed(() => (quantity.value || 0) * (avgPrice.value || 0));
    
    const recoveryRate = computed({
        get: () => investmentPrincipal.value === 0 ? 0 : (accumulatedDividend.value / investmentPrincipal.value) * 100,
        set: (val) => { accumulatedDividend.value = investmentPrincipal.value * (val / 100); },
    });

    const { recoveryTimes, chartOptions: recoveryChartOptions } = useRecoveryChart({
        avgPrice, quantity, accumulatedDividend, dividendStats, payoutsPerYear, applyTax, currentPrice, currency, theme: chartTheme,
    });

    return {
        recoveryRate,
        recoveryTimes,
        recoveryChartOptions,
    };
}