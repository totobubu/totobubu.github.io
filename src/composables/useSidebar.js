import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { joinURL } from 'ufo';
import { useFilterState } from '@/composables/useFilterState';
import { user } from '../store/auth';

export function useSidebar() {
    const router = useRouter();
    const route = useRoute();

    const allTickers = ref([]);
    const isLoading = ref(true);
    const error = ref(null);
    const selectedTicker = ref(null);

    const { globalSearchQuery, activeFilterTab, myBookmarks, toggleMyStock } =
        useFilterState();

    // [수정] 기존 필터 관련 상태 제거 (Dialogs, companies 등)

    const filteredTickers = computed(() => {
        const tab = activeFilterTab.value;
        const myBookmarkSymbols = new Set(Object.keys(myBookmarks.value));

        let list = [];

        if (tab === '북마크') {
            list = allTickers.value.filter((item) =>
                myBookmarkSymbols.has(item.symbol)
            );
        } else if (tab === 'ETF') {
            list = allTickers.value.filter(
                (item) => item.company && !myBookmarkSymbols.has(item.symbol)
            );
        } else if (tab === '미국주식') {
            list = allTickers.value.filter(
                (item) =>
                    !item.company &&
                    item.currency === 'USD' &&
                    !myBookmarkSymbols.has(item.symbol)
            );
        } else if (tab === '한국주식') {
            list = allTickers.value.filter(
                (item) =>
                    item.currency === 'KRW' &&
                    !myBookmarkSymbols.has(item.symbol)
            );
        }

        return list;
    });

    const loadSidebarData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch(
                joinURL(import.meta.env.BASE_URL, 'sidebar-tickers.json')
            );
            if (!response.ok)
                throw new Error('Sidebar data could not be loaded.');

            const data = await response.json();
            allTickers.value = data;

            const currentTickerSymbol = route.params.ticker
                ?.toUpperCase()
                .replace(/-/g, '.');
            if (currentTickerSymbol) {
                selectedTicker.value = data.find(
                    (t) => t.symbol === currentTickerSymbol
                );
            }
        } catch (err) {
            error.value = '티커 목록을 불러오는 데 실패했습니다.';
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
