import { ref, computed } from 'vue';
import { useRecoveryChart } from '@/composables/charts/useRecoveryChart.js';

export function useRecoveryCalc(commonState) {
    const {
        avgPrice,
        quantity,
        dividendStats,
        payoutsPerYear,
        applyTax,
        currentPrice,
        currency,
        chartTheme,
        userBookmark,
    } = commonState;

    // --- State ---
    const accumulatedDividend = ref(
        userBookmark.value?.accumulatedDividend || 0
    );
    const recoveryCalcMode = ref('amount');

    // --- Computed ---
    const investmentPrincipal = computed(
        () => (quantity.value || 0) * (avgPrice.value || 0)
    );
    const recoveryRate = computed({
        get: () =>
            investmentPrincipal.value === 0
                ? 0
                : (accumulatedDividend.value / investmentPrincipal.value) * 100,
        set: (val) => {
            accumulatedDividend.value = investmentPrincipal.value * (val / 100);
        },
    });

    // --- Chart ---
    const { recoveryTimes, chartOptions: recoveryChartOptions } =
        useRecoveryChart({
            avgPrice,
            quantity,
            accumulatedDividend,
            dividendStats,
            payoutsPerYear,
            applyTax,
            currentPrice,
            currency,
            theme: chartTheme,
        });

    return {
        accumulatedDividend,
        recoveryCalcMode,
        recoveryRate,
        recoveryTimes,
        recoveryChartOptions,
    };
}
