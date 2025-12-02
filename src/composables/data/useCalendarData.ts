/**
 * useCalendarData V2 - 월별 로딩 + IndexedDB 캐싱
 *
 * 개선사항:
 * 1. 월별 데이터 분할 로딩 (필요한 월만 로드)
 * 2. IndexedDB 캐싱으로 재방문 시 빠른 로딩
 * 3. 점진적 로딩으로 초기 로딩 속도 개선
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { useFilterState } from '@/composables/portfolio/useFilterState';
import { getDataUrl } from '@/utils/dataUrl';
import { stripTickerSuffix } from '@/utils/tickerRoute';
import dbCache from '@/utils/indexedDB';
import { get } from '@/utils/http';
import type {
    CalendarEvent,
    DividendsByDate,
    MonthlyData,
    TickerProperties,
    CalendarCacheData,
} from '@/types/calendar';
import type { Currency } from '@/types/common';

// 전역 상태
const monthlyData = ref<MonthlyData>(new Map());
const allTickerProperties = ref<Map<string, TickerProperties>>(new Map());
const isLoading = ref(false);
const loadingMonths = ref<Set<string>>(new Set());
const error = ref<Error | null>(null);

/**
 * 연-월 범위 생성 (예: 2024-01 ~ 2024-12)
 */
function generateMonthRange(
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number
): string[] {
    const months: string[] = [];
    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        months.push(yearMonth);

        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
    }

    return months;
}

/**
 * 특정 월의 데이터 로드 (캐시 우선)
 */
async function loadMonth(yearMonth: string): Promise<void> {
    // 이미 로딩 중이면 스킵
    if (loadingMonths.value.has(yearMonth)) {
        return;
    }

    // 이미 로드된 데이터가 있으면 스킵
    if (monthlyData.value.has(yearMonth)) {
        return;
    }

    loadingMonths.value.add(yearMonth);

    try {
        // 1. IndexedDB 캐시 확인
        const cached = await dbCache.get<CalendarCacheData>(
            `calendar-v2-${yearMonth}` // v2로 캐시 키 변경하여 이전 캐시 무효화
        );
        if (cached) {
            // 캐시 유효성 검사: 이벤트에 currency와 isEtf 필드가 있는지 확인
            const isValid =
                cached.events.length === 0 ||
                ((cached.events[0] as any).currency !== undefined &&
                 (cached.events[0] as any).isEtf !== undefined);

            if (isValid) {
                console.log(`📅 [useCalendarData] ✓ 캐시에서 로드: ${yearMonth} (${cached.events.length}개 이벤트)`);
                monthlyData.value.set(yearMonth, cached.events);

                // 티커 속성 정보 병합
                cached.tickerProperties.forEach(([key, value]) => {
                    if (!allTickerProperties.value.has(key)) {
                        allTickerProperties.value.set(key, value);
                    }
                });

                loadingMonths.value.delete(yearMonth);
                return;
            } else {
                console.log(`📅 [useCalendarData] ⚠️ 캐시 무효화: ${yearMonth} (isEtf 필드 누락)`);
            }
        }

        // 2. 네트워크에서 fetch (재시도 로직 포함)
        const [year, month] = yearMonth.split('-');
        const url = getDataUrl(`calendar/monthly/${year}/${month}.json`);
        console.log(`📅 [useCalendarData] ⬇️  네트워크에서 로드: ${url}`);

        const response = await get<{
            UsStock?: Record<string, any[]>;
            UsEtf?: Record<string, any[]>;
            KrStock?: Record<string, any[]>;
            KrEtf?: Record<string, any[]>;
        }>(url, {
            __maxRetries: 3, // 최대 3번 재시도
        } as any);

        const monthEvents = response.data;

        // 3. 데이터 변환 (카테고리별 → 배열 형태)
        const flatEvents: CalendarEvent[] = [];
        const tickerPropertiesMap = new Map<string, TickerProperties>();

        const categories = [
            { key: 'UsStock' as const, currency: 'USD' as Currency, isEtf: false },
            { key: 'UsEtf' as const, currency: 'USD' as Currency, isEtf: true },
            { key: 'KrStock' as const, currency: 'KRW' as Currency, isEtf: false },
            { key: 'KrEtf' as const, currency: 'KRW' as Currency, isEtf: true },
        ];

        categories.forEach(({ key, currency, isEtf }) => {
            const categoryData = monthEvents[key];
            if (!categoryData) return;

            // categoryData는 { "2025-12-01": [...], "2025-12-02": [...] } 형태
            Object.entries(categoryData).forEach(([dateStr, events]) => {
                events.forEach((event: any) => {
                    flatEvents.push({
                        ...event,
                        date: dateStr,
                        currency: currency,
                        isEtf: isEtf,
                    });

                    // 티커 속성 정보 수집
                    if (!tickerPropertiesMap.has(event.ticker)) {
                        tickerPropertiesMap.set(event.ticker, {
                            currency: currency,
                            isEtf: isEtf,
                            koName: event.koName,
                        });
                    }
                });
            });
        });

        // 4. 상태 업데이트
        monthlyData.value.set(yearMonth, flatEvents);

        // 티커 속성 병합
        tickerPropertiesMap.forEach((value, key) => {
            if (!allTickerProperties.value.has(key)) {
                allTickerProperties.value.set(key, value);
            }
        });

        // 5. IndexedDB에 캐싱
        await dbCache.set(`calendar-v2-${yearMonth}`, {
            events: flatEvents,
            tickerProperties: Array.from(tickerPropertiesMap.entries()),
        });

        console.log(
            `📅 [useCalendarData] ✓ 캐시 저장 완료: ${yearMonth} (${flatEvents.length}개 이벤트)`
        );
    } catch (err) {
        console.error(`❌ ${yearMonth} 로드 실패:`, err);
        error.value = err as Error;
    } finally {
        loadingMonths.value.delete(yearMonth);
    }
}

/**
 * 특정 기간의 데이터 로드
 */
async function loadDateRange(
    startDate: string,
    endDate: string
): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const months = generateMonthRange(
            start.getFullYear(),
            start.getMonth() + 1,
            end.getFullYear(),
            end.getMonth() + 1
        );

        console.log(
            `📅 [useCalendarData] 로딩할 월: ${months.length}개 (${months[0]} ~ ${months[months.length - 1]})`
        );

        // 병렬로 모든 월 로드
        await Promise.all(months.map((month) => loadMonth(month)));

        console.log(`📅 [useCalendarData] ✅ 데이터 로딩 완료: ${monthlyData.value.size}개 월`);
    } catch (err) {
        console.error('데이터 로드 실패:', err);
        error.value = err as Error;
    } finally {
        isLoading.value = false;
    }
}

/**
 * 특정 월의 데이터를 로드 (외부에서 호출)
 * 캘린더 뷰가 변경될 때마다 필요한 월만 로드
 */
async function loadVisibleMonth(year: number, month: number): Promise<void> {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    console.log(`📅 [useCalendarData] 보이는 월 변경: ${yearMonth}`);
    await loadMonth(yearMonth);
}

/**
 * 현재 월의 데이터만 로드 (초기 로드용)
 */
async function loadCurrentMonth(): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    console.log(`📅 [useCalendarData] 현재 월 로드: ${year}-${String(month).padStart(2, '0')}`);
    await loadVisibleMonth(year, month);
}

/**
 * 날짜별 배당 데이터 (computed)
 */
const dividendsByDate = computed<DividendsByDate>(() => {
    const result: DividendsByDate = {};

    // 모든 월의 데이터를 날짜별로 그룹화
    monthlyData.value.forEach((events) => {
        events.forEach((event) => {
            if (!result[event.date]) {
                result[event.date] = [];
            }
            result[event.date].push(event);
        });
    });

    return result;
});

// useFilterState를 computed 외부에서 한 번만 호출
const { mainFilterTab, subFilterTab, myBookmarks } = useFilterState();

/**
 * 필터링된 배당 데이터
 */
const filteredDividends = computed<DividendsByDate>(() => {
    console.log('📅 [filteredDividends] 필터 시작', {
        mainFilterTab: mainFilterTab.value,
        subFilterTab: subFilterTab.value,
        원본데이터날짜수: Object.keys(dividendsByDate.value).length,
    });

    const result: DividendsByDate = {};
    let totalEvents = 0;
    let filteredCount = 0;
    let sampleLogs = 0;

    Object.entries(dividendsByDate.value).forEach(([date, events]) => {
        const filtered = events.filter((event) => {
            totalEvents++;

            // 처음 5개 이벤트 샘플 로그
            if (sampleLogs < 5) {
                console.log(`📅 [샘플 #${sampleLogs + 1}]`, {
                    ticker: event.ticker,
                    currency: event.currency,
                    isEtf: event.isEtf,
                    mainFilter: mainFilterTab.value,
                    subFilter: subFilterTab.value,
                });
                sampleLogs++;
            }

            // 북마크 필터 (mainFilterTab이 '북마크'일 때만 적용)
            if (mainFilterTab.value === '북마크') {
                const bookmarks = myBookmarks.value || {};
                const bookmarkValues = Object.values(bookmarks);

                if (bookmarkValues.length > 0) {
                    const bookmarkedSymbols = new Set(
                        bookmarkValues
                            .map((b) => b?.symbol?.toUpperCase())
                            .filter(Boolean)
                    );

                    const ticker = event.ticker?.toUpperCase();
                    const symbol = stripTickerSuffix(
                        event.ticker
                    )?.toUpperCase();

                    if (
                        !bookmarkedSymbols.has(ticker) &&
                        !bookmarkedSymbols.has(symbol)
                    ) {
                        return false;
                    }
                } else {
                    // 북마크가 없으면 아무것도 표시하지 않음
                    return false;
                }
            }

            // 시장 필터 (미국/한국)
            if (mainFilterTab.value === '미국' && event.currency !== 'USD') {
                return false;
            }
            if (mainFilterTab.value === '한국' && event.currency !== 'KRW') {
                return false;
            }

            // 유형 필터 (ETF/주식)
            if (subFilterTab.value === 'ETF' && !event.isEtf) {
                return false;
            }
            if (subFilterTab.value === '주식' && event.isEtf) {
                return false;
            }

            filteredCount++;
            return true;
        });

        if (filtered.length > 0) {
            result[date] = filtered;
        }
    });

    console.log('📅 [filteredDividends] 필터 완료', {
        전체이벤트: totalEvents,
        필터후이벤트: filteredCount,
        결과날짜수: Object.keys(result).length,
    });

    return result;
});

/**
 * 캐시 통계 조회
 */
async function getCacheStats() {
    return await dbCache.getStats();
}

/**
 * 캐시 초기화
 */
async function clearCache(): Promise<void> {
    await dbCache.clear();
    monthlyData.value.clear();
    allTickerProperties.value.clear();
    console.log('✓ 캐시 초기화 완료');
}

/**
 * useCalendarData 반환 타입
 */
export interface UseCalendarDataReturn {
    dividendsByDate: ComputedRef<DividendsByDate>;
    isLoading: Ref<boolean>;
    error: Ref<Error | null>;
    allTickerProperties: Ref<Map<string, TickerProperties>>;
    loadVisibleMonth: (year: number, month: number) => Promise<void>;
    loadDateRange: (startDate: string, endDate: string) => Promise<void>;
    loadMonth: (yearMonth: string) => Promise<void>;
    getCacheStats: () => Promise<any>;
    clearCache: () => Promise<void>;
    ensureDataLoaded: () => Promise<void>;
}

/**
 * Main Hook
 */
export function useCalendarData(): UseCalendarDataReturn {
    return {
        // 상태
        dividendsByDate: filteredDividends,
        isLoading,
        error,
        allTickerProperties,

        // 메서드
        loadVisibleMonth,
        loadDateRange,
        loadMonth,
        getCacheStats,
        clearCache,

        // 유틸
        ensureDataLoaded: loadCurrentMonth, // 현재 월만 로드
    };
}
