// src\composables\useSidebar.js
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { joinURL } from 'ufo';
import { useFilterState } from '@/composables/useFilterState';
import { user } from '../store/auth';
import { db } from '@/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from 'primevue/usetoast';

export function useSidebar() {
    const router = useRouter();
    const route = useRoute();
    const toast = useToast();

    const allTickers = ref([]);
    const popularityData = ref({});
    const isLoading = ref(true);
    const error = ref(null);
    const selectedTicker = ref(null);

    const {
        globalSearchQuery,
        mainFilterTab,
        subFilterTab,
        myBookmarks,
        toggleMyStock,
    } = useFilterState();

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

        const mainTab = mainFilterTab.value;
        const subTab = subFilterTab.value;
        let list = [];

        if (mainTab === '북마크') {
            return allTickers.value.filter((item) =>
                myBookmarkSymbols.has(item.symbol)
            );
        }

        const nonBookmarkedTickers = allTickers.value.filter(
            (item) => !myBookmarkSymbols.has(item.symbol)
        );

        if (mainTab === '미국') {
            const usTickers = nonBookmarkedTickers.filter(
                (item) => item.currency === 'USD'
            );
            if (subTab === 'ETF') {
                list = usTickers.filter(
                    (item) => item.company || item.underlying
                );
            } else {
                // 주식
                list = usTickers.filter(
                    (item) => !item.company && !item.underlying
                );
            }
        } else if (mainTab === '한국') {
            const krTickers = nonBookmarkedTickers.filter(
                (item) => item.currency === 'KRW'
            );
            if (subTab === 'ETF') {
                list = krTickers.filter(
                    (item) => item.company || item.underlying
                );
            } else {
                // 주식
                list = krTickers.filter(
                    (item) => !item.company && !item.underlying
                );
            }
        }

        list.sort(
            (a, b) =>
                (b.popularity || 0) - (a.popularity || 0) ||
                (b.marketCap || 0) - (a.marketCap || 0)
        );
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

    watch(mainFilterTab, () => {
        globalSearchQuery.value = null;
    });
    watch(subFilterTab, () => {
        globalSearchQuery.value = null;
    });

    return {
        isLoading,
        error,
        selectedTicker,
        globalSearchQuery,
        mainFilterTab,
        subFilterTab,
        myBookmarks,
        filteredTickers,
        handleStockBookmarkClick,
        onRowSelect,
        handleTickerRequest,
    };
}
