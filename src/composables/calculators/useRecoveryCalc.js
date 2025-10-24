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
    } = shared;

    // userBookmark가 Proxy(Object)이므로 .value 없이 직접 접근
    const accumulatedDividend = ref(userBookmark?.accumulatedDividend || 0);
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

    // useRecoveryChart에서 반환된 computed ref를 그대로 사용
    const { recoveryTimes: calculatedRecoveryTimes, chartOptions } = useRecoveryChart({
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
    
    // [핵심 수정] computed ref의 .value가 null/undefined일 경우를 대비해 기본 객체를 반환하는 새로운 computed 생성
    const recoveryTimes = computed(() => {
        return calculatedRecoveryTimes.value || {
            hope_reinvest: Infinity,
            avg_reinvest: Infinity,
            despair_reinvest: Infinity,
            hope_no_reinvest: Infinity,
            avg_no_reinvest: Infinity,
            despair_no_reinvest: Infinity,
        };
    });


    return {
        accumulatedDividend,
        recoveryCalcMode,
        recoveryRate,
        recoveryTimes, // 항상 안전한 객체를 반환하는 computed
        recoveryChartOptions: chartOptions,
    };
}
