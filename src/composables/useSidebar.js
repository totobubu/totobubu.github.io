import { ref, onMounted, computed } from 'vue'; // watch 제거
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

    const { filters, showMyStocksOnly, myBookmarks, toggleMyStock, toggleShowMyStocksOnly } = useFilterState();
    
    const dialogsVisible = ref({ company: false, frequency: false, group: false });
    const companies = ref([]);
    const frequencies = ref([]);
    const groups = ref([]);
    
    // [핵심 수정] 필터링 로직을 단순화하여 '내 종목' 필터만 적용합니다.
    const filteredTickers = computed(() => {
        if (showMyStocksOnly.value && user.value) {
            return allTickers.value.filter(item => myBookmarks.value[item.symbol]);
        }
        return allTickers.value; // 그 외의 경우 전체 목록을 반환
    });
    
    const loadSidebarData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch(joinURL(import.meta.env.BASE_URL, 'sidebar-tickers.json'));
            if (!response.ok) throw new Error('Sidebar data could not be loaded.');
            
            const data = await response.json();
            allTickers.value = data;

            companies.value = [...new Set(data.map(item => item.company).filter(Boolean))];
            frequencies.value = [...new Set(data.map(item => item.frequency).filter(Boolean))];
            groups.value = [...new Set(data.map(item => item.group).filter(Boolean))];

            const currentTickerSymbol = route.params.ticker?.toUpperCase().replace(/-/g, '.');
            if (currentTickerSymbol) {
                selectedTicker.value = data.find(t => t.symbol === currentTickerSymbol);
            }
        } catch (err) {
            error.value = '티커 목록을 불러오는 데 실패했습니다.';
        } finally {
            isLoading.value = false;
        }
    };
    
    const handleBookmarkToggle = () => {
        if (!user.value) router.push('/login');
        else toggleShowMyStocksOnly();
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
    
    const openFilterDialog = (filterName) => {
        dialogsVisible.value[filterName] = true;
    };

    const selectFilter = (filterName, value) => {
        filters.value[filterName].value = value;
        dialogsVisible.value[filterName] = false;
    };

    onMounted(loadSidebarData);

    return {
        isLoading,
        error,
        selectedTicker,
        filters,
        showMyStocksOnly,
        myBookmarks,
        // marketTypeOptions 제거
        filteredTickers,
        dialogsVisible,
        companies,
        frequencies,
        groups,
        handleBookmarkToggle,
        handleStockBookmarkClick,
        onRowSelect,
        openFilterDialog,
        selectFilter,
    };
}