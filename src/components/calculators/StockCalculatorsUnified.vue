<!-- src\components\calculators\StockCalculatorsUnified.vue -->
<script setup>
    import { ref, computed, watch, onMounted, reactive } from 'vue';
    import { useSharedCalculatorState } from '@/composables/calculators/useSharedCalculatorState.js';
    import { useRecoveryCalc } from '@/composables/calculators/useRecoveryCalc.js';
    import { useReinvestmentCalc } from '@/composables/calculators/useReinvestmentCalc.js';
    import { useYieldCalc } from '@/composables/calculators/useYieldCalc.js';
    import { formatMonthsToYears } from '@/utils/date.js';
    import VChart from 'vue-echarts';

    // PrimeVue 컴포넌트 임포트
    import CalculatorLayout from './CalculatorLayout.vue';
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

    const props = defineProps({
        activeCalculator: String,
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const emit = defineEmits(['update-header-info']);

    const shared = useSharedCalculatorState(props);

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

// [수정] userBookmark를 computed로 감싸지 않고 shared에서 직접 사용
const recovery = useRecoveryCalc({ ...shared, chartTheme });
const reinvestment = useReinvestmentCalc({ ...shared, chartTheme });
const yieldCalc = useYieldCalc(shared);

    const setInputValues = (source = {}) => {
        shared.avgPrice.value =
            source.avgPrice || shared.currentPrice.value || 0;
        shared.quantity.value = source.quantity || shared.getDefaultQuantity();
        recovery.accumulatedDividend.value = source.accumulatedDividend || 0;
        reinvestment.targetAsset.value =
            source.targetAsset || (shared.isUSD.value ? 100000 : 100000000);
    };

    const saveToBookmark = () => {
        if (shared.user.value && props.tickerInfo?.symbol) {
            shared.updateBookmarkDetails(props.tickerInfo.symbol, {
                avgPrice: shared.avgPrice.value,
                quantity: shared.quantity.value,
                accumulatedDividend: recovery.accumulatedDividend.value,
                targetAsset: reinvestment.targetAsset.value,
            });
        }
    };
    const loadFromBookmark = () =>
        props.userBookmark && setInputValues(props.userBookmark);
    const resetToCurrentPrice = () => setInputValues();


// --- [핵심 수정] watch를 게터 함수 형태로 변경 ---
watch(
    () => shared.currentPrice.value, // .value에 접근하는 것을 함수로 감쌈
    (newPrice) => {
        if (newPrice > 0) setInputValues(props.userBookmark || {});
    },
    { immediate: true }
);
    const exchangeRate = ref(1380);
    const formatKRW = (amount) =>
        (amount * exchangeRate.value).toLocaleString('ko-KR', {
            maximumFractionDigits: 0,
        }) + '원';

    watch(
        [
            () => shared.currentPrice.value,
            exchangeRate,
            () => shared.isUSD.value,
        ],
        () => {
            emit('update-header-info', {
                currentPrice: shared.currentPrice.value,
                exchangeRate: exchangeRate.value,
                isUSD: shared.isUSD.value,
                currency: shared.currency.value,
                currencyLocale: shared.currencyLocale.value,
            });
        },
        { immediate: true, deep: true }
    );

    onMounted(async () => {
        if (shared.isUSD.value) {
            try {
                const res = await fetch('/api/getExchangeRate');
                if (res.ok) exchangeRate.value = (await res.json()).price;
            } catch (e) {
                console.error(e);
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
                            v-model="shared.avgPrice.value"
                            :mode="shared.isUSD.value ? 'currency' : 'decimal'"
                            :currency="shared.currency.value"
                            :locale="shared.currencyLocale.value"
                            inputId="avgPrice"
                            :disabled="activeCalculator === 'yield'" />
                        <label for="avgPrice">평단</label>
                    </IftaLabel>
                    <IftaLabel>
                        <InputNumber
                            v-model="shared.quantity.value"
                            suffix=" 주"
                            min="1"
                            inputId="quantity"
                            :disabled="
                                activeCalculator === 'yield' &&
                                yieldCalc.yieldCalcMode.value !== 'quantity'
                            " />
                        <label for="quantity">수량</label>
                    </IftaLabel>
                </InputGroup>
                <div
                    v-if="shared.user.value && activeCalculator !== 'yield'"
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
                        icon="pi pi-folder-open"
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
                <FloatLabel variant="on"
                    ><InputNumber
                        :modelValue="shared.investmentPrincipal.value"
                        :mode="shared.isUSD.value ? 'currency' : 'decimal'"
                        :currency="shared.currency.value"
                        :locale="shared.currencyLocale.value"
                        disabled /><label>투자원금</label></FloatLabel
                >
                <FloatLabel variant="on"
                    ><InputNumber
                        :modelValue="shared.currentValue.value"
                        :mode="shared.isUSD.value ? 'currency' : 'decimal'"
                        :currency="shared.currency.value"
                        :locale="shared.currencyLocale.value"
                        disabled /><label>현재가치</label></FloatLabel
                >
                <Tag
                    :severity="
                        shared.profitLossRate.value >= 0 ? 'success' : 'danger'
                    "
                    :value="`${shared.profitLossRate.value.toFixed(2)}%`" />
            </InputGroup>
        </template>
        <template #accumulatedDividend>
            <div
                class="flex flex-column gap-3"
                :class="{ 'p-disabled': activeCalculator !== 'recovery' }">
                <InputGroup>
                    <InputGroupAddon
                        ><RadioButton
                            v-model="recovery.recoveryCalcMode.value"
                            value="amount"
                            :disabled="activeCalculator !== 'recovery'"
                    /></InputGroupAddon>
                    <InputGroupAddon
                        ><i
                            :class="
                                shared.isUSD.value
                                    ? 'pi pi-dollar'
                                    : 'pi pi-won-sign'
                            "
                    /></InputGroupAddon>
                    <FloatLabel variant="on">
                        <InputNumber
                            v-model="recovery.accumulatedDividend.value"
                            :mode="shared.isUSD.value ? 'currency' : 'decimal'"
                            :currency="shared.currency.value"
                            :locale="shared.currencyLocale.value"
                            :disabled="
                                recovery.recoveryCalcMode.value !== 'amount' ||
                                activeCalculator !== 'recovery'
                            " />
                        <label>누적 배당금</label>
                    </FloatLabel>
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon
                        ><RadioButton
                            v-model="recovery.recoveryCalcMode.value"
                            value="rate"
                            :disabled="activeCalculator !== 'recovery'"
                    /></InputGroupAddon>
                    <InputGroupAddon
                        ><i class="pi pi-percentage"
                    /></InputGroupAddon>
                    <InputGroupAddon class="text-xs"
                        ><span
                            >{{
                                recovery.recoveryRate.value.toFixed(2)
                            }}
                            %</span
                        ></InputGroupAddon
                    >
                    <div
                        class="toto-range w-full p-inputtext"
                        :disabled="
                            recovery.recoveryCalcMode.value !== 'rate' ||
                            activeCalculator !== 'recovery'
                        ">
                        <Slider
                            v-model="recovery.recoveryRate.value"
                            :min="0"
                            :max="99.99"
                            :step="0.01"
                            class="w-full"
                            :disabled="
                                recovery.recoveryCalcMode.value !== 'rate' ||
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
                        v-model="reinvestment.targetAsset.value"
                        :mode="shared.isUSD.value ? 'currency' : 'decimal'"
                        :currency="shared.currency.value"
                        :locale="shared.currencyLocale.value"
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
                        >{{ reinvestment.annualGrowthRate.value }} %</span
                    ></InputGroupAddon
                >
                <div class="p-inputtext toto-range w-full">
                    <Slider
                        v-model="reinvestment.annualGrowthRate.value"
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
                            v-model="yieldCalc.yieldCalcMode.value"
                            value="amount"
                            :disabled="activeCalculator !== 'yield'"
                    /></InputGroupAddon>
                    <InputGroupAddon
                        ><i
                            :class="
                                shared.isUSD.value
                                    ? 'pi pi-dollar'
                                    : 'pi pi-won-sign'
                            "
                    /></InputGroupAddon>
                    <InputNumber
                        v-model="yieldCalc.inputAmount.value"
                        placeholder="투자 금액"
                        mode="currency"
                        :currency="shared.currency.value"
                        :locale="shared.currencyLocale.value"
                        :disabled="
                            yieldCalc.yieldCalcMode.value !== 'amount' ||
                            activeCalculator !== 'yield'
                        " />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon
                        ><RadioButton
                            v-model="yieldCalc.yieldCalcMode.value"
                            value="quantity"
                            :disabled="activeCalculator !== 'yield'"
                    /></InputGroupAddon>
                    <InputGroupAddon><i class="pi pi-box" /></InputGroupAddon>
                    <InputNumber
                        v-model="shared.quantity.value"
                        suffix=" 주"
                        class="w-full"
                        :disabled="
                            yieldCalc.yieldCalcMode.value !== 'quantity' ||
                            activeCalculator !== 'yield'
                        " />
                </InputGroup>
            </div>
        </template>
        <template #periodSelect>
            <InputGroup class="toto-reference-period">
                <IftaLabel>
                    <SelectButton
                        v-model="shared.period.value"
                        :options="shared.periodOptions.value"
                        optionLabel="label"
                        optionValue="value" />
                    <label
                        ><span>前 배당금 참고 기간</span
                        ><Tag severity="contrast">{{
                            shared.period.value === 'ALL'
                                ? '전체'
                                : `최근 ${shared.period.value}회`
                        }}</Tag></label
                    >
                </IftaLabel>
            </InputGroup>
        </template>
        <template #taxSelect>
            <InputGroup
                class="toto-tax-apply"
                :class="{ 'p-disabled': activeCalculator === 'yield' }">
                <IftaLabel>
                    <SelectButton
                        v-model="shared.applyTax.value"
                        :options="shared.taxOptions.value"
                        optionValue="value"
                        dataKey="value"
                        :disabled="activeCalculator === 'yield'"
                        ><template #option="slotProps"
                            ><span>{{ slotProps.option.label }}</span></template
                        ></SelectButton
                    >
                    <label
                        ><span>세금 적용</span
                        ><Tag severity="contrast">{{
                            shared.applyTax.value ? '세후' : '세전'
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
                                        ><span
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
                                        ><span
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
                                        <span class="text-red-500 font-bold">{{
                                            formatMonthsToYears(
                                                recoveryTimes?.despair_reinvest,
                                                true
                                            ).duration
                                        }}</span
                                        ><span
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
                                        }}</span
                                        ><span
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
                                        }}</span
                                        ><span
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
                                        }}</span
                                        ><span
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
                                <th class="text-center" style="width: 25%">
                                    기간
                                </th>
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
                                <td
                                    rowspan="2"
                                    class="text-center"
                                    style="width: 25%">
                                    1회당
                                </td>
                                <th class="text-center" style="width: 25%">
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.hope
                                                .perPayout
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.avg
                                                .perPayout
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.despair
                                                .perPayout
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.hope
                                                .perPayout
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.avg
                                                .perPayout
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.despair
                                                .perPayout
                                        )
                                    }}</small>
                                </td>
                            </tr>
                            <tr>
                                <td rowspan="2" class="text-center">월간</td>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.hope
                                                .monthly
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.avg.monthly
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.despair
                                                .monthly
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.hope
                                                .monthly
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.avg
                                                .monthly
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.despair
                                                .monthly
                                        )
                                    }}</small>
                                </td>
                            </tr>
                            <tr>
                                <td rowspan="2" class="text-center">연간</td>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.hope.annual
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.avg.annual
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.preTax.despair
                                                .annual
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.hope
                                                .annual
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.avg.annual
                                        )
                                    }}</small>
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
                                    }}<br v-if="isUSD" /><small v-if="isUSD">{{
                                        formatKRW(
                                            expectedDividends.postTax.despair
                                                .annual
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
