<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useDividendStats } from '@/composables/useDividendStats';
    import Card from 'primevue/card';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import InputNumber from 'primevue/inputnumber';
    import SelectButton from 'primevue/selectbutton';
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import IftaLabel from 'primevue/iftalabel';
    import RadioButton from 'primevue/radiobutton';

    const props = defineProps({
        tickerInfo: Object,
        dividendHistory: Array,
    });

    const { deviceType } = useBreakpoint();
    const calculationMode = ref('quantity');
    const inputAmountKRW = ref(0);
    const inputQuantity = ref(100);
    const exchangeRate = ref(1380);
    const dividendPeriod = ref('1Y');
    const periodOptions = ref([
        { label: '前 3M', value: '3M' },
        { label: '前 6M', value: '6M' },
        { label: '前 1Y', value: '1Y' },
    ]);
    const isInitialized = ref(false);

    const { dividendStats, payoutsPerYear } = useDividendStats(
        computed(() => props.dividendHistory),
        computed(() => props.tickerInfo),
        dividendPeriod
    );

    const currency = computed(() => props.tickerInfo?.currency || 'USD');

    const inputAmountUSD = computed({
        get: () =>
            exchangeRate.value ? inputAmountKRW.value / exchangeRate.value : 0,
        set: (newValue) => {
            if (exchangeRate.value)
                inputAmountKRW.value = newValue * exchangeRate.value;
        },
    });

    const currentPrice = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );

    watch(inputAmountKRW, (newKRW) => {
        if (
            calculationMode.value === 'amount' &&
            currentPrice.value > 0 &&
            exchangeRate.value > 0
        ) {
            const budgetUSD = newKRW / exchangeRate.value;
            inputQuantity.value = Math.floor(budgetUSD / currentPrice.value);
        }
    });

    watch(inputQuantity, (newQuantity) => {
        if (
            calculationMode.value === 'quantity' &&
            currentPrice.value > 0 &&
            exchangeRate.value > 0
        ) {
            const totalValueUSD = newQuantity * currentPrice.value;
            inputAmountKRW.value = totalValueUSD * exchangeRate.value;
        }
    });

    const expectedDividendsByScenario = computed(() => {
        const calculate = (dividendPerShare, taxRate) => {
            if (
                inputQuantity.value === 0 ||
                dividendPerShare === 0 ||
                payoutsPerYear.value === 0
            ) {
                return { perPayout: 0, monthly: 0, quarterly: 0, annual: 0 };
            }
            const totalDividendPerPayout =
                inputQuantity.value * dividendPerShare * taxRate;
            const annualDividend =
                totalDividendPerPayout * payoutsPerYear.value;
            return {
                perPayout: totalDividendPerPayout,
                monthly: annualDividend / 12,
                quarterly: annualDividend / 4,
                annual: annualDividend,
            };
        };
        const createScenarios = (taxRate) => ({
            hope: calculate(dividendStats.value.max, taxRate),
            avg: calculate(dividendStats.value.avg, taxRate),
            despair: calculate(dividendStats.value.min, taxRate),
        });
        return { preTax: createScenarios(1.0), postTax: createScenarios(0.85) };
    });

    const calculateInitialAmount = () => {
        if (
            isInitialized.value ||
            currentPrice.value <= 0 ||
            exchangeRate.value <= 0
        )
            return;
        if (currency.value === 'KRW') {
            inputAmountKRW.value = inputQuantity.value * currentPrice.value;
        } else {
            inputAmountKRW.value =
                inputQuantity.value * currentPrice.value * exchangeRate.value;
        }
        isInitialized.value = true;
    };

    onMounted(async () => {
        try {
            const response = await fetch('/api/getExchangeRate');
            const data = await response.json();
            exchangeRate.value = data.price;
        } catch (error) {
            console.error(error);
            exchangeRate.value = 1380;
        } finally {
            calculateInitialAmount();
        }
    });

    watch(currentPrice, calculateInitialAmount);

    const formatToCurrency = (amount, targetCurrency) => {
        const locale = targetCurrency === 'KRW' ? 'ko-KR' : 'en-US';
        const options = {
            style: 'currency',
            currency: targetCurrency,
            minimumFractionDigits: targetCurrency === 'KRW' ? 0 : 2,
            maximumFractionDigits: targetCurrency === 'KRW' ? 0 : 2,
        };
        return new Intl.NumberFormat(locale, options).format(amount);
    };

    const formatDisplayValue = (usdAmount) => {
        if (currency.value === 'KRW') {
            return formatToCurrency(usdAmount * exchangeRate.value, 'KRW');
        }
        return formatToCurrency(usdAmount, 'USD');
    };
</script>

<template>
    <div
        class="toto-calculator-grid"
        :class="
            deviceType === 'desktop'
                ? 'toto-calculator-grid-row'
                : 'toto-calculator-grid-column'
        ">
        <div class="toto-calculator-option">
            <div class="flex align-items-center mb-2 justify-content-between">
                <Tag severity="contrast"
                    >환율 : {{ exchangeRate?.toLocaleString('ko-KR') }}원</Tag
                >
                <Tag severity="contrast"
                    >현재 주가 :
                    {{ formatToCurrency(currentPrice, currency) }}</Tag
                >
            </div>
            <div class="toto-howmuch">
                <InputGroup v-if="currency === 'USD'">
                    <InputGroupAddon
                        ><RadioButton
                            v-model="calculationMode"
                            inputId="modeAmount"
                            name="calcMode"
                            value="amount"
                    /></InputGroupAddon>
                    <InputGroupAddon
                        ><i class="pi pi-dollar"
                    /></InputGroupAddon>
                    <InputNumber
                        placeholder="투자 금액 (KRW)"
                        v-model="inputAmountKRW"
                        mode="currency"
                        currency="KRW"
                        locale="ko-KR" />
                    <InputNumber
                        placeholder="투자 금액 (USD)"
                        v-model="inputAmountUSD"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon
                        ><RadioButton
                            v-model="calculationMode"
                            inputId="modeQuantity"
                            name="calcMode"
                            value="quantity"
                    /></InputGroupAddon>
                    <InputGroupAddon><i class="pi pi-box" /></InputGroupAddon>
                    <InputNumber
                        inputId="input-quantity"
                        v-model="inputQuantity"
                        suffix=" 주"
                        class="w-full" />
                </InputGroup>
            </div>
            <InputGroup class="toto-reference-period">
                <IftaLabel>
                    <SelectButton
                        v-model="dividendPeriod"
                        :options="periodOptions"
                        optionLabel="label"
                        optionValue="value" />
                    <label
                        ><span>前 배당금 참고 기간</span
                        ><Tag severity="contrast">{{
                            dividendPeriod
                        }}</Tag></label
                    >
                </IftaLabel>
            </InputGroup>
        </div>
        <Divider v-if="deviceType !== 'desktop'" />
        <Card class="toto-calculator-result flex-1 toto-howmuch-result">
            <template #content>
                <table class="w-full text-center">
                    <colgroup>
                        <col />
                        <col style="width: 15%" />
                        <col style="width: 25%" />
                        <col style="width: 25%" />
                        <col style="width: 25%" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th></th>
                            <th>세금</th>
                            <th>희망</th>
                            <th>평균</th>
                            <th>절망</th>
                        </tr>
                        <tr>
                            <th rowspan="2">기준 배당금</th>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <th>
                                {{
                                    formatToCurrency(
                                        dividendStats.max,
                                        currency
                                    )
                                }}
                            </th>
                            <th>
                                {{
                                    formatToCurrency(
                                        dividendStats.avg,
                                        currency
                                    )
                                }}
                            </th>
                            <th>
                                {{
                                    formatToCurrency(
                                        dividendStats.min,
                                        currency
                                    )
                                }}
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <th>
                                {{
                                    formatToCurrency(
                                        dividendStats.max * 0.85,
                                        currency
                                    )
                                }}
                            </th>
                            <th>
                                {{
                                    formatToCurrency(
                                        dividendStats.avg * 0.85,
                                        currency
                                    )
                                }}
                            </th>
                            <th>
                                {{
                                    formatToCurrency(
                                        dividendStats.min * 0.85,
                                        currency
                                    )
                                }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="p-2 font-semibold" rowspan="2">1회당</td>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax.hope
                                            .perPayout
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax.avg
                                            .perPayout
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax
                                            .despair.perPayout
                                    )
                                }}
                            </td>
                        </tr>
                        <tr class="border-b border-surface-800">
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax.hope
                                            .perPayout
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax.avg
                                            .perPayout
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax
                                            .despair.perPayout
                                    )
                                }}
                            </td>
                        </tr>
                        <tr>
                            <td class="p-2 font-semibold" rowspan="2">월간</td>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax.hope
                                            .monthly
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax.avg
                                            .monthly
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax
                                            .despair.monthly
                                    )
                                }}
                            </td>
                        </tr>
                        <tr class="border-b border-surface-800">
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax.hope
                                            .monthly
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax.avg
                                            .monthly
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax
                                            .despair.monthly
                                    )
                                }}
                            </td>
                        </tr>
                        <tr>
                            <td class="p-2 font-semibold" rowspan="2">연간</td>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax.hope
                                            .annual
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax.avg
                                            .annual
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.preTax
                                            .despair.annual
                                    )
                                }}
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax.hope
                                            .annual
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax.avg
                                            .annual
                                    )
                                }}
                            </td>
                            <td>
                                {{
                                    formatDisplayValue(
                                        expectedDividendsByScenario.postTax
                                            .despair.annual
                                    )
                                }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </template>
        </Card>
    </div>
</template>
