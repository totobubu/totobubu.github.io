// composables/useCalendarData.js
import { ref, computed, watch } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';
import { user } from '../store/auth';

const allDividendData = ref([]);
const allTickerProperties = ref(new Map());
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
    const { showMyStocksOnly, myBookmarks, filters } = useFilterState();

    const dividendsByDate = computed(() => {
        let sourceData = allDividendData.value;

        // [핵심 수정] filters.value.marketType -> filters.marketType 으로 수정
        const marketType = filters.marketType?.value; // Optional chaining 추가
        if (marketType) {
            sourceData = sourceData.filter((event) => {
                const props = allTickerProperties.value.get(event.ticker);
                if (!props) return false;
                if (marketType === '미국 ETF')
                    return props.currency === 'USD' && props.isEtf;
                if (marketType === '미국 주식')
                    return props.currency === 'USD' && !props.isEtf;
                if (marketType === '한국 주식') return props.currency === 'KRW';
                return true;
            });
        }

        if (showMyStocksOnly.value && user.value) {
            const myTickerSet = new Set(Object.keys(myBookmarks.value));
            sourceData = sourceData.filter((div) =>
                myTickerSet.has(div.ticker)
            );
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
        return grouped;
    });

    // [핵심 수정] watch 대상도 filters.marketType.value로 명확히 지정
    watch(
        () => filters.marketType?.value,
        () => {
            // 이 watch는 computed 속성인 dividendsByDate를 재계산하도록 트리거합니다.
        }
    );

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
