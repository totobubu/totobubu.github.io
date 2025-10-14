// REFACTORED: composables/useCalendarData.js
import { ref, computed } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';
import { user } from '../store/auth';

const allDividendData = ref([]);
const isLoading = ref(false);
const error = ref(null);
let isDataLoaded = false;
let isLoadingPromise = null;

const loadAllData = () => {
    if (isLoadingPromise) return isLoadingPromise;
    if (isDataLoaded) return Promise.resolve();

    isLoadingPromise = new Promise(async (resolve, reject) => {
        isLoading.value = true;
        error.value = null;
        try {
            // [핵심 변경] 단 하나의 파일만 요청합니다.
            const eventsResponse = await fetch(
                joinURL(import.meta.env.BASE_URL, 'calendar-events.json')
            );
            if (!eventsResponse.ok) {
                throw new Error('calendar-events.json could not be loaded.');
            }

            allDividendData.value = await eventsResponse.json();
            isDataLoaded = true;
            console.log('최적화된 캘린더 데이터 로딩 완료.');
            resolve();
        } catch (err) {
            console.error('캘린더 데이터 로딩 중 오류 발생:', err);
            error.value = '달력 데이터를 불러오지 못했습니다.';
            reject(err);
        } finally {
            isLoading.value = false;
            isLoadingPromise = null;
        }
    });

    return isLoadingPromise;
};

export function useCalendarData() {
    const { showMyStocksOnly, myBookmarks } = useFilterState();

    const dividendsByDate = computed(() => {
        let sourceData = allDividendData.value;

        if (showMyStocksOnly.value && user.value) {
            const myTickerSet = new Set(Object.keys(myBookmarks.value));
            sourceData = allDividendData.value.filter((div) =>
                myTickerSet.has(div.ticker)
            );
        }

        const grouped = {};
        for (const div of sourceData) {
            if (!grouped[div.date]) {
                grouped[div.date] = [];
            }
            grouped[div.date].push(div);
        }
        return grouped;
    });

    return {
        dividendsByDate,
        isLoading,
        error,
        ensureDataLoaded: () => {
            if (!isDataLoaded && !isLoadingPromise) {
                loadAllData();
            }
        },
        loadAllData,
    };
}
