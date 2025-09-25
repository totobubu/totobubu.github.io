// composables\useCalendarData.js
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
            const tickerNamesResponse = await fetch(
                joinURL(import.meta.env.BASE_URL, 'nav.json')
            );
            if (!tickerNamesResponse.ok)
                throw new Error('nav.json could not be loaded.');
            const tickerNavData = await tickerNamesResponse.json();

            const activeTickersNav = tickerNavData.nav.filter(
                (ticker) => !ticker.upcoming
            );

            const tickerInfoMap = new Map(
                activeTickersNav.map((item) => [item.symbol, item])
            );
            const tickerNames = activeTickersNav
                .map((t) => t.symbol)
                .filter(Boolean);

            const tickerDataPromises = tickerNames.map(async (ticker) => {
                try {
                    const response = await fetch(
                        joinURL(
                            import.meta.env.BASE_URL,
                            `data/${ticker.toLowerCase()}.json`
                        )
                    );
                    if (!response.ok) return null;
                    return { tickerName: ticker, data: await response.json() };
                } catch (e) {
                    return null;
                }
            });

            const allDataWithNames = (
                await Promise.all(tickerDataPromises)
            ).filter(Boolean);

            const flatDividendList = [];
            allDataWithNames.forEach(({ tickerName, data }) => {
                if (
                    data.dividendHistory &&
                    Array.isArray(data.dividendHistory)
                ) {
                    data.dividendHistory.forEach((dividend) => {
                        if (dividend && dividend.배당락) {
                            try {
                                const parts = dividend.배당락
                                    .split('.')
                                    .map((p) => p.trim());
                                const dateStr = `20${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                const amount = dividend.배당금
                                    ? parseFloat(
                                          dividend.배당금.replace('$', '')
                                      )
                                    : null;
                                const tickerInfo = tickerInfoMap.get(
                                    tickerName.toUpperCase()
                                );
                                flatDividendList.push({
                                    date: dateStr,
                                    amount,
                                    ticker: tickerName.toUpperCase(),
                                    frequency: tickerInfo?.frequency,
                                    group: tickerInfo?.group,
                                });
                            } catch (e) {
                                // Invalid date format, ignore
                            }
                        }
                    });
                }
            });

            allDividendData.value = flatDividendList;
            isDataLoaded = true;
            console.log('달력 데이터 로딩 완료. (출시 예정 종목 제외)');
            resolve();
        } catch (err) {
            console.error('데이터 로딩 중 오류 발생:', err);
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
            sourceData = allDividendData.value.filter(
                (div) => myBookmarks.value[div.ticker]
            );
        }

        const grouped = {};
        sourceData.forEach((div) => {
            if (!grouped[div.date]) {
                grouped[div.date] = [];
            }
            grouped[div.date].push(div);
        });
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
