// REFACTORED: src/composables/useBacktestPortfolio.js
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { joinURL } from 'ufo';

async function registerNewTickers(portfolio, navDataMapRef) {
    const navMap = navDataMapRef.value;
    if (!navMap || navMap.size === 0) {
        console.warn('navDataMap is not ready for registering new tickers.');
        return;
    }

    const newTickers = portfolio.filter(
        (p) => p.symbol && !navMap.has(p.symbol)
    );

    if (newTickers.length === 0) return;

    console.log(
        'Registering new tickers:',
        newTickers.map((t) => t.symbol)
    );

    for (const ticker of newTickers) {
        try {
            // 국가 코드를 추정하여 검색 쿼리에 추가 (더 정확한 검색을 위해)
            const isKorean = /^\d{6}$/.test(ticker.symbol);
            const countryQuery = isKorean ? '&country=KR' : '&country=US';
            const searchRes = await fetch(
                `/api/searchSymbol?query=${ticker.symbol}${countryQuery}`
            );

            if (searchRes.ok) {
                const suggestions = await searchRes.json();
                const found = suggestions.find(
                    (s) =>
                        s.symbol.toUpperCase().replace(/\.(KS|KQ)$/, '') ===
                        ticker.symbol.toUpperCase()
                );

                if (found) {
                    console.log(
                        `Found new ticker info for ${ticker.symbol}:`,
                        found
                    );
                    await fetch('/api/addTicker', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            symbol: found.symbol.replace(/\.(KS|KQ)$/, ''),
                            market:
                                found.market === 'KOS' ? 'KOSPI' : found.market, // 'KOS' -> 'KOSPI'
                            longName: found.name,
                            koName: isKorean ? found.name : null,
                            currency:
                                found.symbol.endsWith('.KS') ||
                                found.symbol.endsWith('.KQ')
                                    ? 'KRW'
                                    : 'USD',
                        }),
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to register ${ticker.symbol}:`, error);
        }
    }
}

export function useBacktestPortfolio() {
    const route = useRoute();
    const allStocks = ref([]);
    const navDataMap = ref(new Map());
    const portfolio = ref([
        { symbol: '', value: 100, color: '#ef4444', underlying: null },
    ]);

    const displayPortfolio = computed(() => {
        const items = [...portfolio.value];
        const colors = ['#ef4444', '#f59e0b', '#84cc16', '#3b82f6'];
        items.forEach((item, index) => (item.color = colors[index]));
        if (items.length < 4) {
            items.push({ symbol: '', value: 0, color: colors[items.length] });
        }
        while (items.length < 4) {
            items.push({ symbol: null, value: 0 });
        }
        return items;
    });

    const totalValue = computed(() =>
        portfolio.value.reduce((sum, item) => sum + (item.value || 0), 0)
    );

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const loadNavData = async () => {
        try {
            const navUrl = joinURL(import.meta.env.BASE_URL, 'nav.json');
            const response = await fetch(navUrl);
            const navData = await response.json();
            const activeItems = navData.nav.filter((item) => !item.upcoming);

            allStocks.value = activeItems;
            navDataMap.value = new Map(
                activeItems.map((item) => [item.symbol, item])
            );
            initializePortfolioSymbol();
        } catch (e) {
            console.error('Failed to load navigation data:', e);
        }
    };

    const initializePortfolioSymbol = () => {
        const pathTicker = route.params.ticker
            ?.toUpperCase()
            .replace(/-/g, '.');
        if (pathTicker && navDataMap.value.has(pathTicker)) {
            portfolio.value[0].symbol = pathTicker;
        } else if (allStocks.value.length > 0) {
            const shuffled = shuffleArray([...allStocks.value]);
            portfolio.value[0].symbol = shuffled[0]?.symbol || '';
        }
    };

    const updateUnderlying = (item) => {
        const navInfo = navDataMap.value.get(item.symbol?.toUpperCase());
        item.underlying = navInfo?.underlying || null;
    };

    const adjustFirstWeight = () => {
        if (portfolio.value.length > 0 && portfolio.value[0].symbol) {
            const otherSum = portfolio.value
                .slice(1)
                .reduce((sum, item) => sum + (item.value || 0), 0);
            const cappedOtherSum = Math.min(otherSum, 99);
            portfolio.value[0].value = 100 - cappedOtherSum;
        }
    };

    watch(
        portfolio,
        (newPortfolio) => {
            newPortfolio.forEach((item) => {
                if (item.symbol) updateUnderlying(item);
            });
            adjustFirstWeight();
        },
        { deep: true }
    );

    const balanceWeights = () => {
        const activeItems = portfolio.value.filter((p) => p.symbol);
        if (activeItems.length === 0) return;
        const equalWeight = Math.floor(100 / activeItems.length);
        let remainder = 100 % activeItems.length;
        activeItems.forEach((item) => {
            item.value = equalWeight + (remainder-- > 0 ? 1 : 0);
        });
        adjustFirstWeight();
    };

    const addItem = () => {
        if (portfolio.value.length >= 4) return;
        const existingSymbols = new Set(portfolio.value.map((p) => p.symbol));
        const newSymbol =
            shuffleArray([...allStocks.value]).find(
                (s) => s.symbol && !existingSymbols.has(s.symbol)
            )?.symbol || '';
        portfolio.value.push({ symbol: newSymbol, value: 0 });
        balanceWeights();
    };

    const removeItem = (index) => {
        if (index > 0 && index < portfolio.value.length) {
            portfolio.value.splice(index, 1);
            balanceWeights();
        }
    };

    const updatePortfolioItem = (index, newItem) => {
        if (index < portfolio.value.length) {
            portfolio.value[index] = newItem;
        }
    };

    const getMaxValueForSlider = (itemIndex) => {
        if (itemIndex === 0) return 100;
        const otherSecondarySum = portfolio.value.reduce((sum, item, index) => {
            if (index > 0 && index !== itemIndex) sum += item.value || 0;
            return sum;
        }, 0);
        return 99 - otherSecondarySum;
    };

    // --- [핵심 수정] ---
    // searchStock과 관련된 모든 코드를 제거합니다.

    return {
        portfolio,
        allStocks,
        navDataMap, // navDataMap 내보내기
        displayPortfolio,
        totalValue,
        loadNavData,
        balanceWeights,
        addItem,
        removeItem,
        updatePortfolioItem,
        getMaxValueForSlider,
        registerNewTickers,
    };
}
