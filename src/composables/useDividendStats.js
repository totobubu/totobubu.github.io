// src/composables/useDividendStats.js
import { computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';

/**
 * 배당 내역을 기반으로 배당 통계와 연간 배당 횟수를 계산하는 컴포저블
 * @param {import('vue').Ref<Array>} dividendHistoryRef - 배당 내역 배열을 담고 있는 ref
 * @param {import('vue').Ref<Object>} tickerInfoRef - 티커 정보를 담고 있는 ref
 * @param {import('vue').Ref<String>} periodRef - 계산에 참고할 기간 ('5', '10', '20', 'ALL')
 * @returns {{ dividendStats: ComputedRef<{min: number, max: number, avg: number}>, payoutsPerYear: ComputedRef<number> }}
 */
export function useDividendStats(dividendHistoryRef, tickerInfoRef, periodRef) {
    const payoutsPerYear = computed(() => {
        // [수정] dividendHistory가 undefined일 경우를 대비한 방어 코드 추가
        if (
            !dividendHistory ||
            !dividendHistory.value ||
            dividendHistory.value.length === 0
        ) {
            return 0;
        }
        if (
            !Array.isArray(dividendHistoryRef.value) ||
            dividendHistoryRef.value.length === 0
        ) {
            return 0;
        }

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const pastYearDividends = dividendHistoryRef.value.filter(
            (d) => parseYYMMDD(d['배당락']) > oneYearAgo
        );

        if (pastYearDividends.length > 0) return pastYearDividends.length;

        const freq = tickerInfoRef.value?.frequency;
        if (freq === '분기') return 4;
        if (freq === '매주') return 52;
        if (freq === '매년') return 1;
        return 12; // 기본 월배당으로 가정
    });

    const dividendStats = computed(() => {
        // [안정성 강화] dividendHistoryRef.value가 배열이 아니면 기본값 반환
        // [수정] dividendHistory가 undefined일 경우를 대비한 방어 코드 추가
        if (!dividendHistory || !dividendHistory.value) {
            return { min: 0, max: 0, avg: 0 };
        }
        if (!Array.isArray(dividendHistoryRef.value)) {
            return { min: 0, max: 0, avg: 0 };
        }

        // --- [핵심 로직 변경] 기간 기준 -> 횟수 기준 ---
        let filteredHistory = [];
        const count = parseInt(periodRef.value);

        if (periodRef.value === 'ALL' || isNaN(count)) {
            filteredHistory = dividendHistoryRef.value;
        } else {
            // 최신 배당 데이터부터 count 만큼 자름
            filteredHistory = dividendHistoryRef.value.slice(-count);
        }
        // --- // ---

        const validAmounts = filteredHistory
            .map((h) => parseFloat(h['배당금'])) // '$' 기호는 이미 제거된 순수 숫자 데이터라고 가정
            .filter((a) => !isNaN(a) && a > 0);

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
