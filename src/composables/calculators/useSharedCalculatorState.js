// src\composables\calculators\useSharedCalculatorState.js
import { ref, computed, watch } from 'vue';
import { useDividendStats } from '@/composables/useDividendStats';
import { user } from '@/store/auth';
import { useFilterState } from '@/composables/useFilterState';

export function useSharedCalculatorState(props) {
    // --- Props 기반 Computed ---
    const tickerInfo = computed(() => props.tickerInfo);
    const dividendHistory = computed(() => props.dividendHistory);
    const userBookmark = computed(() => props.userBookmark || {});
    const currency = computed(() => props.tickerInfo?.currency || 'USD');
    const isUSD = computed(() => currency.value === 'USD');
    const currencyLocale = computed(() => (isUSD.value ? 'en-US' : 'ko-KR'));
    const currentPrice = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );

    // --- 공통 입력 상태 ---
    const avgPrice = ref(0);
    const quantity = ref(100);
    const period = ref('5');
    const periodOptions = ref([
        { label: '최근 5회', value: '5' },
        { label: '최근 10회', value: '10' },
        { label: '최근 20회', value: '20' },
        { label: '전체 기간', value: 'ALL' },
    ]);
    const applyTax = ref(true);
    const taxOptions = ref([
        { label: '세전', value: false },
        { label: '세후 (15%)', value: true },
    ]);

    // --- 공통 파생 상태 ---
    const investmentPrincipal = computed(
        () => (quantity.value || 0) * (avgPrice.value || 0)
    );
    const currentValue = computed(
        () => (quantity.value || 0) * currentPrice.value
    );
    const profitLossRate = computed(() =>
        investmentPrincipal.value === 0
            ? 0
            : ((currentValue.value - investmentPrincipal.value) /
                  investmentPrincipal.value) *
              100
    );
    const currentAssets = computed(
        () => (quantity.value || 0) * currentPrice.value
    );
    const { dividendStats, payoutsPerYear } = useDividendStats(
        dividendHistory,
        tickerInfo,
        period
    );

    // --- 유틸 및 메소드 ---
    const { updateBookmarkDetails } = useFilterState();
    const getDefaultQuantity = () => {
        if (!currentPrice.value) return 100;
        if (isUSD.value) {
            if (currentPrice.value >= 1000) return 10;
            if (currentPrice.value >= 100) return 100;
            if (currentPrice.value >= 10) return 1000;
        } else {
            if (currentPrice.value >= 1000000) return 10;
            if (currentPrice.value >= 100000) return 100;
            if (currentPrice.value >= 10000) return 1000;
        }
        return 100;
    };

    // [핵심 수정] reactive 제거, 모든 상태를 ref/computed 그대로 반환
    return {
        tickerInfo,
        dividendHistory,
        userBookmark,
        currency,
        isUSD,
        currencyLocale,
        currentPrice,
        avgPrice,
        quantity,
        period,
        periodOptions,
        applyTax,
        taxOptions,
        investmentPrincipal,
        currentValue,
        profitLossRate,
        currentAssets,
        dividendStats,
        payoutsPerYear,
        updateBookmarkDetails,
        user,
        getDefaultQuantity,
    };
}
