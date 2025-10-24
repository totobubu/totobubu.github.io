import { ref, computed } from 'vue';
import { useReinvestmentChart } from '@/composables/charts/useReinvestmentChart.js';

export function useReinvestmentCalc(commonState) {
    const {
        currentAssets,
        dividendStats,
        payoutsPerYear,
        applyTax, // applyTax 추가
        currentPrice,
        isUSD,
        currency,
        chartTheme,
        userBookmark,
    } = commonState;

    // --- State ---
    const targetAsset = ref(
        userBookmark.value?.targetAsset || (isUSD.value ? 100000 : 100000000)
    );
    const annualGrowthRate = ref(0);

    // --- Computed ---
    const growthRateForCalc = computed(() => annualGrowthRate.value / 100);

    // [핵심 수정] goalAchievementTimes를 computed로 감싸서 에러 방지
    const goalAchievementTimes = computed(() => {
        if (
            !dividendStats.value ||
            (dividendStats.value.avg === 0 && dividendStats.value.max === 0)
        ) {
            return { hope: Infinity, avg: Infinity, despair: Infinity };
        }

        const calculateMonths = (dividendPerShare) => {
            if (targetAsset.value <= currentAssets.value) return -1;
            if (
                currentAssets.value <= 0 ||
                dividendPerShare <= 0 ||
                currentPrice.value <= 0 ||
                payoutsPerYear.value <= 0
            ) {
                return Infinity;
            }
            const finalDividendPerShare = applyTax.value
                ? dividendPerShare * 0.85
                : dividendPerShare;
            if (finalDividendPerShare <= 0) return Infinity;

            let assetValue = currentAssets.value;
            let months = 0;
            const monthlyGrowthRate =
                (1 + growthRateForCalc.value) ** (1 / 12) - 1;
            const monthlyPayouts = payoutsPerYear.value / 12;

            while (assetValue < targetAsset.value) {
                if (months > 1200) return Infinity; // 무한 루프 방지
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

    // --- Chart ---
    const { chartOptions: reinvestmentChartOptions } = useReinvestmentChart({
        currentAssets,
        targetAmount: targetAsset,
        payoutsPerYear,
        dividendStats,
        annualGrowthRateScenario: growthRateForCalc,
        currentPrice,
        goalAchievementTimes, // computed를 그대로 전달
        currency,
        theme: chartTheme,
    });

    return {
        targetAsset,
        annualGrowthRate,
        growthRateForCalc,
        goalAchievementTimes,
        reinvestmentChartOptions,
    };
}
