// src\composables\useSidebar.js
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { joinURL } from 'ufo';
import { useFilterState } from '@/composables/useFilterState';
import { user } from '../store/auth';

export function useSidebar() {
    const router = useRouter();
    const route = useRoute();

    const allTickers = ref([]);
    const popularityData = ref({});
    const isLoading = ref(true);
    const error = ref(null);
    const selectedTicker = ref(null);

    const { globalSearchQuery, activeFilterTab, myBookmarks, toggleMyStock } =
        useFilterState();

    const filteredTickers = computed(() => {
        const myBookmarkSymbols = new Set(Object.keys(myBookmarks.value));
        const query = globalSearchQuery.value?.toLowerCase();

        // 1. 검색어가 있을 경우: 필터 탭과 무관하게 전체 목록에서 검색
        if (query) {
            return allTickers.value.filter(
                (item) =>
                    item.symbol.toLowerCase().includes(query) ||
                    item.koName?.toLowerCase().includes(query) ||
                    item.longName?.toLowerCase().includes(query)
            );
        }

        // 2. 검색어가 없을 경우 (초기 로딩 및 탭 전환)
        const tab = activeFilterTab.value;
        let list = [];

        if (tab === '북마크') {
            return allTickers.value.filter((item) =>
                myBookmarkSymbols.has(item.symbol)
            );
        }

        // 북마크된 항목은 다른 탭에서 숨김
        const nonBookmarkedTickers = allTickers.value.filter(
            (item) => !myBookmarkSymbols.has(item.symbol)
        );

        if (tab === 'ETF') {
            list = nonBookmarkedTickers.filter(
                (item) => item.company && item.currency === 'USD'
            );
        } else if (tab === '미국주식') {
            list = nonBookmarkedTickers.filter(
                (item) => !item.company && item.currency === 'USD'
            );
        } else if (tab === '한국주식') {
            list = nonBookmarkedTickers.filter(
                (item) => item.currency === 'KRW'
            );
        }

        // 3. 상위 30개 필터링
        const popularSymbols = Object.keys(popularityData.value);

        // 3-1. 인기 순으로 정렬
        list.sort((a, b) => {
            const scoreA = popularityData.value[a.symbol] || 0;
            const scoreB = popularityData.value[b.symbol] || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            // 3-2. 인기도가 같으면 시가총액 순으로 정렬 (marketCap 데이터 필요)
            return (b.marketCap || 0) - (a.marketCap || 0);
        });

        return list.slice(0, 30);
    });

    const loadSidebarData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const [tickersResponse, popularityResponse] = await Promise.all([
                fetch(
                    joinURL(import.meta.env.BASE_URL, 'sidebar-tickers.json')
                ),
                fetch(joinURL(import.meta.env.BASE_URL, 'popularity.json')),
            ]);

            if (!tickersResponse.ok)
                throw new Error('sidebar-tickers.json could not be loaded.');
            if (!popularityResponse.ok)
                throw new Error('popularity.json could not be loaded.');

            const tickersData = await tickersResponse.json();
            popularityData.value = await popularityResponse.json();

            // [신규] MarketCap 정보를 allTickers에 추가하기 위해 각 data 파일 로드 (비동기 병렬)
            const tickerPromises = tickersData.map(async (ticker) => {
                try {
                    const res = await fetch(
                        joinURL(
                            import.meta.env.BASE_URL,
                            `data/${ticker.symbol.replace(/\./g, '-').toLowerCase()}.json`
                        )
                    );
                    if (res.ok) {
                        const data = await res.json();
                        return {
                            ...ticker,
                            marketCap: data.tickerInfo?.marketCap || 0,
                        };
                    }
                } catch (e) {
                    /* ignore */
                }
                return { ...ticker, marketCap: 0 };
            });

            allTickers.value = await Promise.all(tickerPromises);

            const currentTickerSymbol = route.params.ticker
                ?.toUpperCase()
                .replace(/-/g, '.');
            if (currentTickerSymbol) {
                selectedTicker.value = allTickers.value.find(
                    (t) => t.symbol === currentTickerSymbol
                );
            }
        } catch (err) {
            error.value = '사이드바 데이터를 불러오는 데 실패했습니다.';
            console.error(err);
        } finally {
            isLoading.value = false;
        }
    };

    const handleStockBookmarkClick = (symbol) => {
        if (!user.value) router.push('/login');
        else toggleMyStock(symbol);
    };

    const onRowSelect = (event) => {
        const ticker = event.data.symbol;
        if (ticker && typeof ticker === 'string') {
            router.push(`/${ticker.replace(/\./g, '-').toLowerCase()}`);
        }
    };

    onMounted(loadSidebarData);

    // activeFilterTab이 바뀔 때 검색어 초기화
    watch(activeFilterTab, () => {
        globalSearchQuery.value = null;
    });

    return {
        isLoading,
        error,
        selectedTicker,
        globalSearchQuery,
        activeFilterTab,
        myBookmarks,
        filteredTickers,
        handleStockBookmarkClick,
        onRowSelect,
    };
}
