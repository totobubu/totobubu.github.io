// src/composables/useSidebar.js

import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useFilterState } from '@/composables/useFilterState';
import { getDataUrl } from '@/utils/dataUrl';
import { user } from '../store/auth';
import { db } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from 'primevue/usetoast';
import {
    ensureInstrumentDirectory,
    registerInstruments,
    resolveInstrument,
    resolveInstrumentByIsin,
    resolveInstrumentBySymbol,
} from '@/store/instruments';

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
            await ensureInstrumentDirectory();
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

            allTickersForSearch.value = (navData.nav || [])
                .filter((item) => !item.upcoming)
                .map((item) => {
                    let isEtf = !!(item.company || item.underlying);
                    if (!isEtf && item.koName) {
                        isEtf = koreanEtfBrands.some((brand) =>
                            item.koName.startsWith(brand)
                        );
                    }

                    const symbol = item.symbol;
                    if (!symbol) return null;
                    const normalizedSymbol = symbol.toUpperCase();
                    const storeInstrument =
                        resolveInstrumentBySymbol(normalizedSymbol) || {};
                    const isin = item.isin || storeInstrument.isin || null;
                    if (!isin) return null;

                    const ticker = {
                        isin,
                        symbol: normalizedSymbol,
                        currency: item.currency || 'USD',
                        market: item.market || storeInstrument.market,
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
                })
                .filter((ticker) => ticker && ticker.isin);
            registerInstruments(allTickersForSearch.value, {
                markInitialized: true,
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

        return allTickersForSearch.value.filter(
            (item) => item && item.isin && filterFn(item)
        );
    };

    // --- [핵심 수정] filteredTickers 로직 변경 ---
    const bookmarkEntries = computed(() =>
        Object.values(myBookmarks.value || {})
    );
    const bookmarkedIsins = computed(() => {
        const set = new Set();
        bookmarkEntries.value.forEach((entry) => {
            if (entry?.isin) set.add(entry.isin);
        });
        return set;
    });
    const bookmarkedSymbols = computed(() => {
        const set = new Set();
        bookmarkEntries.value.forEach((entry) => {
            if (entry?.symbol) set.add(entry.symbol);
        });
        return set;
    });
    const isInBookmarks = (ticker) => {
        if (!ticker) return false;
        if (ticker.isin && bookmarkedIsins.value.has(ticker.isin)) return true;
        if (ticker.symbol) {
            return bookmarkedSymbols.value.has(ticker.symbol.toUpperCase());
        }
        return false;
    };

    const filteredTickers = computed(() => {
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

            const searchResults = allTickersForSearch.value.filter((item) => {
                const symbolLower = (item.symbol || '').toLowerCase();
                const matchIndex = symbolLower.indexOf(query);
                const dotIndex = symbolLower.indexOf('.');
                const matchesSymbol =
                    query.includes('.') ||
                    (matchIndex !== -1 &&
                        (dotIndex === -1 || matchIndex < dotIndex));

                const matchesKoName =
                    item.koName && item.koName.toLowerCase().includes(query);
                const matchesLongName =
                    item.longName &&
                    item.longName.toLowerCase().includes(query);

                return matchesSymbol || matchesKoName || matchesLongName;
            });

            return searchResults;
        }

        // 2. 검색어가 없는 경우: 현재 탭에 따라 기본 목록(baseList)을 결정
        if (mainTab === '북마크') {
            const matched = allTickers.value.filter((item) =>
                isInBookmarks(item)
            );
            const missing = [];
            bookmarkedIsins.value.forEach((isin) => {
                const exists = matched.find((item) => item.isin === isin);
                if (!exists) {
                    const bookmark = myBookmarks.value[isin];
                    if (bookmark) {
                        missing.push({
                            isin,
                            symbol: bookmark.symbol,
                            currency: bookmark.currency,
                            market: bookmark.market,
                            isEtf: bookmark.isEtf ?? null,
                            koName: null,
                            longName: null,
                            popularity: 0,
                        });
                    }
                }
            });
            baseList = [...matched, ...missing];
        } else if (mainTab === '미국') {
            baseList = allTickers.value.filter(
                (item) => item.currency === 'USD'
            );
        } else if (mainTab === '한국') {
            baseList = allTickers.value.filter(
                (item) => item.currency === 'KRW'
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
            marketTickers = marketTickers
                .map((item) => {
                    if (!item) return null;
                    const normalizedSymbol = item.symbol
                        ? item.symbol.toUpperCase()
                        : null;
                    const instrument =
                        (item.isin && resolveInstrumentByIsin(item.isin)) ||
                        (normalizedSymbol &&
                            resolveInstrumentBySymbol(normalizedSymbol)) ||
                        null;
                    const isin = item.isin || instrument?.isin || null;
                    if (!isin) return null;
                    return {
                        ...item,
                        symbol: normalizedSymbol || instrument?.symbol,
                        isin,
                        market: item.market || instrument?.market || null,
                        currency: item.currency || instrument?.currency || null,
                    };
                })
                .filter((item) => item && item.isin);
            if (marketTickers.length === 0) {
                marketTickers = await fallbackTickersByMarket(marketKey);
            }

            if (marketTickers.length > 0) {
                const existingIsins = new Set(
                    allTickers.value.map((item) => item.isin)
                );
                const deduped = marketTickers.filter(
                    (item) => item.isin && !existingIsins.has(item.isin)
                );
                allTickers.value = [...allTickers.value, ...deduped];
                registerInstruments(deduped);
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
                const existingIsins = new Set(
                    allTickers.value.map((item) => item.isin)
                );
                const deduped = fallback.filter(
                    (item) => item.isin && !existingIsins.has(item.isin)
                );
                allTickers.value = [...allTickers.value, ...deduped];
                registerInstruments(deduped);
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

    const handleStockBookmarkClick = (ticker) => {
        if (!ticker) return;

        const instrument =
            typeof ticker === 'string'
                ? resolveInstrumentBySymbol(ticker)
                : resolveInstrument({
                      symbol: ticker.symbol,
                      isin: ticker.isin,
                      market: ticker.market,
                      currency: ticker.currency,
                  }) || resolveInstrumentBySymbol(ticker.symbol);

        const payload =
            instrument ||
            (typeof ticker === 'object' && ticker.isin
                ? {
                      ...ticker,
                      symbol: ticker.symbol?.toUpperCase() || null,
                      isin: ticker.isin?.toUpperCase(),
                  }
                : null);

        if (!payload) return;

        if (!user.value) {
            toast.add({
                severity: 'warn',
                summary: '로그인 필요',
                detail: '북마크를 사용하려면 로그인해 주세요.',
                life: 2500,
            });
            router.push('/login');
            return;
        }

        const result = toggleMyStock(payload);
        const isKoreanTicker = (payload.currency || '').toUpperCase() === 'KRW';
        const displaySymbol = isKoreanTicker
            ? payload.koName || payload.symbol || payload.isin || '알 수 없음'
            : payload.symbol || payload.koName || payload.isin || '알 수 없음';
        if (result === 'added') {
            toast.add({
                severity: 'success',
                summary: '북마크 추가',
                detail: `'${displaySymbol}'을(를) 북마크에 추가했습니다.`,
                life: 2000,
            });
        } else if (result === 'removed') {
            toast.add({
                severity: 'info',
                summary: '북마크 해제',
                detail: `'${displaySymbol}' 북마크를 해제했습니다.`,
                life: 2000,
            });
        }
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

    const isTickerBookmarked = (ticker) => isInBookmarks(ticker);

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
        isTickerBookmarked,
        handleStockBookmarkClick,
        onRowSelect,
        handleTickerRequest,
    };
}
