<!-- src\components\calculators\StockCalculatorsUnified.vue -->
<script setup>
    import { ref, computed, watch, onMounted, reactive } from 'vue';
    import { user } from '@/store/auth';
    import { useFilterState } from '@/composables/useFilterState';
    import { useDividendStats } from '@/composables/useDividendStats';
    import { formatMonthsToYears } from '@/utils/date.js';
    import { useRecoveryCalc } from '@/composables/calculators/useRecoveryCalc.js';
    import { useReinvestmentCalc } from '@/composables/calculators/useReinvestmentCalc.js';
    import { useYieldCalc } from '@/composables/calculators/useYieldCalc.js';
    import VChart from 'vue-echarts';

    import CalculatorLayout from './CalculatorLayout.vue';
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

    const props = defineProps({
        activeCalculator: String,
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });
    const emit = defineEmits(['update-header-info']);

    const currency = computed(() => props.tickerInfo?.currency || 'USD');
    const isUSD = computed(() => currency.value === 'USD');
    const currencyLocale = computed(() => (isUSD.value ? 'en-US' : 'ko-KR'));
    const currentPrice = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );
    const exchangeRate = ref(1380);

    const avgPrice = ref(0);
    const quantity = ref(100);
    const period = ref('1Y');
    const periodOptions = ref([
        { label: '前 3M', value: '3M' },
        { label: '前 6M', value: '6M' },
        { label: '前 1Y', value: '1Y' },
    ]);
    const applyTax = ref(true);
    const taxOptions = ref([
        { label: '세전', value: false },
        { label: '세후 (15%)', value: true },
    ]);

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
        computed(() => props.dividendHistory),
        computed(() => props.tickerInfo),
        period
    );

    const documentStyle = getComputedStyle(document.documentElement);
    const chartTheme = reactive({
        textColor: documentStyle.getPropertyValue('--p-text-color'),
        textColorSecondary: documentStyle.getPropertyValue(
            '--p-text-muted-color'
        ),
        surfaceBorder: documentStyle.getPropertyValue(
            '--p-content-border-color'
        ),
    });

    const commonState = {
        avgPrice,
        quantity,
        currentPrice,
        isUSD,
        currency,
        currencyLocale,
        userBookmark: computed(() => props.userBookmark),
        currentAssets,
        dividendStats,
        payoutsPerYear,
        applyTax,
        chartTheme,
        exchangeRate,
    };

    const recovery = useRecoveryCalc(commonState);
    const reinvestment = useReinvestmentCalc(commonState);
    const yieldCalc = useYieldCalc(commonState);

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
        recovery.accumulatedDividend.value = source.accumulatedDividend || 0;
        reinvestment.targetAsset.value =
            source.targetAsset || (isUSD.value ? 100000 : 100000000);
    };

    const saveToBookmark = () => {
        if (user.value && props.tickerInfo?.symbol) {
            updateBookmarkDetails(props.tickerInfo.symbol, {
                avgPrice: avgPrice.value,
                quantity: quantity.value,
                accumulatedDividend: recovery.accumulatedDividend.value,
                targetAsset: reinvestment.targetAsset.value,
            });
        }
    };
    const loadFromBookmark = () =>
        props.userBookmark && setInputValues(props.userBookmark);
    const resetToCurrentPrice = () => setInputValues();

    watch(
        currentPrice,
        (newPrice) => {
            if (newPrice > 0) {
                setInputValues(props.userBookmark);
            }
        },
        { immediate: true }
    );

    const formatKRW = (amount) =>
        (amount * exchangeRate.value).toLocaleString('ko-KR', {
            maximumFractionDigits: 0,
        }) + '원';

    watch(
        [currentPrice, exchangeRate, isUSD],
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
        if (isUSD.value) {
            try {
                const res = await fetch('/api/getExchangeRate');
                if (res.ok) exchangeRate.value = (await res.json()).price;
            } catch (e) {
                console.error('Failed to fetch exchange rate:', e);
            }
        }
    });
</script>

<template>
    <CalculatorLayout>
        <template #avgPriceAndQuantity>
            <div class="flex flex-column gap-3">
                <InputGroup
                    :class="{ 'p-disabled': activeCalculator === 'yield' }">
                    <IftaLabel>
                        <InputNumber
                            v-model="avgPrice"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            inputId="avgPrice"
                            :disabled="activeCalculator === 'yield'" />
                        <label for="avgPrice">평단</label>
                    </IftaLabel>
                    <IftaLabel>
                        <InputNumber
                            v-model="quantity"
                            suffix=" 주"
                            min="1"
                            inputId="quantity"
                            :disabled="
                                activeCalculator === 'yield' &&
                                yieldCalc.yieldCalcMode !== 'quantity'
                            " />
                        <label for="quantity">수량</label>
                    </IftaLabel>
                </InputGroup>
                <div
                    v-if="user && activeCalculator !== 'yield'"
                    class="flex justify-content-end gap-2">
                    <Button
                        label="저장"
                        icon="pi pi-save"
                        @click="saveToBookmark"
                        severity="success"
                        size="small"
                        text />
                    <Button
                        label="불러오기"
                        icon="pi pi-bookmark"
                        @click="loadFromBookmark"
                        severity="info"
                        size="small"
                        text />
                    <Button
                        label="초기화"
                        icon="pi pi-refresh"
                        @click="resetToCurrentPrice"
                        severity="secondary"
                        size="small"
                        text />
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
                            v-model="recovery.recoveryCalcMode"
                            value="amount"
                            :disabled="activeCalculator !== 'recovery'"
                    /></InputGroupAddon>
                    <InputGroupAddon
                        ><i :class="isUSD ? 'pi pi-dollar' : 'pi pi-won-sign'"
                    /></InputGroupAddon>
                    <FloatLabel variant="on">
                        <InputNumber
                            v-model="recovery.accumulatedDividend"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            :disabled="
                                recovery.recoveryCalcMode !== 'amount' ||
                                activeCalculator !== 'recovery'
                            " />
                        <label>누적 배당금</label>
                    </FloatLabel>
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon
                        ><RadioButton
                            v-model="recovery.recoveryCalcMode"
                            value="rate"
                            :disabled="activeCalculator !== 'recovery'"
                    /></InputGroupAddon>
                    <InputGroupAddon
                        ><i class="pi pi-percentage"
                    /></InputGroupAddon>
                    <InputGroupAddon class="text-xs"
                        ><span
                            >{{ recovery.recoveryRate.toFixed(2) }} %</span
                        ></InputGroupAddon
                    >
                    <div
                        class="toto-range w-full p-inputtext"
                        :disabled="
                            recovery.recoveryCalcMode !== 'rate' ||
                            activeCalculator !== 'recovery'
                        ">
                        <Slider
                            v-model="recovery.recoveryRate"
                            :min="0"
                            :max="99.99"
                            :step="0.01"
                            class="w-full"
                            :disabled="
                                recovery.recoveryCalcMode !== 'rate' ||
                                activeCalculator !== 'recovery'
                            " />
                    </div>
                </InputGroup>
            </div>
        </template>

        <template #targetAsset>
            <InputGroup
                :class="{ 'p-disabled': activeCalculator !== 'reinvestment' }">
                <IftaLabel>
                    <InputNumber
                        v-model="reinvestment.targetAsset"
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
                :class="{ 'p-disabled': activeCalculator !== 'reinvestment' }">
                <InputGroupAddon><span>주가 성장률</span></InputGroupAddon>
                <InputGroupAddon class="text-xs"
                    ><span
                        >{{ reinvestment.annualGrowthRate }} %</span
                    ></InputGroupAddon
                >
                <div class="p-inputtext toto-range w-full">
                    <Slider
                        v-model="reinvestment.annualGrowthRate"
                        :min="-15"
                        :max="15"
                        :step="1"
                        class="w-full"
                        :disabled="activeCalculator !== 'reinvestment'" />
                </div>
            </InputGroup>
        </template>

        <template #investmentAmount>
            <div
                class="flex flex-column gap-3"
                :class="{ 'p-disabled': activeCalculator !== 'yield' }">
                <InputGroup>
                    <InputGroupAddon
                        ><RadioButton
                            v-model="yieldCalc.yieldCalcMode"
                            value="amount"
                            :disabled="activeCalculator !== 'yield'"
                    /></InputGroupAddon>
                    <InputGroupAddon
                        ><i :class="isUSD ? 'pi pi-dollar' : 'pi pi-won-sign'"
                    /></InputGroupAddon>
                    <InputNumber
                        v-model="yieldCalc.inputAmount"
                        placeholder="투자 금액"
                        mode="currency"
                        :currency="currency"
                        :locale="currencyLocale"
                        :disabled="
                            yieldCalc.yieldCalcMode !== 'amount' ||
                            activeCalculator !== 'yield'
                        " />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon
                        ><RadioButton
                            v-model="yieldCalc.yieldCalcMode"
                            value="quantity"
                            :disabled="activeCalculator !== 'yield'"
                    /></InputGroupAddon>
                    <InputGroupAddon><i class="pi pi-box" /></InputGroupAddon>
                    <InputNumber
                        v-model="quantity"
                        suffix=" 주"
                        class="w-full"
                        :disabled="
                            yieldCalc.yieldCalcMode !== 'quantity' ||
                            activeCalculator !== 'yield'
                        " />
                </InputGroup>
            </div>
        </template>

        <template #periodSelect>
            <InputGroup class="toto-reference-period">
                <IftaLabel>
                    <SelectButton
                        v-model="period"
                        :options="periodOptions"
                        optionLabel="label"
                        optionValue="value" />
                    <label>
                        <span>前 배당금 참고 기간</span>
                        <Tag severity="contrast">{{ period }}</Tag>
                    </label>
                </IftaLabel>
            </InputGroup>
        </template>

        <template #taxSelect>
            <InputGroup
                class="toto-tax-apply"
                :class="{ 'p-disabled': activeCalculator === 'yield' }">
                <IftaLabel>
                    <SelectButton
                        v-model="applyTax"
                        :options="taxOptions"
                        optionValue="value"
                        dataKey="value"
                        :disabled="activeCalculator === 'yield'">
                        <template #option="slotProps"
                            ><span>{{ slotProps.option.label }}</span></template
                        >
                    </SelectButton>
                    <label>
                        <span>세금 적용</span>
                        <Tag severity="contrast">{{
                            applyTax ? '세후' : '세전'
                        }}</Tag>
                    </label>
                </IftaLabel>
            </InputGroup>
        </template>

        <template #resultsDividend>
            <div class="p-datatable p-component p-datatable-gridlines">
                <div class="p-datatable-table-container">
                    <table class="p-datatable-table">
                        <colgroup>
                            <col />
                            <col style="width: 25%" />
                            <col style="width: 25%" />
                            <col style="width: 25%" />
                        </colgroup>
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
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
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
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
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
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
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
                                                (dividendStats.max || 0) * 0.85
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}</span>
                                    </button>
                                </td>
                                <td class="text-center">
                                    <button
                                        class="p-button p-component p-button-sm p-button-warn p-button-text"
                                        disabled>
                                        <span class="p-button-label">{{
                                            (
                                                (dividendStats.avg || 0) * 0.85
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}</span>
                                    </button>
                                </td>
                                <td class="text-center">
                                    <button
                                        class="p-button p-component p-button-sm p-button-danger p-button-text"
                                        disabled>
                                        <span class="p-button-label">{{
                                            (
                                                (dividendStats.min || 0) * 0.85
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
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
                                <td>
                                    <div
                                        class="flex flex-column align-items-center">
                                        <span
                                            class="text-green-500 font-bold"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .hope_reinvest,
                                                    true
                                                ).duration
                                            }}</span
                                        >
                                        <span
                                            v-if="
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .hope_reinvest,
                                                    true
                                                ).date
                                            "
                                            class="text-sm text-surface-500 dark:text-surface-400"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .hope_reinvest,
                                                    true
                                                ).date
                                            }}</span
                                        >
                                    </div>
                                </td>
                                <td>
                                    <div
                                        class="flex flex-column align-items-center">
                                        <span
                                            class="text-yellow-500 font-bold"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .avg_reinvest,
                                                    true
                                                ).duration
                                            }}</span
                                        >
                                        <span
                                            v-if="
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .avg_reinvest,
                                                    true
                                                ).date
                                            "
                                            class="text-sm text-surface-500 dark:text-surface-400"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .avg_reinvest,
                                                    true
                                                ).date
                                            }}</span
                                        >
                                    </div>
                                </td>
                                <td>
                                    <div
                                        class="flex flex-column align-items-center">
                                        <span class="text-red-500 font-bold">{{
                                            formatMonthsToYears(
                                                recovery.recoveryTimes
                                                    .despair_reinvest,
                                                true
                                            ).duration
                                        }}</span>
                                        <span
                                            v-if="
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .despair_reinvest,
                                                    true
                                                ).date
                                            "
                                            class="text-sm text-surface-500 dark:text-surface-400"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .despair_reinvest,
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
                                <td>
                                    <div
                                        class="flex flex-column align-items-center">
                                        <span class="font-bold">{{
                                            formatMonthsToYears(
                                                recovery.recoveryTimes
                                                    .hope_no_reinvest,
                                                true
                                            ).duration
                                        }}</span>
                                        <span
                                            v-if="
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .hope_no_reinvest,
                                                    true
                                                ).date
                                            "
                                            class="text-sm text-surface-500 dark:text-surface-400"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .hope_no_reinvest,
                                                    true
                                                ).date
                                            }}</span
                                        >
                                    </div>
                                </td>
                                <td>
                                    <div
                                        class="flex flex-column align-items-center">
                                        <span class="font-bold">{{
                                            formatMonthsToYears(
                                                recovery.recoveryTimes
                                                    .avg_no_reinvest,
                                                true
                                            ).duration
                                        }}</span>
                                        <span
                                            v-if="
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .avg_no_reinvest,
                                                    true
                                                ).date
                                            "
                                            class="text-sm text-surface-500 dark:text-surface-400"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .avg_no_reinvest,
                                                    true
                                                ).date
                                            }}</span
                                        >
                                    </div>
                                </td>
                                <td>
                                    <div
                                        class="flex flex-column align-items-center">
                                        <span class="font-bold">{{
                                            formatMonthsToYears(
                                                recovery.recoveryTimes
                                                    .despair_no_reinvest,
                                                true
                                            ).duration
                                        }}</span>
                                        <span
                                            v-if="
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .despair_no_reinvest,
                                                    true
                                                ).date
                                            "
                                            class="text-sm text-surface-500 dark:text-surface-400"
                                            >{{
                                                formatMonthsToYears(
                                                    recovery.recoveryTimes
                                                        .despair_no_reinvest,
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
                                <th class="text-center" style="width: 25%">
                                    기간
                                </th>
                                <td class="text-center">
                                    <Tag severity="success">{{
                                        formatMonthsToYears(
                                            reinvestment.goalAchievementTimes
                                                ?.hope
                                        )?.duration
                                    }}</Tag>
                                </td>
                                <td class="text-center">
                                    <Tag severity="warning">{{
                                        formatMonthsToYears(
                                            reinvestment.goalAchievementTimes
                                                ?.avg
                                        )?.duration
                                    }}</Tag>
                                </td>
                                <td class="text-center">
                                    <Tag severity="danger">{{
                                        formatMonthsToYears(
                                            reinvestment.goalAchievementTimes
                                                ?.despair
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
                                <td
                                    rowspan="2"
                                    class="text-center"
                                    style="width: 25%">
                                    1회당
                                </td>
                                <th class="text-center" style="width: 25%">
                                    <i class="pi pi-lock-open" /> 세전
                                </th>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.hope.perPayout.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .hope.perPayout
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.avg.perPayout.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .avg.perPayout
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.despair.perPayout.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .despair.perPayout
                                        )
                                    }}</small>
                                </td>
                            </tr>
                            <tr
                                class="border-b border-surface-300 dark:border-surface-600">
                                <th class="text-center">
                                    <i class="pi pi-lock" /> 세후
                                </th>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.hope.perPayout.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .hope.perPayout
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.avg.perPayout.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .avg.perPayout
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.despair.perPayout.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .despair.perPayout
                                        )
                                    }}</small>
                                </td>
                            </tr>
                            <tr>
                                <td rowspan="2" class="text-center">월간</td>
                                <th class="text-center">
                                    <i class="pi pi-lock-open" /> 세전
                                </th>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.hope.monthly.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .hope.monthly
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.avg.monthly.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .avg.monthly
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.despair.monthly.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .despair.monthly
                                        )
                                    }}</small>
                                </td>
                            </tr>
                            <tr
                                class="border-b border-surface-300 dark:border-surface-600">
                                <th class="text-center">
                                    <i class="pi pi-lock" /> 세후
                                </th>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.hope.monthly.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .hope.monthly
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.avg.monthly.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .avg.monthly
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.despair.monthly.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .despair.monthly
                                        )
                                    }}</small>
                                </td>
                            </tr>
                            <tr>
                                <td rowspan="2" class="text-center">연간</td>
                                <th class="text-center">
                                    <i class="pi pi-lock-open" /> 세전
                                </th>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.hope.annual.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .hope.annual
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.avg.annual.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .avg.annual
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.preTax.despair.annual.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.preTax
                                                .despair.annual
                                        )
                                    }}</small>
                                </td>
                            </tr>
                            <tr>
                                <th class="text-center">
                                    <i class="pi pi-lock" /> 세후
                                </th>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.hope.annual.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .hope.annual
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.avg.annual.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .avg.annual
                                        )
                                    }}</small>
                                </td>
                                <td>
                                    {{
                                        yieldCalc.expectedDividends.postTax.despair.annual.toLocaleString(
                                            currencyLocale,
                                            {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 2,
                                            }
                                        )
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            yieldCalc.expectedDividends.postTax
                                                .despair.annual
                                        )
                                    }}</small>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <template #resultsChart>
            <Card v-if="activeCalculator === 'recovery'"
                ><template #content
                    ><v-chart
                        :option="recovery.recoveryChartOptions"
                        autoresize
                        style="height: 300px" /></template
            ></Card>
            <Card v-if="activeCalculator === 'reinvestment'"
                ><template #content
                    ><v-chart
                        :option="reinvestment.reinvestmentChartOptions"
                        autoresize
                        style="height: 300px" /></template
            ></Card>
        </template>
    </CalculatorLayout>
</template>
