// src\composables\calculators\useRecoveryCalc.js
import { ref, computed } from 'vue';
import { useRecoveryChart } from '@/composables/charts/useRecoveryChart.js';

export function useRecoveryCalc(shared) {
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
        investmentPrincipal,
    } = shared;

    // [핵심 수정] userBookmark.value로 접근
    const accumulatedDividend = ref(
        userBookmark.value?.accumulatedDividend || 0
    );
    const recoveryCalcMode = ref('amount');

    const recoveryRate = computed({
        get: () =>
            // [핵심 수정] investmentPrincipal.value로 접근
            investmentPrincipal.value === 0
                ? 0
                : (accumulatedDividend.value / investmentPrincipal.value) * 100,
        set: (val) => {
            accumulatedDividend.value = investmentPrincipal.value * (val / 100);
        },
    });

    const { recoveryTimes, chartOptions } = useRecoveryChart({
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
        recoveryChartOptions: chartOptions,
    };
}
