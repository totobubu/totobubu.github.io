// src\composables\useCalendarData.js
import { ref, computed } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';
import { user } from '../store/auth';

const allCalendarData = ref({});
const isLoading = ref(false);
const error = ref(null);
let isDataLoaded = false;
let isLoadingPromise = null;

const loadAllData = async () => {
    if (isLoadingPromise) return isLoadingPromise;
    if (isDataLoaded) return Promise.resolve();
    isLoadingPromise = new Promise(async (resolve, reject) => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch(
                joinURL(import.meta.env.BASE_URL, 'calendar-events.json')
            );
            if (!response.ok)
                throw new Error('calendar-events.json could not be loaded.');
            allCalendarData.value = await response.json();
            isDataLoaded = true;
            resolve();
        } catch (err) {
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
    const { activeFilterTab, myBookmarks } = useFilterState();

    const dividendsByDate = computed(() => {
        const tab = activeFilterTab.value;
        const myTickerSet = new Set(Object.keys(myBookmarks.value));
        const flatEvents = [];

        for (const date in allCalendarData.value) {
            const dayData = allCalendarData.value[date];
            for (const currency in dayData) {
                dayData[currency].forEach((event) => {
                    // 필터링 로직
                    const isBookmarked = myTickerSet.has(event.ticker);
                    if (tab === '북마크' && !isBookmarked) return;
                    if (tab !== '북마크' && isBookmarked) return;

                    const isEtf = !!event.company; // nav.json에 company가 있으면 ETF로 간주
                    const isKr = currency === 'KRW';

                    if (tab === 'ETF' && (!isEtf || isKr)) return;
                    if (tab === '미국주식' && (isEtf || isKr)) return;
                    if (tab === '한국주식' && !isKr) return;

                    // 최종 배열에 추가
                    flatEvents.push({
                        ...event,
                        date: date,
                        currency: currency,
                    });
                });
            }
        }
        return flatEvents;
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
    };
}
