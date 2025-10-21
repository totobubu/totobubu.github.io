<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useFilterState } from '@/composables/useFilterState';
    import { useDividendStats } from '@/composables/useDividendStats';
    import {
        useRecoveryChart,
        useReinvestmentChart,
    } from '@/composables/charts';
    import { formatMonthsToYears } from '@/utils/date.js';
    import VChart from 'vue-echarts';

    // Layout & PrimeVue Components
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
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    // --- [핵심 수정 1] 통화 관련 변수 추가 ---
    const currency = computed(() => props.tickerInfo?.currency || 'USD');
    const isUSD = computed(() => currency.value === 'USD');
    const currencyLocale = computed(() => (isUSD.value ? 'en-US' : 'ko-KR'));

    const { updateBookmarkDetails } = useFilterState();

    // --- State ---
    const activeCalculator = ref('recovery');
    const calculatorOptions = ref([
        { label: '원금 회수 기간', value: 'recovery' },
        { label: '목표 달성 기간', value: 'reinvestment' },
        { label: '예상 배당금', value: 'yield' },
    ]);

    // Shared State
    const period = ref('1Y');
    const periodOptions = ref([
        { label: '前 3M', value: '3M' },
        { label: '前 6M', value: '6M' },
        { label: '前 1Y', value: '1Y' },
    ]);
    const applyTax = ref(true);
    const taxOptions = ref([
        { icon: 'pi pi-shield', value: false, tooltip: '세전' },
        { icon: 'pi pi-building-columns', value: true, tooltip: '세후 (15%)' },
    ]);

    // Calculator States
    const avgPrice = ref(props.userBookmark?.avgPrice || 0);
    const quantity = ref(props.userBookmark?.quantity || 100);
    const accumulatedDividend = ref(
        props.userBookmark?.accumulatedDividend || 0
    );
    const recoveryCalcMode = ref('amount');
    const targetAsset = ref(
        props.userBookmark?.targetAsset || (isUSD.value ? 100000 : 100000000)
    );
    const annualGrowthRate = ref(0);
    const yieldCalcMode = ref('quantity');
    const inputAmount = ref(isUSD.value ? 10000 : 10000000); // 통합된 투자금 (USD 또는 KRW)
    const exchangeRate = ref(1380);
    const isYieldInitialized = ref(false);

    // --- Composables ---
    const { dividendStats, payoutsPerYear } = useDividendStats(
        computed(() => props.dividendHistory),
        computed(() => props.tickerInfo),
        period
    );

    // --- Computed Properties ---
    const currentPrice = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );
    const inputAmountUSD = computed(() =>
        isUSD.value
            ? inputAmount.value
            : exchangeRate.value
              ? inputAmount.value / exchangeRate.value
              : 0
    );

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
    const recoveryRate = computed({
        get: () =>
            investmentPrincipal.value === 0
                ? 0
                : (accumulatedDividend.value / investmentPrincipal.value) * 100,
        set: (val) => {
            accumulatedDividend.value = investmentPrincipal.value * (val / 100);
        },
    });
    const currentAssets = computed(
        () => (quantity.value || 0) * currentPrice.value
    );
    const growthRateForCalc = computed(() => annualGrowthRate.value / 100);

    // --- Watchers ---
    watch(
        [avgPrice, quantity, accumulatedDividend, targetAsset],
        () => {
            const symbol = props.tickerInfo?.symbol;
            if (symbol) {
                updateBookmarkDetails(symbol, {
                    avgPrice: avgPrice.value,
                    quantity: quantity.value,
                    accumulatedDividend: accumulatedDividend.value,
                    targetAsset: targetAsset.value,
                });
            }
        },
        { deep: true }
    );

    // Yield Calculator Watchers
    watch(inputAmount, (val) => {
        if (yieldCalcMode.value === 'amount' && currentPrice.value > 0) {
            const budgetInBaseCurrency = isUSD.value
                ? val
                : exchangeRate.value
                  ? val / exchangeRate.value
                  : 0;
            if (budgetInBaseCurrency > 0) {
                quantity.value = Math.floor(
                    budgetInBaseCurrency / currentPrice.value
                );
            }
        }
    });
    watch(quantity, (val) => {
        if (yieldCalcMode.value === 'quantity' && currentPrice.value > 0) {
            const totalValue = val * currentPrice.value;
            inputAmount.value = isUSD.value
                ? totalValue
                : totalValue * exchangeRate.value;
        }
    });

    // --- Chart Logic ---
    const documentStyle = getComputedStyle(document.documentElement);
    const chartTheme = {
        textColor: documentStyle.getPropertyValue('--p-text-color'),
        textColorSecondary: documentStyle.getPropertyValue(
            '--p-text-muted-color'
        ),
        surfaceBorder: documentStyle.getPropertyValue(
            '--p-content-border-color'
        ),
    };

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
            currentAssets,
            targetAmount: targetAsset,
            payoutsPerYear,
            dividendStats,
            annualGrowthRateScenario: growthRateForCalc,
            currentPrice,
            currency,
            theme: chartTheme,
        });

    // --- Lifecycle & Methods ---
    const formatKRW = (amount) =>
        (amount * exchangeRate.value).toLocaleString('ko-KR', {
            maximumFractionDigits: 0,
        }) + '원';

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

    const initYieldCalc = () => {
        if (isYieldInitialized.value || !currentPrice.value) return;
        const totalValue = quantity.value * currentPrice.value;
        inputAmount.value = isUSD.value
            ? totalValue
            : totalValue * exchangeRate.value;
        isYieldInitialized.value = true;
    };

    onMounted(async () => {
        if (isUSD.value) {
            try {
                const res = await fetch('/api/getExchangeRate');
                if (res.ok) exchangeRate.value = (await res.json()).price;
            } catch (e) {
                console.error(e);
            } finally {
                initYieldCalc();
            }
        } else {
            initYieldCalc();
        }
    });
    watch(currentPrice, initYieldCalc);
</script>

<template>
    <CalculatorLayout>
        <template #options>
            <SelectButton
                v-model="activeCalculator"
                :options="calculatorOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full" />

            <!-- Recovery & Reinvestment Shared Inputs -->
            <div
                v-if="activeCalculator !== 'yield'"
                class="flex flex-column gap-3 mt-3">
                <InputGroup>
                    <IftaLabel
                        ><InputNumber
                            v-model="avgPrice"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            inputId="avgPrice" /><label for="avgPrice"
                            >평단</label
                        ></IftaLabel
                    >
                    <IftaLabel
                        ><InputNumber
                            v-model="quantity"
                            suffix=" 주"
                            min="1"
                            inputId="quantity" /><label for="quantity"
                            >수량</label
                        ></IftaLabel
                    >
                </InputGroup>
                <InputGroup>
                    <FloatLabel variant="on"
                        ><InputNumber
                            :modelValue="investmentPrincipal"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            disabled /><label>투자원금</label></FloatLabel
                    >
                    <FloatLabel variant="on"
                        ><InputNumber
                            :modelValue="currentValue"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale"
                            disabled /><label>현재가치</label></FloatLabel
                    >
                    <Tag
                        :severity="profitLossRate >= 0 ? 'success' : 'danger'"
                        :value="`${profitLossRate.toFixed(2)}%`" />
                </InputGroup>
            </div>

            <!-- Recovery Inputs -->
            <div
                v-if="activeCalculator === 'recovery'"
                class="flex flex-column gap-3">
                <div class="toto-already">
                    <InputGroup
                        ><InputGroupAddon
                            ><RadioButton
                                v-model="recoveryCalcMode"
                                value="amount" /></InputGroupAddon
                        ><InputGroupAddon
                            ><i
                                :class="
                                    isUSD ? 'pi pi-dollar' : 'pi pi-won'
                                " /></InputGroupAddon
                        ><FloatLabel variant="on"
                            ><InputNumber
                                v-model="accumulatedDividend"
                                :mode="isUSD ? 'currency' : 'decimal'"
                                :currency="currency"
                                :locale="currencyLocale"
                                :disabled="
                                    recoveryCalcMode !== 'amount'
                                " /><label>누적 배당금</label></FloatLabel
                        ></InputGroup
                    >
                    <InputGroup
                        ><InputGroupAddon
                            ><RadioButton
                                v-model="recoveryCalcMode"
                                value="rate" /></InputGroupAddon
                        ><InputGroupAddon
                            ><i class="pi pi-percentage" /></InputGroupAddon
                        ><InputGroupAddon class="text-xs"
                            ><span>
                                {{ recoveryRate.toFixed(2) }} %</span
                            ></InputGroupAddon
                        >
                        <div
                            class="toto-range"
                            :disabled="recoveryCalcMode !== 'rate'">
                            <span
                                ><Slider
                                    v-model="recoveryRate"
                                    :min="0"
                                    :max="99.99"
                                    :step="0.01"
                                    class="w-full"
                                    :disabled="recoveryCalcMode !== 'rate'"
                            /></span></div
                    ></InputGroup>
                </div>
            </div>

            <!-- Reinvestment Inputs -->
            <div
                v-if="activeCalculator === 'reinvestment'"
                class="flex flex-column gap-3">
                <InputGroup>
                    <IftaLabel
                        ><InputNumber
                            v-model="targetAsset"
                            :mode="isUSD ? 'currency' : 'decimal'"
                            :currency="currency"
                            :locale="currencyLocale" /><label
                            >목표 자산</label
                        ></IftaLabel
                    >
                </InputGroup>
                <InputGroup
                    ><InputGroupAddon><span>주가 성장률</span></InputGroupAddon
                    ><InputGroupAddon class="text-xs"
                        ><span>
                            {{ annualGrowthRate }} %
                        </span></InputGroupAddon
                    >
                    <div class="p-inputtext toto-range">
                        <span
                            ><Slider
                                v-model="annualGrowthRate"
                                :min="-15"
                                :max="15"
                                :step="1"
                                class="flex-1"
                        /></span></div
                ></InputGroup>
            </div>

            <!-- Dividend Yield Inputs -->
            <div
                v-if="activeCalculator === 'yield'"
                class="flex flex-column gap-3 mt-3">
                <div class="flex align-items-center justify-content-between">
                    <Tag v-if="isUSD" severity="contrast"
                        >환율 :
                        {{ exchangeRate?.toLocaleString('ko-KR') }}원</Tag
                    >
                    <Tag severity="contrast"
                        >현재 주가 :
                        {{
                            currentPrice?.toLocaleString(currencyLocale, {
                                style: 'currency',
                                currency: currency,
                            })
                        }}</Tag
                    >
                </div>
                <div class="toto-howmuch">
                    <InputGroup
                        ><InputGroupAddon
                            ><RadioButton
                                v-model="yieldCalcMode"
                                value="amount" /></InputGroupAddon
                        ><InputGroupAddon
                            ><i :class="isUSD ? 'pi pi-dollar' : 'pi pi-won'"
                        /></InputGroupAddon>
                        <InputNumber
                            placeholder="투자 금액"
                            v-model="inputAmount"
                            mode="currency"
                            :currency="currency"
                            :locale="currencyLocale" />
                        <InputNumber
                            v-if="isUSD"
                            placeholder="투자 금액 (KRW)"
                            v-model="inputAmount"
                            mode="currency"
                            currency="KRW"
                            locale="ko-KR"
                            @input="
                                (e) => (inputAmount = e.value / exchangeRate)
                            " />
                    </InputGroup>
                    <InputGroup
                        ><InputGroupAddon
                            ><RadioButton
                                v-model="yieldCalcMode"
                                value="quantity" /></InputGroupAddon
                        ><InputGroupAddon
                            ><i class="pi pi-box" /></InputGroupAddon
                        ><InputNumber
                            v-model="quantity"
                            suffix=" 주"
                            class="w-full"
                    /></InputGroup>
                </div>
            </div>

            <!-- Shared Inputs -->
            <InputGroup class="toto-reference-period mt-3">
                <IftaLabel
                    ><SelectButton
                        v-model="period"
                        :options="periodOptions"
                        optionLabel="label"
                        optionValue="value" /><label
                        ><span>前 배당금 참고 기간</span
                        ><Tag severity="contrast">{{ period }}</Tag></label
                    ></IftaLabel
                >
            </InputGroup>
            <InputGroup
                v-if="activeCalculator !== 'yield'"
                class="toto-tax-apply">
                <IftaLabel
                    ><SelectButton
                        v-model="applyTax"
                        :options="taxOptions"
                        optionValue="value"
                        dataKey="value"
                        ><template #option="slotProps"
                            ><i
                                :class="slotProps.option.icon"
                                v-tooltip.bottom="
                                    slotProps.option.tooltip
                                " /><span>{{
                                slotProps.option.tooltip
                            }}</span></template
                        ></SelectButton
                    ><label
                        ><span>세금 적용</span
                        ><Tag severity="contrast">{{
                            applyTax ? '세후' : '세전'
                        }}</Tag></label
                    ></IftaLabel
                >
            </InputGroup>
        </template>

        <template #results>
            <!-- Recovery Results -->
            <div v-if="activeCalculator === 'recovery'">
                <Card>
                    <template #title>
                        <table class="w-full text-center">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>희망</th>
                                    <th>평균</th>
                                    <th>절망</th>
                                </tr>
                                <tr>
                                    <th>배당금</th>
                                    <td>
                                        ({{
                                            (
                                                dividendStats.max || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }})
                                    </td>
                                    <td>
                                        ({{
                                            (
                                                dividendStats.avg || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }})
                                    </td>
                                    <td>
                                        ({{
                                            (
                                                dividendStats.min || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }})
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <th rowspan="2">재투자</th>
                                    <td>
                                        <Tag
                                            severity="success"
                                            icon="pi pi-circle"
                                            >{{
                                                formatMonthsToYears(
                                                    recoveryTimes.hope_reinvest,
                                                    true
                                                )
                                            }}</Tag
                                        >
                                    </td>
                                    <td>
                                        <Tag
                                            severity="warn"
                                            icon="pi pi-circle"
                                            >{{
                                                formatMonthsToYears(
                                                    recoveryTimes.avg_reinvest,
                                                    true
                                                )
                                            }}</Tag
                                        >
                                    </td>
                                    <td>
                                        <Tag
                                            severity="danger"
                                            icon="pi pi-circle"
                                            >{{
                                                formatMonthsToYears(
                                                    recoveryTimes.despair_reinvest,
                                                    true
                                                )
                                            }}</Tag
                                        >
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <Tag
                                            severity="success"
                                            icon="pi pi-times"
                                            >{{
                                                formatMonthsToYears(
                                                    recoveryTimes.hope_no_reinvest,
                                                    true
                                                )
                                            }}</Tag
                                        >
                                    </td>
                                    <td>
                                        <Tag
                                            severity="warn"
                                            icon="pi pi-times"
                                            >{{
                                                formatMonthsToYears(
                                                    recoveryTimes.avg_no_reinvest,
                                                    true
                                                )
                                            }}</Tag
                                        >
                                    </td>
                                    <td>
                                        <Tag
                                            severity="danger"
                                            icon="pi pi-times"
                                            >{{
                                                formatMonthsToYears(
                                                    recoveryTimes.despair_no_reinvest,
                                                    true
                                                )
                                            }}</Tag
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </template>
                    <template #content
                        ><v-chart
                            :option="recoveryChartOptions"
                            autoresize
                            style="height: 300px"
                    /></template>
                </Card>
            </div>
            <!-- Reinvestment Results -->
            <div v-if="activeCalculator === 'reinvestment'">
                <Card>
                    <template #title>
                        <table class="w-full text-center">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>희망</th>
                                    <th>평균</th>
                                    <th>절망</th>
                                </tr>
                                <tr>
                                    <th>배당금</th>
                                    <td>
                                        {{
                                            (
                                                dividendStats.max || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </td>
                                    <td>
                                        {{
                                            (
                                                dividendStats.avg || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </td>
                                    <td>
                                        {{
                                            (
                                                dividendStats.min || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <th>기간</th>
                                    <td>
                                        <Tag severity="success">{{
                                            formatMonthsToYears(
                                                goalAchievementTimes.hope
                                            )
                                        }}</Tag>
                                    </td>
                                    <td>
                                        <Tag severity="warning">{{
                                            formatMonthsToYears(
                                                goalAchievementTimes.avg
                                            )
                                        }}</Tag>
                                    </td>
                                    <td>
                                        <Tag severity="danger">{{
                                            formatMonthsToYears(
                                                goalAchievementTimes.despair
                                            )
                                        }}</Tag>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </template>
                    <template #content
                        ><v-chart
                            :option="reinvestmentChartOptions"
                            autoresize
                            style="height: 300px"
                    /></template>
                </Card>
            </div>
            <!-- Dividend Yield Results -->
            <div v-if="activeCalculator === 'yield'">
                <Card class="toto-howmuch-result">
                    <template #content>
                        <table class="w-full text-center">
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
                                            (
                                                dividendStats.max || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </th>
                                    <th>
                                        {{
                                            (
                                                dividendStats.avg || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </th>
                                    <th>
                                        {{
                                            (
                                                dividendStats.min || 0
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
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
                                            (
                                                (dividendStats.max || 0) * 0.85
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </th>
                                    <th>
                                        {{
                                            (
                                                (dividendStats.avg || 0) * 0.85
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </th>
                                    <th>
                                        {{
                                            (
                                                (dividendStats.min || 0) * 0.85
                                            ).toLocaleString(currencyLocale, {
                                                style: 'currency',
                                                currency: currency,
                                                maximumFractionDigits: 4,
                                            })
                                        }}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="p-2 font-semibold" rowspan="2">
                                        1회당
                                    </td>
                                    <th>
                                        <i
                                            class="pi pi-lock-open"
                                            v-tooltip.bottom="'세전'" />
                                    </th>
                                    <td>
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
                                    <td>
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
                                    <td>
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
                                <tr class="border-b border-surface-800">
                                    <th>
                                        <i
                                            class="pi pi-lock"
                                            v-tooltip.bottom="'세후'" />
                                    </th>
                                    <td>
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
                                    <td>
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
                                    <td>
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
                                    <td class="p-2 font-semibold" rowspan="2">
                                        월간
                                    </td>
                                    <th>
                                        <i
                                            class="pi pi-lock-open"
                                            v-tooltip.bottom="'세전'" />
                                    </th>
                                    <td>
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
                                    <td>
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
                                    <td>
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
                                <tr class="border-b border-surface-800">
                                    <th>
                                        <i
                                            class="pi pi-lock"
                                            v-tooltip.bottom="'세후'" />
                                    </th>
                                    <td>
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
                                    <td>
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
                                    <td>
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
                                    <td class="p-2 font-semibold" rowspan="2">
                                        연간
                                    </td>
                                    <th>
                                        <i
                                            class="pi pi-lock-open"
                                            v-tooltip.bottom="'세전'" />
                                    </th>
                                    <td>
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
                                    <td>
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
                                    <td>
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
                                    <th>
                                        <i
                                            class="pi pi-lock"
                                            v-tooltip.bottom="'세후'" />
                                    </th>
                                    <td>
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
                                    <td>
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
                                    <td>
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
                    </template>
                </Card>
            </div>
        </template>
    </CalculatorLayout>
</template>
