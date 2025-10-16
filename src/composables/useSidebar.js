import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { joinURL } from 'ufo';
import { useFilterState } from '@/composables/useFilterState';
import { user } from '../store/auth';

export function useSidebar() {
    const router = useRouter();
    const route = useRoute();

    const allTickers = ref([]); // 이제 모든 정보가 담겨 있음
    const isLoading = ref(true);
    const error = ref(null);
    const selectedTicker = ref(null);

    const { globalSearchQuery, activeFilterTab, myBookmarks, toggleMyStock } =
        useFilterState();

    const filteredTickers = computed(() => {
        const myBookmarkSymbols = new Set(Object.keys(myBookmarks.value));
        const query = globalSearchQuery.value?.toLowerCase();

        if (query) {
            return allTickers.value.filter(
                (item) =>
                    item.symbol.toLowerCase().includes(query) ||
                    (item.koName &&
                        item.koName.toLowerCase().includes(query)) ||
                    (item.longName &&
                        item.longName.toLowerCase().includes(query))
            );
        }

        const tab = activeFilterTab.value;
        let list = [];

        if (tab === '북마크') {
            return allTickers.value.filter((item) =>
                myBookmarkSymbols.has(item.symbol)
            );
        }

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

        // sidebar-tickers.json이 이미 정렬되어 있으므로, 클라이언트에서 다시 정렬할 필요 없음
        return list.slice(0, 30);
    });

    const loadSidebarData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            // [핵심 수정] sidebar-tickers.json 파일 하나만 로드
            const response = await fetch(
                joinURL(import.meta.env.BASE_URL, 'sidebar-tickers.json')
            );
            if (!response.ok)
                throw new Error('sidebar-tickers.json could not be loaded.');

            allTickers.value = await response.json();

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
