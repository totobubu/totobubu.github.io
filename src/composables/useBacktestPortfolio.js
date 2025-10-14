// src/composables/useBacktestPortfolio.js
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { joinURL } from 'ufo';

export function useBacktestPortfolio() {
    const route = useRoute();
    const allSymbols = ref([]);
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

            allSymbols.value = activeItems.map((item) => item.symbol);
            navDataMap.value = new Map(
                activeItems.map((item) => [item.symbol, item])
            );
            initializePortfolioSymbol();
        } catch (e) {
            console.error('Failed to load navigation data:', e);
        }
    };

    const initializePortfolioSymbol = () => {
        const pathTicker = route.params.ticker?.toUpperCase();
        if (pathTicker && allSymbols.value.includes(pathTicker)) {
            portfolio.value[0].symbol = pathTicker;
        } else if (allSymbols.value.length > 0) {
            const shuffled = shuffleArray([...allSymbols.value]);
            portfolio.value[0].symbol = shuffled[0] || '';
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
            shuffleArray([...allSymbols.value]).find(
                (s) => s && !existingSymbols.has(s)
            ) || '';
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

    return {
        portfolio,
        allSymbols,
        displayPortfolio,
        totalValue,
        loadNavData,
        balanceWeights,
        addItem,
        removeItem,
        updatePortfolioItem,
        getMaxValueForSlider,
    };
}
