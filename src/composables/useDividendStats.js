// src/composables/useDividendStats.js

import { computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';

/**
 * 배당 내역을 기반으로 배당 통계(min, max, avg)와 연간 배당 횟수를 계산하는 컴포저블
 * @param {import('vue').Ref<Array>} dividendHistory - 배당 내역 배열을 담고 있는 ref
 * @param {import('vue').Ref<Object>} tickerInfo - 티커 정보를 담고 있는 ref
 * @param {import('vue').Ref<String>} periodRef - 계산에 참고할 기간 ('5', '10', '20', 'ALL') 또는 ('3M', '6M', '1Y')을 담고 있는 ref
 * @returns {{ dividendStats: ComputedRef<{min: number, max: number, avg: number}>, payoutsPerYear: ComputedRef<number> }}
 */
export function useDividendStats(dividendHistory, tickerInfo, periodRef) {
    const payoutsPerYear = computed(() => {
        // ... (이 부분은 수정할 필요 없습니다)
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

    // --- [핵심 수정 영역] ---
    const dividendStats = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) {
            return { min: 0, max: 0, avg: 0 };
        }

        const period = periodRef.value;
        let filteredHistory = [];

        // 1. 기간 타입(횟수 vs 시간)을 감지하여 분기 처리
        if (!isNaN(parseInt(period))) {
            // '5', '10', '20' 과 같은 숫자 형식일 경우
            const count = parseInt(period, 10);
            // dividendHistory는 최신순으로 정렬되어 있으므로 slice로 간단히 처리
            filteredHistory = dividendHistory.value.slice(0, count);
        } else if (period === 'ALL') {
            // 'ALL'일 경우 전체 기록 사용
            filteredHistory = dividendHistory.value;
        } else {
            // '3M', '6M', '1Y' 와 같은 기존 시간 형식일 경우 (하위 호환성)
            const now = new Date();
            let cutoffDate = new Date();
            const rangeValue = parseInt(period);
            const rangeUnit = period.slice(-1);

            if (rangeUnit === 'M') {
                cutoffDate.setMonth(now.getMonth() - rangeValue);
            } else if (rangeUnit === 'Y') {
                cutoffDate.setFullYear(now.getFullYear() - rangeValue);
            }
            
            filteredHistory = dividendHistory.value.filter(
                (item) => parseYYMMDD(item['배당락']) >= cutoffDate
            );
        }
        
        // 2. 필터링된 기록으로 통계 계산
        const validAmounts = filteredHistory
            .map((h) => parseFloat(String(h['배당금']).replace(/[$,₩]/g, '')))
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
    // --- [수정 완료] ---

    return { dividendStats, payoutsPerYear };
}