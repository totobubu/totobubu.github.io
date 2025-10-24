import { ref, computed, watch  } from 'vue';
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
    } = shared;

    const accumulatedDividend = ref(
        userBookmark.value?.accumulatedDividend || 0
    );
    const recoveryCalcMode = ref('amount');

    const recoveryRate = computed({
        get: () =>
            shared.investmentPrincipal.value === 0
                ? 0
                : (accumulatedDividend.value /
                      shared.investmentPrincipal.value) *
                  100,
        set: (val) => {
            accumulatedDividend.value =
                shared.investmentPrincipal.value * (val / 100);
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

    // [Debug] 최종 계산 결과 확인
    watch(
        recoveryTimes,
        (newTimes) => {
            console.log('[Debug] Recovery times calculated:', newTimes);
        },
        { immediate: true, deep: true }
    );

    return {
        accumulatedDividend,
        recoveryCalcMode,
        recoveryRate,
        recoveryTimes,
        recoveryChartOptions: chartOptions,
    };
}
