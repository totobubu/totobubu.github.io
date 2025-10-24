import { ref, computed, watch } from 'vue';

export function useYieldCalc(commonState) {
    const {
        quantity,
        dividendStats,
        payoutsPerYear,
        currentPrice,
        isUSD,
        exchangeRate,
    } = commonState;

    // --- State ---
    const yieldCalcMode = ref('quantity');
    const inputAmount = ref(isUSD.value ? 10000 : 10000000);

    // --- Computed ---
    const inputAmountUSD = computed(() =>
        isUSD.value
            ? inputAmount.value
            : exchangeRate.value
              ? inputAmount.value / exchangeRate.value
              : 0
    );

    const expectedDividends = computed(() => {
        const calculate = (dividendPerShare, taxRateValue) => {
            if (!quantity.value || !dividendPerShare || !payoutsPerYear.value)
                return { perPayout: 0, monthly: 0, annual: 0 };
            const totalPerPayout =
                quantity.value * dividendPerShare * taxRateValue;
            const annual = totalPerPayout * payoutsPerYear.value;
            return { perPayout: totalPerPayout, monthly: annual / 12, annual };
        };
        const createScenarios = (tax) => ({
            hope: calculate(dividendStats.value.max, tax),
            avg: calculate(dividendStats.value.avg, tax),
            despair: calculate(dividendStats.value.min, tax),
        });
        return { preTax: createScenarios(1.0), postTax: createScenarios(0.85) };
    });

    // --- Watchers for Syncing ---
    watch([inputAmount, yieldCalcMode], () => {
        if (
            yieldCalcMode.value === 'amount' &&
            currentPrice.value > 0 &&
            inputAmountUSD.value > 0
        ) {
            quantity.value = Math.floor(
                inputAmountUSD.value / currentPrice.value
            );
        }
    });

    watch([quantity, yieldCalcMode], () => {
        if (yieldCalcMode.value === 'quantity' && currentPrice.value > 0) {
            const totalValue = quantity.value * currentPrice.value;
            inputAmount.value = isUSD.value
                ? totalValue
                : totalValue * exchangeRate.value;
        }
    });

    return {
        yieldCalcMode,
        inputAmount,
        inputAmountUSD,
        expectedDividends,
    };
}
