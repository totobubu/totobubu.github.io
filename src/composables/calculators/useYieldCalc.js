import { computed } from 'vue';

export function useYieldCalc({ quantity, dividendStats, payoutsPerYear, isUSD, exchangeRate, inputAmount }) {
    const inputAmountUSD = computed(() =>
        isUSD.value ? inputAmount.value : exchangeRate.value ? inputAmount.value / exchangeRate.value : 0
    );

    const expectedDividends = computed(() => {
        const calculate = (dividendPerShare, taxRateValue) => {
            if (!quantity.value || !dividendPerShare || !payoutsPerYear.value)
                return { perPayout: 0, monthly: 0, annual: 0 };
            const totalPerPayout = quantity.value * dividendPerShare * taxRateValue;
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

    return {
        inputAmountUSD,
        expectedDividends,
    };
}