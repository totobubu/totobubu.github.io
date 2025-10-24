// src\composables\useDividendStats.js
import { computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';

/**
 * 배당 내역을 기반으로 배당 통계와 연간 배당 횟수를 계산하는 컴포저블
 * @param {import('vue').Ref<Array>} dividendHistory - 배당 내역 배열을 담고 있는 ref
 * @param {import('vue').Ref<Object>} tickerInfo - 티커 정보를 담고 있는 ref
 * @param {import('vue').Ref<String>} periodRef - 계산에 참고할 기간 ('5', '10', '20', 'ALL')
 * @returns {{ dividendStats: ComputedRef<{min: number, max: number, avg: number}>, payoutsPerYear: ComputedRef<number> }}
 */
export function useDividendStats(dividendHistory, tickerInfo, periodRef) {
    const payoutsPerYear = computed(() => {
        // [수정] 변수명을 'dividendHistory'로 통일하고, ?. 체이닝으로 안정성 강화
        if (!dividendHistory?.value?.length) {
            return 0;
        }

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const pastYearDividends = dividendHistory.value.filter(
            (d) => parseYYMMDD(d['배당락']) > oneYearAgo
        );

        if (pastYearDividends.length > 0) return pastYearDividends.length;

        // [수정] 변수명을 'tickerInfo'로 통일
        const freq = tickerInfo.value?.frequency;
        if (freq === '분기') return 4;
        if (freq === '매주') return 52;
        if (freq === '매년') return 1;
        return 12; // 기본 월배당으로 가정
    });

    const dividendStats = computed(() => {
        // [수정] 변수명을 'dividendHistory'로 통일하고, ?. 체이닝으로 안정성 강화
        if (!dividendHistory?.value?.length) {
            return { min: 0, max: 0, avg: 0 };
        }

        let filteredHistory = [];
        const count = parseInt(periodRef.value);

        if (periodRef.value === 'ALL' || isNaN(count)) {
            filteredHistory = dividendHistory.value;
        } else {
            // 최신 배당 데이터부터 count 만큼 자름 (배열의 끝에서부터)
            filteredHistory = dividendHistory.value.slice(-count);
        }

        const validAmounts = filteredHistory
            .map((h) => h['배당금']) // StockView.vue에서 이미 숫자로 변환된 데이터를 받음
            .filter((a) => typeof a === 'number' && a > 0);

        if (validAmounts.length === 0) {
            return { min: 0, max: 0, avg: 0 };
        }

        return {
            min: Math.min(...validAmounts),
            max: Math.max(...validAmounts),
            avg: validAmounts.reduce((s, a) => s + a, 0) / validAmounts.length,
        };
    });

    return { dividendStats, payoutsPerYear };
}
