<!-- src/components/calculators/StockCalculatorsUnified.vue -->
<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useDividendStats } from '@/composables/useDividendStats';
    import { useRecoveryChart } from '@/composables/charts/useRecoveryChart.js';
    import { useReinvestmentChart } from '@/composables/charts/useReinvestmentChart.js';
    import { useFilterState } from '@/composables/useFilterState';
    import { user } from '@/store/auth';
    import { formatMonthsToYears } from '@/utils/date.js';
    import VChart from 'vue-echarts';

    // PrimeVue Imports
    import CalculatorLayout from './CalculatorLayout.vue'; // CalculatorLayout.vue를 다시 사용합니다.
    import Button from 'primevue/button';
    import Card from 'primevue/card';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import SelectButton from 'primevue/selectbutton';
    import Tag from 'primevue/tag';
    import Slider from 'primevue/slider';
    import FloatLabel from 'primevue/floatlabel';
    import IftaLabel from 'primevue/iftalabel';
    import ProgressSpinner from 'primevue/progressspinner';

    const props = defineProps({
        activeCalculator: String,
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const emit = defineEmits(['update-header-info']);

    const tickerInfo = computed(() => props.tickerInfo);
    const dividendHistory = computed(() => props.dividendHistory);
    const userBookmark = computed(() => props.userBookmark || {});
    const currency = computed(() => props.tickerInfo?.currency || 'USD');
    const isUSD = computed(() => currency.value === 'USD');
    const currencyLocale = computed(() => (isUSD.value ? 'en-US' : 'ko-KR'));
    const currentPrice = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );

    const avgPrice = ref(0);
    const quantity = ref(100);
    const period = ref('5');
    const periodOptions = ref([
        { label: '최근 5회', value: '5' },
        { label: '최근 10회', value: '10' },
        { label: '최근 20회', value: '20' },
        // { label: '전체 기간', value: 'ALL' },
    ]);
    const applyTax = ref(true);
    const taxOptions = ref([
        { label: '세전', value: false },
        { label: '세후 (15%)', value: true },
    ]);

    const { dividendStats, payoutsPerYear } = useDividendStats(
        dividendHistory,
        tickerInfo,
        period
    );

    // Recovery Calculator state
    const accumulatedDividend = ref(
        userBookmark.value?.accumulatedDividend || 0
    );
    const recoveryCalcMode = ref('amount');
    const investmentPrincipal = computed(
        () => (quantity.value || 0) * (avgPrice.value || 0)
    );
    const recoveryRate = computed({
        get: () =>
            investmentPrincipal.value === 0
                ? 0
                : (accumulatedDividend.value / investmentPrincipal.value) * 100,
        set: (val) => {
            accumulatedDividend.value = investmentPrincipal.value * (val / 100);
        },
    });

    // Reinvestment Calculator state
    const targetAsset = ref(
        userBookmark.value?.targetAsset || (isUSD.value ? 100000 : 100000000)
    );
    const annualGrowthRate = ref(0);
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

    // Yield Calculator state
    const yieldCalcMode = ref('quantity');
    const inputAmount = ref(isUSD.value ? 10000 : 10000000);
    const exchangeRate = ref(1380);

    watch(inputAmount, (newAmount) => {
        if (yieldCalcMode.value === 'amount' && currentPrice.value > 0) {
            quantity.value = Math.floor(newAmount / currentPrice.value);
        }
    });
    watch(quantity, (newQuantity) => {
        if (yieldCalcMode.value === 'quantity' && currentPrice.value > 0) {
            inputAmount.value = newQuantity * currentPrice.value;
        }
    });

    const documentStyle = getComputedStyle(document.documentElement);
    const chartTheme = computed(() => ({
        textColor: documentStyle.getPropertyValue('--p-text-color'),
        textColorSecondary: documentStyle.getPropertyValue(
            '--p-text-muted-color'
        ),
        surfaceBorder: documentStyle.getPropertyValue(
            '--p-content-border-color'
        ),
    }));

    const { recoveryTimes, chartOptions: recoveryChartOptions } =
        useRecoveryChart({
            avgPrice,
            quantity,
            accumulatedDividend,
            dividendStats,
            payoutsPerYear,
            applyTax,
            currentPrice,
            currency,
            theme: chartTheme,
        });

    const { goalAchievementTimes, chartOptions: reinvestmentChartOptions } =
        useReinvestmentChart({
            currentAssets: currentValue,
            targetAmount: targetAsset,
            payoutsPerYear,
            dividendStats,
            annualGrowthRateScenario: computed(
                () => annualGrowthRate.value / 100
            ),
            applyTax,
            currentPrice,
            currency,
            theme: chartTheme,
        });

    const expectedDividends = computed(() => {
        const calculate = (dividendPerShare, taxRate) => {
            if (!quantity.value || !dividendPerShare || !payoutsPerYear.value)
                return { perPayout: 0, monthly: 0, annual: 0 };
            const total = quantity.value * dividendPerShare * taxRate;
            const annual = total * payoutsPerYear.value;
            return { perPayout: total, monthly: annual / 12, annual };
        };
        const scenarios = (tax) => ({
            hope: calculate(dividendStats.value.max, tax),
            avg: calculate(dividendStats.value.avg, tax),
            despair: calculate(dividendStats.value.min, tax),
        });
        return { preTax: scenarios(1.0), postTax: scenarios(0.85) };
    });

    const isReady = computed(
        () =>
            dividendStats.value &&
            recoveryTimes.value &&
            goalAchievementTimes.value &&
            expectedDividends.value
    );

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
        return 10000;
    };

    const setInputValues = (source = {}) => {
        avgPrice.value = source.avgPrice || currentPrice.value || 0;
        quantity.value = source.quantity || getDefaultQuantity();
        accumulatedDividend.value = source.accumulatedDividend || 0;
        targetAsset.value =
            source.targetAsset || (isUSD.value ? 100000 : 100000000);
    };
    const saveToBookmark = () => {
        if (user.value && props.tickerInfo?.symbol) {
            updateBookmarkDetails(props.tickerInfo.symbol, {
                avgPrice: avgPrice.value,
                quantity: quantity.value,
                accumulatedDividend: accumulatedDividend.value,
                targetAsset: targetAsset.value,
            });
        }
    };

    const loadFromBookmark = () =>
        props.userBookmark && setInputValues(props.userBookmark);
    const resetToCurrentPrice = () => setInputValues();
    defineExpose({ saveToBookmark, loadFromBookmark, resetToCurrentPrice });

    watch(
        () => currentPrice.value,
        (newPrice) => {
            if (newPrice > 0) setInputValues(userBookmark.value || {});
        },
        { immediate: true }
    );

    const formatKRW = (amount) =>
        (amount * exchangeRate.value).toLocaleString('ko-KR', {
            maximumFractionDigits: 0,
        }) + '원';

    watch(
        [() => currentPrice.value, exchangeRate, () => isUSD.value],
        () => {
            emit('update-header-info', {
                currentPrice: currentPrice.value,
                exchangeRate: exchangeRate.value,
                isUSD: isUSD.value,
                currency: currency.value,
                currencyLocale: currencyLocale.value,
            });
        },
        { immediate: true, deep: true }
    );

    onMounted(async () => {
        if (!isUSD.value) return;
        try {
            const res = await fetch('/api/getExchangeRate');
            if (res.ok) exchangeRate.value = (await res.json()).price;
        } catch (e) {
            console.error(e);
        }
    });
</script>

<template>
    <div v-if="isReady">
        <CalculatorLayout>
            <!-- [UI 통합] '평단/수량' 또는 '매수금/수량' UI를 동적으로 교체 -->
            <template #avgPriceAndQuantity>
                <div class="flex flex-column gap-3">
                    <div v-if="activeCalculator !== 'yield'">
                        <InputGroup>
                            <IftaLabel>
                                <InputNumber
                                    v-model="avgPrice"
                                    :mode="isUSD ? 'currency' : 'decimal'"
                                    :currency="currency"
                                    :locale="currencyLocale"
                                    inputId="avgPrice" />
                                <label for="avgPrice">평단</label>
                            </IftaLabel>
                            <IftaLabel>
                                <InputNumber
                                    v-model="quantity"
                                    suffix=" 주"
                                    min="1"
                                    inputId="quantity" />
                                <label for="quantity">수량</label>
                            </IftaLabel>
                        </InputGroup>
                    </div>
                    <div v-else>
                        <InputGroup>
                            <InputGroupAddon>
                                <RadioButton
                                    v-model="yieldCalcMode"
                                    value="amount" />
                            </InputGroupAddon>
                            <IftaLabel>
                                <InputNumber
                                    v-model="inputAmount"
                                    :mode="isUSD ? 'currency' : 'decimal'"
                                    :currency="currency"
                                    :locale="currencyLocale"
                                    :disabled="yieldCalcMode !== 'amount'" />
                                <label>매수금</label>
                            </IftaLabel>
                        </InputGroup>
                        <InputGroup>
                            <InputGroupAddon>
                                <RadioButton
                                    v-model="yieldCalcMode"
                                    value="quantity" />
                            </InputGroupAddon>
                            <IftaLabel>
                                <InputNumber
                                    v-model="quantity"
                                    suffix=" 주"
                                    min="1"
                                    :disabled="yieldCalcMode !== 'quantity'" />
                                <label>수량</label>
                            </IftaLabel>
                        </InputGroup>
                    </div>
                </div>
            </template>

            <template #investmentPrincipalAndCurrentValue>
                <InputGroup
                    v-if="activeCalculator !== 'yield'"
                    :class="{ 'p-disabled': activeCalculator === 'yield' }">
                    <FloatLabel variant="on">
                        <InputNumber
                            :modelValue="investmentPrincipal"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            disabled />
                        <label>투자원금</label>
                    </FloatLabel>
                    <FloatLabel variant="on">
                        <InputNumber
                            :modelValue="currentValue"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            disabled />
                        <label>현재가치</label>
                    </FloatLabel>
                    <Tag
                        :severity="profitLossRate >= 0 ? 'success' : 'danger'"
                        :value="`${profitLossRate.toFixed(2)}%`" />
                </InputGroup>
            </template>

            <template #accumulatedDividend>
                <div
                    class="flex flex-column gap-3"
                    :class="{ 'p-disabled': activeCalculator !== 'recovery' }">
                    <InputGroup>
                        <InputGroupAddon
                            ><RadioButton
                                v-model="recoveryCalcMode"
                                value="amount"
                                :disabled="activeCalculator !== 'recovery'"
                        /></InputGroupAddon>
                        <InputGroupAddon
                            ><i
                                :class="
                                    isUSD ? 'pi pi-dollar' : 'pi pi-won-sign'
                                "
                        /></InputGroupAddon>
                        <FloatLabel variant="on">
                            <InputNumber
                                v-model="accumulatedDividend"
                                :mode="isUSD ? 'currency' : 'decimal'"
                                :currency="currency"
                                :locale="currencyLocale"
                                :disabled="
                                    recoveryCalcMode !== 'amount' ||
                                    activeCalculator !== 'recovery'
                                " />
                            <label>누적 배당금</label>
                        </FloatLabel>
                    </InputGroup>
                    <InputGroup>
                        <InputGroupAddon
                            ><RadioButton
                                v-model="recoveryCalcMode"
                                value="rate"
                                :disabled="activeCalculator !== 'recovery'"
                        /></InputGroupAddon>
                        <InputGroupAddon
                            ><i class="pi pi-percentage"
                        /></InputGroupAddon>
                        <InputGroupAddon class="text-xs"
                            ><span
                                >{{ recoveryRate.toFixed(2) }} %</span
                            ></InputGroupAddon
                        >
                        <div
                            class="toto-range w-full p-inputtext"
                            :disabled="
                                recoveryCalcMode !== 'rate' ||
                                activeCalculator !== 'recovery'
                            ">
                            <Slider
                                v-model="recoveryRate"
                                :min="0"
                                :max="99.99"
                                :step="0.01"
                                class="w-full"
                                :disabled="
                                    recoveryCalcMode !== 'rate' ||
                                    activeCalculator !== 'recovery'
                                " />
                        </div>
                    </InputGroup>
                </div>
            </template>

            <template #targetAsset>
                <InputGroup
                    :class="{
                        'p-disabled': activeCalculator !== 'reinvestment',
                    }">
                    <IftaLabel>
                        <InputNumber
                            v-model="targetAsset"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            :disabled="activeCalculator !== 'reinvestment'" />
                        <label>목표 자산</label>
                    </IftaLabel>
                </InputGroup>
            </template>

            <template #annualGrowthRate>
                <InputGroup
                    :class="{
                        'p-disabled': activeCalculator !== 'reinvestment',
                    }">
                    <InputGroupAddon><span>주가 성장률</span></InputGroupAddon>
                    <InputGroupAddon class="text-xs"
                        ><span>{{ annualGrowthRate }} %</span></InputGroupAddon
                    >
                    <div class="p-inputtext toto-range w-full">
                        <Slider
                            v-model="annualGrowthRate"
                            :min="-15"
                            :max="15"
                            :step="1"
                            class="w-full"
                            :disabled="activeCalculator !== 'reinvestment'" />
                    </div>
                </InputGroup>
            </template>

            <!-- <template #investmentAmount>
                <div
                    class="flex flex-column gap-3"
                    :class="{ 'p-disabled': activeCalculator !== 'yield' }">
                    <InputGroup>
                        <InputGroupAddon
                            ><RadioButton
                                v-model="yieldCalcMode"
                                value="amount"
                                :disabled="activeCalculator !== 'yield'"
                        /></InputGroupAddon>
                        <InputGroupAddon
                            ><i
                                :class="
                                    isUSD ? 'pi pi-dollar' : 'pi pi-won-sign'
                                "
                        /></InputGroupAddon>
                        <InputNumber
                            v-model="inputAmount"
                            placeholder="투자 금액"
                            mode="currency"
                            :currency="currency"
                            :locale="currencyLocale"
                            :disabled="
                                yieldCalcMode !== 'amount' ||
                                activeCalculator !== 'yield'
                            " />
                    </InputGroup>
                    <InputGroup>
                        <InputGroupAddon
                            ><RadioButton
                                v-model="yieldCalcMode"
                                value="quantity"
                                :disabled="activeCalculator !== 'yield'"
                        /></InputGroupAddon>
                        <InputGroupAddon
                            ><i class="pi pi-box"
                        /></InputGroupAddon>
                        <InputNumber
                            v-model="quantity"
                            suffix=" 주"
                            class="w-full"
                            :disabled="
                                yieldCalcMode !== 'quantity' ||
                                activeCalculator !== 'yield'
                            " />
                    </InputGroup>
                </div>
            </template> -->
            <template #periodSelect>
                <InputGroup class="toto-reference-period">
                    <IftaLabel>
                        <SelectButton
                            v-model="period"
                            :options="periodOptions"
                            optionLabel="label"
                            optionValue="value" />
                        <label
                            ><span>前 배당금 참고 기간</span
                            ><Tag severity="contrast">{{
                                period === 'ALL' ? '전체' : `최근 ${period}회`
                            }}</Tag></label
                        >
                    </IftaLabel>
                </InputGroup>
            </template>

            <template #taxSelect>
                <InputGroup>
                    <IftaLabel>
                        <SelectButton
                            v-model="applyTax"
                            :options="taxOptions"
                            optionValue="value"
                            dataKey="value">
                            <template #option="slotProps"
                                ><span>{{
                                    slotProps.option.label
                                }}</span></template
                            >
                        </SelectButton>
                        <label
                            ><span>세금 적용</span
                            ><Tag severity="contrast">{{
                                applyTax ? '세후' : '세전'
                            }}</Tag></label
                        >
                    </IftaLabel>
                </InputGroup>
            </template>

            <template #resultsDividend>
                <div class="p-datatable p-component p-datatable-gridlines">
                    <div class="p-datatable-table-container">
                        <table class="p-datatable-table">
                            <thead class="p-datatable-thead">
                                <tr>
                                    <th class="text-center">세금</th>
                                    <th class="text-center">희망</th>
                                    <th class="text-center">평균</th>
                                    <th class="text-center">절망</th>
                                </tr>
                            </thead>
                            <tbody class="p-datatable-tbody">
                                <tr>
                                    <th class="text-center">0 %</th>
                                    <td class="text-center">
                                        <button
                                            class="p-button p-component p-button-sm p-button-success p-button-text"
                                            disabled>
                                            <span class="p-button-label">{{
                                                (
                                                    dividendStats.max || 0
                                                ).toLocaleString(
                                                    currencyLocale,
                                                    {
                                                        style: 'currency',
                                                        currency: currency,
                                                        maximumFractionDigits: 4,
                                                    }
                                                )
                                            }}</span>
                                        </button>
                                    </td>
                                    <td class="text-center">
                                        <button
                                            class="p-button p-component p-button-sm p-button-warn p-button-text"
                                            disabled>
                                            <span class="p-button-label">{{
                                                (
                                                    dividendStats.avg || 0
                                                ).toLocaleString(
                                                    currencyLocale,
                                                    {
                                                        style: 'currency',
                                                        currency: currency,
                                                        maximumFractionDigits: 4,
                                                    }
                                                )
                                            }}</span>
                                        </button>
                                    </td>
                                    <td class="text-center">
                                        <button
                                            class="p-button p-component p-button-sm p-button-danger p-button-text"
                                            disabled>
                                            <span class="p-button-label">{{
                                                (
                                                    dividendStats.min || 0
                                                ).toLocaleString(
                                                    currencyLocale,
                                                    {
                                                        style: 'currency',
                                                        currency: currency,
                                                        maximumFractionDigits: 4,
                                                    }
                                                )
                                            }}</span>
                                        </button>
                                    </td>
                                </tr>
                                <tr>
                                    <th class="text-center">15 %</th>
                                    <td class="text-center">
                                        <button
                                            class="p-button p-component p-button-sm p-button-success p-button-text"
                                            disabled>
                                            <span class="p-button-label">{{
                                                (
                                                    (dividendStats.max || 0) *
                                                    0.85
                                                ).toLocaleString(
                                                    currencyLocale,
                                                    {
                                                        style: 'currency',
                                                        currency: currency,
                                                        maximumFractionDigits: 4,
                                                    }
                                                )
                                            }}</span>
                                        </button>
                                    </td>
                                    <td class="text-center">
                                        <button
                                            class="p-button p-component p-button-sm p-button-warn p-button-text"
                                            disabled>
                                            <span class="p-button-label">{{
                                                (
                                                    (dividendStats.avg || 0) *
                                                    0.85
                                                ).toLocaleString(
                                                    currencyLocale,
                                                    {
                                                        style: 'currency',
                                                        currency: currency,
                                                        maximumFractionDigits: 4,
                                                    }
                                                )
                                            }}</span>
                                        </button>
                                    </td>
                                    <td class="text-center">
                                        <button
                                            class="p-button p-component p-button-sm p-button-danger p-button-text"
                                            disabled>
                                            <span class="p-button-label">{{
                                                (
                                                    (dividendStats.min || 0) *
                                                    0.85
                                                ).toLocaleString(
                                                    currencyLocale,
                                                    {
                                                        style: 'currency',
                                                        currency: currency,
                                                        maximumFractionDigits: 4,
                                                    }
                                                )
                                            }}</span>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>
            <template #resultsRecovery>
                <div
                    class="p-datatable p-component p-datatable-gridlines"
                    v-if="activeCalculator === 'recovery'">
                    <div class="p-datatable-table-container">
                        <table class="p-datatable-table">
                            <tbody class="p-datatable-tbody">
                                <tr>
                                    <th
                                        rowspan="2"
                                        class="text-center"
                                        style="width: 25%">
                                        재투자
                                    </th>
                                    <th class="text-center" style="width: 25%">
                                        <i class="pi pi-circle"></i>
                                    </th>
                                    <td class="text-center">
                                        <div
                                            class="flex flex-column align-items-center">
                                            <span
                                                class="text-green-500 font-bold"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.hope_reinvest,
                                                        true
                                                    ).duration
                                                }}</span
                                            >
                                            <span
                                                v-if="
                                                    formatMonthsToYears(
                                                        recoveryTimes?.hope_reinvest,
                                                        true
                                                    ).date
                                                "
                                                class="text-sm text-surface-500 dark:text-surface-400"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.hope_reinvest,
                                                        true
                                                    ).date
                                                }}</span
                                            >
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <div
                                            class="flex flex-column align-items-center">
                                            <span
                                                class="text-yellow-500 font-bold"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.avg_reinvest,
                                                        true
                                                    ).duration
                                                }}</span
                                            >
                                            <span
                                                v-if="
                                                    formatMonthsToYears(
                                                        recoveryTimes?.avg_reinvest,
                                                        true
                                                    ).date
                                                "
                                                class="text-sm text-surface-500 dark:text-surface-400"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.avg_reinvest,
                                                        true
                                                    ).date
                                                }}</span
                                            >
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <div
                                            class="flex flex-column align-items-center">
                                            <span
                                                class="text-red-500 font-bold"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.despair_reinvest,
                                                        true
                                                    ).duration
                                                }}</span
                                            >
                                            <span
                                                v-if="
                                                    formatMonthsToYears(
                                                        recoveryTimes?.despair_reinvest,
                                                        true
                                                    ).date
                                                "
                                                class="text-sm text-surface-500 dark:text-surface-400"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.despair_reinvest,
                                                        true
                                                    ).date
                                                }}</span
                                            >
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <th class="text-center">
                                        <i class="pi pi-times"></i>
                                    </th>
                                    <td class="text-center">
                                        <div
                                            class="flex flex-column align-items-center">
                                            <span class="font-bold">{{
                                                formatMonthsToYears(
                                                    recoveryTimes?.hope_no_reinvest,
                                                    true
                                                ).duration
                                            }}</span>
                                            <span
                                                v-if="
                                                    formatMonthsToYears(
                                                        recoveryTimes?.hope_no_reinvest,
                                                        true
                                                    ).date
                                                "
                                                class="text-sm text-surface-500 dark:text-surface-400"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.hope_no_reinvest,
                                                        true
                                                    ).date
                                                }}</span
                                            >
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <div
                                            class="flex flex-column align-items-center">
                                            <span class="font-bold">{{
                                                formatMonthsToYears(
                                                    recoveryTimes?.avg_no_reinvest,
                                                    true
                                                ).duration
                                            }}</span>
                                            <span
                                                v-if="
                                                    formatMonthsToYears(
                                                        recoveryTimes?.avg_no_reinvest,
                                                        true
                                                    ).date
                                                "
                                                class="text-sm text-surface-500 dark:text-surface-400"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.avg_no_reinvest,
                                                        true
                                                    ).date
                                                }}</span
                                            >
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <div
                                            class="flex flex-column align-items-center">
                                            <span class="font-bold">{{
                                                formatMonthsToYears(
                                                    recoveryTimes?.despair_no_reinvest,
                                                    true
                                                ).duration
                                            }}</span>
                                            <span
                                                v-if="
                                                    formatMonthsToYears(
                                                        recoveryTimes?.despair_no_reinvest,
                                                        true
                                                    ).date
                                                "
                                                class="text-sm text-surface-500 dark:text-surface-400"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes?.despair_no_reinvest,
                                                        true
                                                    ).date
                                                }}</span
                                            >
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>

            <template #resultsReinvestment>
                <div
                    class="p-datatable p-component p-datatable-gridlines"
                    v-if="activeCalculator === 'reinvestment'">
                    <div class="p-datatable-table-container">
                        <table class="p-datatable-table">
                            <tbody class="p-datatable-tbody">
                                <tr>
                                    <th class="text-center">기간</th>
                                    <td class="text-center">
                                        <Tag severity="success">{{
                                            formatMonthsToYears(
                                                goalAchievementTimes?.hope
                                            )?.duration
                                        }}</Tag>
                                    </td>
                                    <td class="text-center">
                                        <Tag severity="warning">{{
                                            formatMonthsToYears(
                                                goalAchievementTimes?.avg
                                            )?.duration
                                        }}</Tag>
                                    </td>
                                    <td class="text-center">
                                        <Tag severity="danger">{{
                                            formatMonthsToYears(
                                                goalAchievementTimes?.despair
                                            )?.duration
                                        }}</Tag>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>

            <template #resultsYield>
                <div
                    class="p-datatable p-component p-datatable-gridlines"
                    v-if="activeCalculator === 'yield'">
                    <div class="p-datatable-table-container">
                        <table class="p-datatable-table">
                            <tbody class="p-datatable-tbody">
                                <tr>
                                    <td rowspan="2" class="text-center">
                                        1회당
                                    </td>
                                    <th class="text-center">
                                        <i class="pi pi-lock-open" /> 세전
                                    </th>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.hope.perPayout.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax
                                                        .hope.perPayout
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.avg.perPayout.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax.avg
                                                        .perPayout
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.despair.perPayout.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax
                                                        .despair.perPayout
                                                )
                                            }}</small
                                        >
                                    </td>
                                </tr>
                                <tr
                                    class="border-b border-surface-300 dark:border-surface-600">
                                    <th class="text-center">
                                        <i class="pi pi-lock" /> 세후
                                    </th>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.hope.perPayout.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .hope.perPayout
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.avg.perPayout.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .avg.perPayout
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.despair.perPayout.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .despair.perPayout
                                                )
                                            }}</small
                                        >
                                    </td>
                                </tr>
                                <tr>
                                    <td rowspan="2" class="text-center">
                                        월간
                                    </td>
                                    <th class="text-center">
                                        <i class="pi pi-lock-open" /> 세전
                                    </th>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.hope.monthly.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax
                                                        .hope.monthly
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.avg.monthly.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax.avg
                                                        .monthly
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.despair.monthly.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax
                                                        .despair.monthly
                                                )
                                            }}</small
                                        >
                                    </td>
                                </tr>
                                <tr
                                    class="border-b border-surface-300 dark:border-surface-600">
                                    <th class="text-center">
                                        <i class="pi pi-lock" /> 세후
                                    </th>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.hope.monthly.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .hope.monthly
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.avg.monthly.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .avg.monthly
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.despair.monthly.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .despair.monthly
                                                )
                                            }}</small
                                        >
                                    </td>
                                </tr>
                                <tr>
                                    <td rowspan="2" class="text-center">
                                        연간
                                    </td>
                                    <th class="text-center">
                                        <i class="pi pi-lock-open" /> 세전
                                    </th>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.hope.annual.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax
                                                        .hope.annual
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.avg.annual.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax.avg
                                                        .annual
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.preTax.despair.annual.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.preTax
                                                        .despair.annual
                                                )
                                            }}</small
                                        >
                                    </td>
                                </tr>
                                <tr>
                                    <th class="text-center">
                                        <i class="pi pi-lock" /> 세후
                                    </th>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.hope.annual.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .hope.annual
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.avg.annual.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .avg.annual
                                                )
                                            }}</small
                                        >
                                    </td>
                                    <td class="text-center">
                                        {{
                                            expectedDividends.postTax.despair.annual.toLocaleString(
                                                currencyLocale,
                                                {
                                                    style: 'currency',
                                                    currency: currency,
                                                    maximumFractionDigits: 2,
                                                }
                                            )
                                        }}<br v-if="isUSD" /><small
                                            v-if="isUSD"
                                            >{{
                                                formatKRW(
                                                    expectedDividends.postTax
                                                        .despair.annual
                                                )
                                            }}</small
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>

            <template #resultsChart>
                <Card v-if="activeCalculator === 'recovery'">
                    <template #content
                        ><v-chart
                            :option="recoveryChartOptions"
                            autoresize
                            style="height: 300px"
                    /></template>
                </Card>
                <Card v-if="activeCalculator === 'reinvestment'">
                    <template #content
                        ><v-chart
                            :option="reinvestmentChartOptions"
                            autoresize
                            style="height: 300px"
                    /></template>
                </Card>
            </template>
           
        </CalculatorLayout>
    </div>
    <div
        v-else
        class="flex justify-content-center align-items-center"
        style="min-height: 400px">
        <ProgressSpinner />
    </div>
</template>
