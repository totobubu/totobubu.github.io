// src/composables/useSidebar.js

import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { joinURL } from 'ufo';
import { useFilterState } from '@/composables/useFilterState';
import { getDataUrl } from '@/utils/dataUrl';
import { user } from '../store/auth';
import { db } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from 'primevue/usetoast';

export function useSidebar() {
    const router = useRouter();
    const route = useRoute();
    const toast = useToast();

    const allTickers = ref([]);
    const allTickersForSearch = ref([]); // 전체 검색용 (모든 티커)
    const isLoadingAllTickers = ref(false);
    const loadedMarkets = ref(new Set()); // 이미 로드된 시장 추적
    const isLoading = ref(true);
    const hasInitialLoadCompleted = ref(false);
    const error = ref(null);
    const selectedTicker = ref(null);

    const {
        globalSearchQuery,
        mainFilterTab,
        subFilterTab,
        myBookmarks,
        toggleMyStock,
    } = useFilterState();

    // 전체 티커 로드 (nav.json에서 - 검색용)
    const loadAllTickersForSearch = async () => {
        if (allTickersForSearch.value.length > 0 || isLoadingAllTickers.value)
            return; // 이미 로드 중이거나 로드됨

        isLoadingAllTickers.value = true;

        try {
            const response = await fetch(getDataUrl('nav.json'));
            if (!response.ok) throw new Error('nav.json could not be loaded.');
            const navData = await response.json();

            // 한국 ETF 브랜드명 목록
            const koreanEtfBrands = [
                'KODEX',
                'TIGER',
                'KBSTAR',
                'ACE',
                'ARIRANG',
                'HANARO',
                'SOL',
                'PLUS',
                'RISE',
                'TIMEFOLIO',
                'KOSEF',
                'KINDEX',
                'TRUE',
                'FOCUS',
                'SMART',
                'QV',
                'TREX',
                'HK ',
            ];

            const dayOrder = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

            allTickersForSearch.value = navData.nav
                .filter((item) => !item.upcoming)
                .map((item) => {
                    let isEtf = !!(item.company || item.underlying);
                    if (!isEtf && item.koName) {
                        isEtf = koreanEtfBrands.some((brand) =>
                            item.koName.startsWith(brand)
                        );
                    }

                    const ticker = {
                        symbol: item.symbol,
                        currency: item.currency || 'USD',
                        market: item.market,
                        isEtf,
                    };

                    if (item.koName) ticker.koName = item.koName;
                    if (item.longName) ticker.longName = item.longName;
                    if (item.company) ticker.company = item.company;
                    if (item.logo) ticker.logo = item.logo;
                    if (item.frequency) ticker.frequency = item.frequency;
                    if (item.group) {
                        ticker.group = item.group;
                        ticker.groupOrder = dayOrder[item.group] ?? 999;
                    } else {
                        ticker.groupOrder = 999;
                    }
                    if (item.underlying) ticker.underlying = item.underlying;

                    return ticker;
                });
        } catch (err) {
            console.error('Failed to load all tickers for search:', err);
        } finally {
            isLoadingAllTickers.value = false;
        }
    };

    const ensureAllTickersForSearchLoaded = async () => {
        if (allTickersForSearch.value.length === 0) {
            await loadAllTickersForSearch();
        }
    };

    const fallbackTickersByMarket = async (marketKey) => {
        await ensureAllTickersForSearchLoaded();

        const filterMap = {
            'kr-stocks': (item) => item.currency === 'KRW' && !item.isEtf,
            'kr-etfs': (item) => item.currency === 'KRW' && item.isEtf,
            'us-stocks': (item) => item.currency === 'USD' && !item.isEtf,
            'us-etfs': (item) => item.currency === 'USD' && item.isEtf,
        };

        const filterFn = filterMap[marketKey];
        if (!filterFn) return [];

        return allTickersForSearch.value.filter(filterFn);
    };

    // --- [핵심 수정] filteredTickers 로직 변경 ---
    const filteredTickers = computed(() => {
        const myBookmarkSymbols = new Set(Object.keys(myBookmarks.value));
        const query = globalSearchQuery.value?.toLowerCase().trim();
        const mainTab = mainFilterTab.value;
        const subTab = subFilterTab.value;

        let baseList = [];

        // 1. 검색어가 있는 경우: 전체 티커에서 검색 (allTickersForSearch 사용)
        if (query) {
            // 검색은 전체 티커에서 수행 (이미 로드된 경우에만)
            if (allTickersForSearch.value.length === 0) {
                // 아직 로드되지 않았으면 빈 배열 반환 (watch에서 로드됨)
                return [];
            }

            const searchResults = allTickersForSearch.value.filter(
                (item) =>
                    item.symbol.toLowerCase().includes(query) ||
                    (item.koName &&
                        item.koName.toLowerCase().includes(query)) ||
                    (item.longName &&
                        item.longName.toLowerCase().includes(query))
            );

            // 북마크 제외
            const filtered = searchResults.filter(
                (item) => !myBookmarkSymbols.has(item.symbol)
            );

            return filtered;
        }

        // 2. 검색어가 없는 경우: 현재 탭에 따라 기본 목록(baseList)을 결정
        if (mainTab === '북마크') {
            baseList = allTickers.value.filter((item) =>
                myBookmarkSymbols.has(item.symbol)
            );
        } else if (mainTab === '미국') {
            baseList = allTickers.value.filter(
                (item) =>
                    item.currency === 'USD' &&
                    !myBookmarkSymbols.has(item.symbol)
            );
        } else if (mainTab === '한국') {
            baseList = allTickers.value.filter(
                (item) =>
                    item.currency === 'KRW' &&
                    !myBookmarkSymbols.has(item.symbol)
            );
        }

        // 3. 검색어가 없는 경우, 기존 로직을 따릅니다.
        if (mainTab === '북마크') {
            return baseList; // 북마크 탭은 이미 필터링 되었으므로 그대로 반환
        }

        let list = [];
        if (subTab === 'ETF') {
            list = baseList.filter((item) => item.company || item.underlying);
        } else {
            // 주식
            list = baseList.filter((item) => !item.company && !item.underlying);
        }

        list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        return list.slice(0, 50);
    });

    const isSearchActive = computed(
        () => !!(globalSearchQuery.value && globalSearchQuery.value.trim())
    );
    const isSearchLoading = computed(
        () => isSearchActive.value && isLoadingAllTickers.value
    );

    // 시장별 데이터 lazy loading
    const loadMarketData = async (marketKey) => {
        if (loadedMarkets.value.has(marketKey)) return;

        const fileMap = {
            'kr-stocks': 'sidebar/sidebar-tickers-kr-stocks.json',
            'kr-etfs': 'sidebar/sidebar-tickers-kr-etfs.json',
            'us-stocks': 'sidebar/sidebar-tickers-us-stocks.json',
            'us-etfs': 'sidebar/sidebar-tickers-us-etfs.json',
        };

        const fileName = fileMap[marketKey];
        if (!fileName) return;

        try {
            const response = await fetch(getDataUrl(fileName));
            if (!response.ok)
                throw new Error(`${fileName} could not be loaded.`);

            const data = await response.json();

            let marketTickers = Array.isArray(data) ? data : [];
            if (marketTickers.length === 0) {
                marketTickers = await fallbackTickersByMarket(marketKey);
            }

            if (marketTickers.length > 0) {
                const existingSymbols = new Set(
                    allTickers.value.map((item) => item.symbol)
                );
                const deduped = marketTickers.filter(
                    (item) => !existingSymbols.has(item.symbol)
                );
                allTickers.value = [...allTickers.value, ...deduped];
            } else {
                console.warn(
                    `[Sidebar] No tickers available for market '${marketKey}'.`
                );
            }

            loadedMarkets.value.add(marketKey);
        } catch (err) {
            console.error(`Failed to load ${fileName}:`, err);
            const fallback = await fallbackTickersByMarket(marketKey);
            if (fallback.length > 0) {
                const existingSymbols = new Set(
                    allTickers.value.map((item) => item.symbol)
                );
                const deduped = fallback.filter(
                    (item) => !existingSymbols.has(item.symbol)
                );
                allTickers.value = [...allTickers.value, ...deduped];
                loadedMarkets.value.add(marketKey);
            } else {
                throw err;
            }
        }
    };

    const loadSidebarData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            // 초기 로드: 현재 탭에 따라 필요한 데이터만 로드
            const mainTab = mainFilterTab.value;
            const subTab = subFilterTab.value;

            const marketsToLoad = [];
            if (mainTab === '한국') {
                marketsToLoad.push(subTab === 'ETF' ? 'kr-etfs' : 'kr-stocks');
            } else if (mainTab === '미국') {
                marketsToLoad.push(subTab === 'ETF' ? 'us-etfs' : 'us-stocks');
            } else if (mainTab === '북마크') {
                // 북마크는 모든 시장이 필요할 수 있으므로 모두 로드
                marketsToLoad.push(
                    'kr-stocks',
                    'kr-etfs',
                    'us-stocks',
                    'us-etfs'
                );
            }

            await Promise.all(marketsToLoad.map((m) => loadMarketData(m)));

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
            hasInitialLoadCompleted.value = true;
        }
    };

    // 탭 변경 시 필요한 데이터를 추가로 로드
    const loadAdditionalData = async () => {
        const mainTab = mainFilterTab.value;
        const subTab = subFilterTab.value;

        const marketsToLoad = [];
        if (mainTab === '한국') {
            const market = subTab === 'ETF' ? 'kr-etfs' : 'kr-stocks';
            if (!loadedMarkets.value.has(market)) {
                marketsToLoad.push(market);
            }
        } else if (mainTab === '미국') {
            const market = subTab === 'ETF' ? 'us-etfs' : 'us-stocks';
            if (!loadedMarkets.value.has(market)) {
                marketsToLoad.push(market);
            }
        } else if (mainTab === '북마크') {
            const bookmarkMarkets = [
                'kr-stocks',
                'kr-etfs',
                'us-stocks',
                'us-etfs',
            ];
            bookmarkMarkets.forEach((market) => {
                if (!loadedMarkets.value.has(market)) {
                    marketsToLoad.push(market);
                }
            });
        }

        if (marketsToLoad.length > 0) {
            isLoading.value = true;
            try {
                await Promise.all(marketsToLoad.map((m) => loadMarketData(m)));
            } catch (err) {
                console.error('Failed to load additional data:', err);
            } finally {
                isLoading.value = false;
            }
        }
    };

    const handleTickerRequest = async (tickerSymbol) => {
        if (!user.value) {
            toast.add({
                severity: 'warn',
                summary: '로그인 필요',
                detail: '종목 추가 요청은 로그인 후 가능합니다.',
                life: 3000,
            });
            return;
        }
        if (!tickerSymbol || tickerSymbol.trim().length < 1) return;

        const symbol = tickerSymbol.trim().toUpperCase();
        const requestRef = doc(db, 'tickerRequests', symbol);

        // 이미 요청되었는지 확인
        const docSnap = await getDoc(requestRef);
        if (docSnap.exists()) {
            toast.add({
                severity: 'info',
                summary: '알림',
                detail: `'${symbol}'은(는) 이미 추가 요청된 종목입니다.`,
                life: 3000,
            });
            return;
        }

        try {
            await setDoc(requestRef, {
                requestedBy: user.value.uid,
                requestedAt: serverTimestamp(),
                status: 'pending', // 처리 상태 (pending, approved, rejected)
            });
            toast.add({
                severity: 'success',
                summary: '요청 완료',
                detail: `'${symbol}' 추가 요청이 정상적으로 접수되었습니다.`,
                life: 3000,
            });
        } catch (error) {
            console.error('Error adding ticker request: ', error);
            toast.add({
                severity: 'error',
                summary: '요청 실패',
                detail: '요청 처리 중 오류가 발생했습니다.',
                life: 3000,
            });
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

    // 검색어가 변경될 때 전체 티커 로드
    watch(globalSearchQuery, (newQuery) => {
        if (newQuery && newQuery.trim()) {
            loadAllTickersForSearch();
        }
    });

    watch(mainFilterTab, () => {
        globalSearchQuery.value = null;
        loadAdditionalData();
    });
    watch(subFilterTab, () => {
        globalSearchQuery.value = null;
        loadAdditionalData();
    });

    return {
        isLoading,
        hasInitialLoadCompleted,
        error,
        selectedTicker,
        globalSearchQuery,
        isSearchActive,
        isSearchLoading,
        mainFilterTab,
        subFilterTab,
        myBookmarks,
        filteredTickers,
        handleStockBookmarkClick,
        onRowSelect,
        handleTickerRequest,
    };
}
