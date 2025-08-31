// src\composables\useDividendStats.js
import { computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';

/**
 * 배당 내역을 기반으로 배당 통계(min, max, avg)와 연간 배당 횟수를 계산하는 컴포저블
 * @param {import('vue').Ref<Array>} dividendHistory - 배당 내역 배열을 담고 있는 ref
 * @param {import('vue').Ref<Object>} tickerInfo - 티커 정보를 담고 있는 ref
 * @param {import('vue').Ref<String>} periodRef - 계산에 참고할 기간 ('3M', '6M', '1Y')을 담고 있는 ref
 * @returns {{ dividendStats: ComputedRef<{min: number, max: number, avg: number}>, payoutsPerYear: ComputedRef<number> }}
 */
export function useDividendStats(dividendHistory, tickerInfo, periodRef) {
    const payoutsPerYear = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0)
            return 0;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const pastYearDividends = dividendHistory.value.filter(
            (d) => parseYYMMDD(d['배당락']) > oneYearAgo
        );

        if (pastYearDividends.length > 0) return pastYearDividends.length;

        const freq = tickerInfo.value?.frequency;
        if (freq === '분기') return 4;
        if (freq === '매주') return 52;
        return 12;
    });

    const dividendStats = computed(() => {
        if (!dividendHistory.value) return { min: 0, max: 0, avg: 0 };

        const filtered = dividendHistory.value.filter((item) => {
            const now = new Date();
            let cutoffDate = new Date();
            const rangeValue = parseInt(periodRef.value);
            const rangeUnit = periodRef.value.slice(-1);
            if (rangeUnit === 'M')
                cutoffDate.setMonth(now.getMonth() - rangeValue);
            else cutoffDate.setFullYear(now.getFullYear() - rangeValue);
            return parseYYMMDD(item['배당락']) >= cutoffDate;
        });

        const validAmounts = filtered
            .map((h) => parseFloat(h['배당금']?.replace('$', '')))
            .filter((a) => !isNaN(a) && a > 0);

        if (validAmounts.length === 0) return { min: 0, max: 0, avg: 0 };

        return {
            min: Math.min(...validAmounts),
            max: Math.max(...validAmounts),
            avg: validAmounts.reduce((s, a) => s + a, 0) / validAmounts.length,
        };
    });

    return { dividendStats, payoutsPerYear };
}
