// src\composables\calculators\useReinvestmentGoal.js
import { computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';

export function useReinvestmentGoal(props, options) {
    const {
        ownedShares,
        targetAmount,
        reinvestmentPeriod,
        dividendStats, // 배당 시나리오를 직접 받음
        annualGrowthRateScenario,
    } = options;

    const currentPrice = computed(() => {
        if (!props.dividendHistory || props.dividendHistory.length === 0)
            return 0;
        const latestRecord = props.dividendHistory.find(
            (r) => r['당일종가'] && r['당일종가'] !== 'N/A'
        );
        return latestRecord
            ? parseFloat(latestRecord['당일종가'].replace('$', '')) || 0
            : 0;
    });

    const currentAssets = computed(() => {
        if (!ownedShares.value || currentPrice.value <= 0) return 0;
        return ownedShares.value * currentPrice.value;
    });

    const payoutsPerYear = computed(() => {
        if (!props.dividendHistory || props.dividendHistory.length === 0)
            return 0;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const pastYear = props.dividendHistory.filter(
            (i) => parseYYMMDD(i['배당락']) >= oneYearAgo
        );
        if (pastYear.length > 0) return pastYear.length;
        const freq = props.tickerInfo?.frequency;
        return freq === '매주' ? 52 : freq === '분기' ? 4 : 12;
    });

    const calculateGoalTime = (dividendPerShare) => {
        if (
            currentAssets.value <= 0 ||
            targetAmount.value <= currentAssets.value ||
            dividendPerShare <= 0 ||
            currentPrice.value <= 0 ||
            payoutsPerYear.value <= 0
        ) {
            return 0;
        }
        let currentAssetValue = currentAssets.value;
        let months = 0;
        const monthlyGrowthRate =
            (1 + annualGrowthRateScenario.value) ** (1 / 12) - 1;

        while (currentAssetValue < targetAmount.value) {
            if (months > 1200) return Infinity; // 100년 초과 시 계산 중단

            currentAssetValue *= 1 + monthlyGrowthRate;
            const currentShares = currentAssetValue / currentPrice.value;
            const dividendReceived =
                currentShares * dividendPerShare * (payoutsPerYear.value / 12);
            currentAssetValue += dividendReceived;
            months++;
        }
        return months;
    };

    const goalAchievementTimes = computed(() => ({
        hope: calculateGoalTime(dividendStats.value.max),
        avg: calculateGoalTime(dividendStats.value.avg),
        despair: calculateGoalTime(dividendStats.value.min),
    }));

    return { currentAssets, goalAchievementTimes };
}
