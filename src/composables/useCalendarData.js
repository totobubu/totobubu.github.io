import { ref, computed } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';
import { user } from '../store/auth';

const allDividendData = ref([]); // 항상 배열로 초기화
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

            // [핵심 수정] 데이터가 배열인지 확인
            const events = await eventsResponse.json();
            allDividendData.value = Array.isArray(events) ? events : [];

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
    const { mainFilterTab, subFilterTab, myBookmarks } = useFilterState();

    const dividendsByDate = computed(() => {
        const mainTab = mainFilterTab.value;
        const subTab = subFilterTab.value;
        const myTickerSet = new Set(Object.keys(myBookmarks.value));

        // [핵심 수정] 필터링 로직을 sourceData.filter() 체인으로 단순화
        const filteredEvents = allDividendData.value.filter((event) => {
            const props = allTickerProperties.value.get(event.ticker);
            if (!props) return false; // 속성 정보 없는 데이터 제외

            const isBookmarked = myTickerSet.has(event.ticker);

            if (mainTab === '북마크') {
                return isBookmarked;
            }

            // 북마크 탭이 아니면, 북마크된 항목은 제외
            if (isBookmarked) return false;

            if (mainTab === '미국') {
                if (props.currency !== 'USD') return false;
                return subTab === 'ETF' ? props.isEtf : !props.isEtf;
            }

            if (mainTab === '한국') {
                if (props.currency !== 'KRW') return false;
                return subTab === 'ETF' ? props.isEtf : !props.isEtf;
            }

            return false; // 어떤 탭에도 해당하지 않으면 보이지 않음
        });

        const grouped = {};
        for (const div of filteredEvents) {
            if (!grouped[div.date]) grouped[div.date] = [];

            const props = allTickerProperties.value.get(div.ticker);
            if (props) {
                div.koName = props.koName;
                div.currency = props.currency;
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
    };
}
