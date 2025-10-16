import { ref, computed } from 'vue'; // watch 제거
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';
import { user } from '../store/auth';

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

            allDividendData.value = await eventsResponse.json();
            const sidebarTickers = await tickersResponse.json();

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
    // [수정] showMyStocksOnly는 useSidebar.js에서 가져온 것을 사용, 여기서는 제거
    const { myBookmarks, activeFilterTab } = useFilterState();

    const dividendsByDate = computed(() => {
        console.log(
            `%c[Calendar Debug] Computing dividendsByDate...`,
            'color: lightblue;'
        );

        let sourceData = allDividendData.value;
        const tab = activeFilterTab.value;
        const myTickerSet = new Set(Object.keys(myBookmarks.value));

        console.log(`  -> Current Tab: ${tab}`);
        console.log(`  -> Initial data size: ${sourceData.length}`);

        if (tab === '북마크') {
            sourceData = sourceData.filter((div) =>
                myTickerSet.has(div.ticker)
            );
            console.log(
                `  -> After Bookmark filter: ${sourceData.length} events`
            );
        } else {
            // 북마크 탭이 아닐 경우, 북마크된 항목은 숨김
            sourceData = sourceData.filter(
                (div) => !myTickerSet.has(div.ticker)
            );
            console.log(
                `  -> After hiding bookmarks: ${sourceData.length} events`
            );

            if (tab === 'ETF') {
                sourceData = sourceData.filter(
                    (event) =>
                        allTickerProperties.value.get(event.ticker)?.isEtf
                );
                console.log(
                    `  -> After ETF filter: ${sourceData.length} events`
                );
            } else if (tab === '미국주식') {
                sourceData = sourceData.filter((event) => {
                    const props = allTickerProperties.value.get(event.ticker);
                    return props?.currency === 'USD' && !props.isEtf;
                });
                console.log(
                    `  -> After US Stock filter: ${sourceData.length} events`
                );
            } else if (tab === '한국주식') {
                sourceData = sourceData.filter(
                    (event) =>
                        allTickerProperties.value.get(event.ticker)
                            ?.currency === 'KRW'
                );
                console.log(
                    `  -> After KR Stock filter: ${sourceData.length} events`
                );
            }
        }

        const grouped = {};
        for (const div of sourceData) {
            if (!grouped[div.date]) grouped[div.date] = [];
            const props = allTickerProperties.value.get(div.ticker);
            if (props) {
                div.koName = props.koName;
                div.currency = props.currency;
            }
            grouped[div.date].push(div);
        }

        console.log(
            `%c[Calendar Debug] Final grouped data keys: ${Object.keys(grouped).length}`,
            'color: lightgreen;'
        );
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
