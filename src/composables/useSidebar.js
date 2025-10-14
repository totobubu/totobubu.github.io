import { ref, onMounted, computed, watch } from 'vue';
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

    const marketTypeOptions = ref(['미국 ETF', '미국 주식', '한국 주식']);
    
    const dialogsVisible = ref({ company: false, frequency: false, group: false });
    const companies = ref([]);
    const frequencies = ref([]);
    const groups = ref([]);

    const filteredTickers = computed(() => {
        console.log(`%c[Sidebar Debug] Computing filteredTickers...`, 'color: cyan; font-weight: bold;');
        console.log(`  -> Total tickers loaded:`, allTickers.value.length);

        // 1. 원본 데이터 샘플 확인 (첫 3개)
        if (allTickers.value.length > 0) {
            console.log(`  -> Sample raw data (first 3):`, allTickers.value.slice(0, 3));
        }

        let list = allTickers.value;

        // 2. 내 종목 필터
        if (showMyStocksOnly.value && user.value) {
            list = list.filter(item => myBookmarks.value[item.symbol]);
            console.log(`  -> After bookmark filter: ${list.length} tickers`);
        }

        // 3. 시장 타입 필터
        const marketType = filters.value.marketType.value;
        console.log(`  -> Current marketType filter: "${marketType}"`);
        
        let beforeFilterCount = list.length;
        if (marketType === '미국 ETF') {
            list = list.filter(item => (item.company || item.underlying) && item.currency === 'USD');
        } else if (marketType === '미국 주식') {
            list = list.filter(item => !item.company && !item.underlying && item.currency === 'USD');
        } else if (marketType === '한국 주식') {
            // [디버깅] 한국 주식 필터링 조건 검사
            console.log(`  -> Checking for KRW currency...`);
            const krwTickers = list.filter(item => item.currency === 'KRW');
            console.log(`  -> Found ${krwTickers.length} tickers with currency='KRW'. Sample:`, krwTickers.slice(0, 3));
            list = krwTickers;
        }
        console.log(`  -> After marketType filter: ${list.length} tickers (Filtered out: ${beforeFilterCount - list.length})`);
        
        return list;
    });
    
    watch(filters, (newFilters, oldFilters) => {
        if (newFilters.marketType.value !== oldFilters.marketType.value) {
            console.log(`%c[Sidebar Debug] MarketType changed to "${newFilters.marketType.value}". Resetting global filter.`, 'color: orange;');
            filters.value.global.value = null;
        }
    }, { deep: true });

    const loadSidebarData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const url = joinURL(import.meta.env.BASE_URL, 'sidebar-tickers.json');
            console.log(`%c[Sidebar Debug] Loading data from: ${url}`, 'color: yellow;');
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Sidebar data could not be loaded. Status: ${response.status}`);
            
            const data = await response.json();
            console.log(`%c[Sidebar Debug] Data loaded successfully. Total items: ${data.length}`, 'color: green;');
            allTickers.value = data;

            companies.value = [...new Set(data.map(item => item.company).filter(Boolean))];
            frequencies.value = [...new Set(data.map(item => item.frequency).filter(Boolean))];
            groups.value = [...new Set(data.map(item => item.group).filter(Boolean))];

            const currentTickerSymbol = route.params.ticker?.toUpperCase().replace(/-/g, '.');
            if (currentTickerSymbol) {
                selectedTicker.value = data.find(t => t.symbol === currentTickerSymbol);
            }
        } catch (err) {
            console.error('[Sidebar Error]', err);
            error.value = '티커 목록을 불러오는 데 실패했습니다.';
        } finally {
            isLoading.value = false;
        }
    };
    
    // ... (이벤트 핸들러 함수들은 동일) ...
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
        marketTypeOptions,
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