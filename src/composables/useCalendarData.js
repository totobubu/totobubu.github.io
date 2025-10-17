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

    const processedData = computed(() => {
        const tab = activeFilterTab.value;
        const myTickerSet = new Set(Object.keys(myBookmarks.value));
        const flatEvents = [];

        for (const date in allCalendarData.value) {
            const dayData = allCalendarData.value[date];
            for (const currency in dayData) {
                dayData[currency].forEach((event) => {
                    const isBookmarked = myTickerSet.has(event.symbol);
                    let shouldAdd = false;

                    if (tab === '북마크' && isBookmarked) {
                        shouldAdd = true;
                    } else if (tab !== '북마크' && !isBookmarked) {
                        const isEtf = !!(event.company || event.underlying);
                        const isKr = currency === 'KRW';

                        if (tab === 'ETF' && isEtf) shouldAdd = true;
                        else if (tab === '미국주식' && !isEtf && !isKr)
                            shouldAdd = true;
                        else if (tab === '한국주식' && isKr) shouldAdd = true;
                    }

                    if (shouldAdd) {
                        flatEvents.push({ ...event, date, currency });
                    }
                });
            }
        }

        // [핵심 수정] 최종 반환 객체에 필터 정보 포함
        let activeFilter = tab;
        if (tab === '북마크') {
            // 북마크에 한국 주식이 하나라도 포함되어 있으면 '한국주식' 스타일 적용
            const hasKoreanStock = flatEvents.some(
                (event) => event.currency === 'KRW'
            );
            activeFilter = hasKoreanStock ? '한국주식' : '미국주식'; // 북마크 내 구성에 따라 동적 결정
        }

        return {
            events: flatEvents,
            activeFilter: activeFilter,
        };
    });

    return {
        // [핵심 수정] computed 속성을 분리하여 전달
        dividendsByDate: computed(() => processedData.value.events),
        activeCalendarFilter: computed(() => processedData.value.activeFilter),
        isLoading,
        error,
        ensureDataLoaded: () => {
            if (!isDataLoaded && !isLoadingPromise) {
                loadAllData();
            }
        },
    };
}
