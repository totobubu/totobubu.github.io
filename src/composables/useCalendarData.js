// \composables\useCalendarData.js
import { ref, computed } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';
import { user } from '../store/auth';
import Holidays from 'date-holidays';

const allDividendData = ref([]);
const holidays = ref([]);
const isLoading = ref(true);
const error = ref(null);

let isDataLoaded = false;
const hd = new Holidays('US');

const loadHolidays = async () => {
    try {
        const response = await fetch(
            joinURL(import.meta.env.BASE_URL, 'holidays.json')
        );
        const holidayNameMapData = await response.json();
        const holidayNameMap = holidayNameMapData.reduce((map, h) => {
            map[h.name_en] = h.name_ko;
            return map;
        }, {});

        const currentYear = new Date().getFullYear();
        const yearsToFetch = [currentYear, currentYear + 1, currentYear + 2];
        const allHolidayEvents = [];

        yearsToFetch.forEach((year) => {
            const yearHolidays = hd.getHolidays(year);
            yearHolidays.forEach((h) => {
                if (h.type === 'public') {
                    allHolidayEvents.push({
                        date: h.date.split(' ')[0],
                        name: holidayNameMap[h.name] || h.name,
                    });
                }
            });
        });
        holidays.value = allHolidayEvents;
    } catch (e) {
        console.error('Failed to load or process holiday data:', e);
        holidays.value = [];
    }
};

const loadAllData = async () => {
    if (isDataLoaded) return;
    isLoading.value = true;
    error.value = null;

    try {
        await loadHolidays();

        const tickerNamesResponse = await fetch(
            joinURL(import.meta.env.BASE_URL, 'nav.json')
        );
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

        const allDataWithNames = (await Promise.all(tickerDataPromises)).filter(
            Boolean
        );
        const flatDividendList = [];
        allDataWithNames.forEach(({ tickerName, data }) => {
            if (data.dividendHistory && Array.isArray(data.dividendHistory)) {
                data.dividendHistory.forEach((dividend) => {
                    if (dividend && dividend.배당락) {
                        try {
                            const parts = dividend.배당락
                                .split('.')
                                .map((p) => p.trim());
                            const dateStr = `20${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                            const amount = dividend.배당금
                                ? parseFloat(dividend.배당금.replace('$', ''))
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
                            /* ignore parse error */
                        }
                    }
                });
            }
        });

        allDividendData.value = flatDividendList;
        isDataLoaded = true;
    } catch (err) {
        console.error('데이터 로딩 중 오류 발생:', err);
        error.value = '달력 데이터를 불러오지 못했습니다.';
    } finally {
        isLoading.value = false;
    }
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

    return { dividendsByDate, holidays, isLoading, error, loadAllData };
}
