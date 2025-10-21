// src\composables\useCalendarData.js
import { ref, computed } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';

const allDividendData = ref([]);
const allTickerProperties = ref(new Map());
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
            const [eventsResponse, tickersResponse] = await Promise.all([
                fetch(
                    joinURL(import.meta.env.BASE_URL, 'calendar-events.json')
                ),
                fetch(
                    joinURL(import.meta.env.BASE_URL, 'sidebar-tickers.json')
                ),
            ]);
            if (!eventsResponse.ok)
                throw new Error('calendar-events.json could not be loaded.');
            if (!tickersResponse.ok)
                throw new Error('sidebar-tickers.json could not be loaded.');

            const eventsByDate = await eventsResponse.json();
            const sidebarTickers = await tickersResponse.json();

            const flatEvents = [];
            for (const date in eventsByDate) {
                const dayData = eventsByDate[date];
                if (dayData.USD)
                    dayData.USD.forEach((event) =>
                        flatEvents.push({ ...event, date, currency: 'USD' })
                    );
                if (dayData.KRW)
                    dayData.KRW.forEach((event) =>
                        flatEvents.push({ ...event, date, currency: 'KRW' })
                    );
            }
            allDividendData.value = flatEvents;

            allTickerProperties.value = new Map(
                sidebarTickers.map((t) => [
                    t.symbol,
                    {
                        currency: t.currency,
                        isEtf: !!(t.company || t.underlying),
                        koName: t.koName,
                    },
                ])
            );
            isDataLoaded = true;
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
    const { mainFilterTab, subFilterTab, myBookmarks } = useFilterState();

    const dividendsByDate = computed(() => {
        const mainTab = mainFilterTab.value;
        const subTab = subFilterTab.value;
        const myTickerSet = new Set(Object.keys(myBookmarks.value));

        let filteredEvents = [...allDividendData.value];

        if (mainTab === '북마크') {
            filteredEvents = filteredEvents.filter((event) =>
                myTickerSet.has(event.ticker)
            );
        } else {
            // 북마크가 아닌 탭에서는 북마크된 항목 제외
            filteredEvents = filteredEvents.filter(
                (event) => !myTickerSet.has(event.ticker)
            );

            // [핵심 수정] 국가 필터링
            if (mainTab === '미국') {
                filteredEvents = filteredEvents.filter(
                    (event) =>
                        allTickerProperties.value.get(event.ticker)
                            ?.currency === 'USD'
                );
            } else if (mainTab === '한국') {
                filteredEvents = filteredEvents.filter(
                    (event) =>
                        allTickerProperties.value.get(event.ticker)
                            ?.currency === 'KRW'
                );
            }

            // [핵심 수정] 소분류 필터링 (국가 필터링 후에 적용)
            if (subTab === 'ETF') {
                filteredEvents = filteredEvents.filter(
                    (event) =>
                        allTickerProperties.value.get(event.ticker)?.isEtf
                );
            } else if (subTab === '주식') {
                filteredEvents = filteredEvents.filter(
                    (event) =>
                        !allTickerProperties.value.get(event.ticker)?.isEtf
                );
            }
        }

        const grouped = {};
        for (const div of filteredEvents) {
            const props = allTickerProperties.value.get(div.ticker);
            if (props) div.koName = props.koName;
            if (!grouped[div.date]) grouped[div.date] = [];
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
    };
}
