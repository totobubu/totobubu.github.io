/**
 * useCalendarData V2 - 월별 로딩 + IndexedDB 캐싱
 *
 * 개선사항:
 * 1. 월별 데이터 분할 로딩 (필요한 월만 로드)
 * 2. IndexedDB 캐싱으로 재방문 시 빠른 로딩
 * 3. 점진적 로딩으로 초기 로딩 속도 개선
 */

import { ref, computed } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from '@/composables/portfolio/useFilterState';
import { getDataUrl } from '@/utils/dataUrl';
import { stripTickerSuffix } from '@/utils/tickerRoute';
import dbCache from '@/utils/indexedDB';

// 전역 상태
const monthlyData = ref(new Map()); // Map<yearMonth, events[]>
const allTickerProperties = ref(new Map());
const isLoading = ref(false);
const loadingMonths = ref(new Set());
const error = ref(null);

/**
 * 연-월 범위 생성 (예: 2024-01 ~ 2024-12)
 */
function generateMonthRange(startYear, startMonth, endYear, endMonth) {
  const months = [];
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
async function loadMonth(yearMonth) {
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
    const cached = await dbCache.get(`calendar-${yearMonth}`);
    if (cached) {
      console.log(`✓ 캐시에서 로드: ${yearMonth}`);
      monthlyData.value.set(yearMonth, cached.events);

      // 티커 속성 정보 병합
      cached.tickerProperties.forEach((value, key) => {
        if (!allTickerProperties.value.has(key)) {
          allTickerProperties.value.set(key, value);
        }
      });

      loadingMonths.value.delete(yearMonth);
      return;
    }

    // 2. 네트워크에서 fetch
    console.log(`⬇️ 네트워크에서 로드: ${yearMonth}`);
    const [year, month] = yearMonth.split('-');
    const url = getDataUrl(`calendar/monthly/${year}/${month}.json`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${yearMonth}: ${response.status}`);
    }

    const monthEvents = await response.json();

    // 3. 데이터 변환 (날짜별 → 배열 형태)
    const flatEvents = [];
    const tickerPropertiesMap = new Map();

    for (const [dateStr, eventsByDate] of Object.entries(monthEvents)) {
      // eventsByDate는 { "KRW": [...], "USD": [...] } 형태
      for (const [currency, events] of Object.entries(eventsByDate)) {
        events.forEach(event => {
          flatEvents.push({
            ...event,
            date: dateStr,
            currency,
            isEtf: event.isEtf || false
          });

          // 티커 속성 정보 수집
          if (!tickerPropertiesMap.has(event.ticker)) {
            tickerPropertiesMap.set(event.ticker, {
              currency,
              isEtf: event.isEtf || false,
              koName: event.koName
            });
          }
        });
      }
    }

    // 4. 상태 업데이트
    monthlyData.value.set(yearMonth, flatEvents);

    // 티커 속성 병합
    tickerPropertiesMap.forEach((value, key) => {
      if (!allTickerProperties.value.has(key)) {
        allTickerProperties.value.set(key, value);
      }
    });

    // 5. IndexedDB에 캐싱
    await dbCache.set(`calendar-${yearMonth}`, {
      events: flatEvents,
      tickerProperties: Array.from(tickerPropertiesMap.entries())
    });

    console.log(`✓ 캐시 저장 완료: ${yearMonth} (${flatEvents.length}개 이벤트)`);

  } catch (err) {
    console.error(`❌ ${yearMonth} 로드 실패:`, err);
    error.value = err;
  } finally {
    loadingMonths.value.delete(yearMonth);
  }
}

/**
 * 특정 기간의 데이터 로드
 */
async function loadDateRange(startDate, endDate) {
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

    console.log(`📅 로딩할 월: ${months.length}개 (${months[0]} ~ ${months[months.length - 1]})`);

    // 병렬로 모든 월 로드
    await Promise.all(months.map(month => loadMonth(month)));

    console.log(`✅ 데이터 로딩 완료: ${monthlyData.value.size}개 월`);

  } catch (err) {
    console.error('데이터 로드 실패:', err);
    error.value = err;
  } finally {
    isLoading.value = false;
  }
}

/**
 * 현재 연도의 데이터 로드 (기본 동작)
 */
async function loadCurrentYear() {
  const now = new Date();
  const startDate = `${now.getFullYear()}-01-01`;
  const endDate = `${now.getFullYear()}-12-31`;

  await loadDateRange(startDate, endDate);
}

/**
 * 날짜별 배당 데이터 (computed)
 */
const dividendsByDate = computed(() => {
  const result = {};

  // 모든 월의 데이터를 날짜별로 그룹화
  monthlyData.value.forEach(events => {
    events.forEach(event => {
      if (!result[event.date]) {
        result[event.date] = [];
      }
      result[event.date].push(event);
    });
  });

  return result;
});

/**
 * 필터링된 배당 데이터
 */
const filteredDividends = computed(() => {
  const { mainFilterTab, subFilterTab, myBookmarks } = useFilterState();

  const result = {};

  Object.entries(dividendsByDate.value).forEach(([date, events]) => {
    const filtered = events.filter(event => {
      // 북마크 필터
      const bookmarkKeys = Object.keys(myBookmarks.value || {});
      if (bookmarkKeys.length > 0) {
        const symbol = stripTickerSuffix(event.ticker);
        if (!bookmarkKeys.some(key => key === event.ticker || key === symbol)) {
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

      return true;
    });

    if (filtered.length > 0) {
      result[date] = filtered;
    }
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
async function clearCache() {
  await dbCache.clear();
  monthlyData.value.clear();
  allTickerProperties.value.clear();
  console.log('✓ 캐시 초기화 완료');
}

/**
 * Main Hook
 */
export function useCalendarData() {
  return {
    // 상태
    dividendsByDate: filteredDividends,
    isLoading,
    error,
    allTickerProperties,

    // 메서드
    loadCurrentYear,
    loadDateRange,
    loadMonth,
    getCacheStats,
    clearCache,

    // 유틸
    ensureDataLoaded: loadCurrentYear // 기존 호환성
  };
}
