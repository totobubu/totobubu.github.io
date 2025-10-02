<!-- REFACTORED: src/components/calculators/RecoveryCalculator.vue -->
<script setup>
    import { ref, computed, watch } from 'vue';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useRecoveryChart } from '@/composables/charts/useRecoveryChart.js';
    import { useDividendStats } from '@/composables/useDividendStats';
    import { formatMonthsToYears } from '@/utils/date.js';

    import Card from 'primevue/card';
    import Chart from 'primevue/chart';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import SelectButton from 'primevue/selectbutton';
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import Slider from 'primevue/slider';
    import FloatLabel from 'primevue/floatlabel';
    import IftaLabel from 'primevue/iftalabel';

    const props = defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const { deviceType } = useBreakpoint();
    const { updateBookmarkDetails } = useFilterState();

    const avgPrice = ref(props.userBookmark?.avgPrice || 0);
    const quantity = ref(props.userBookmark?.quantity || 0);
    const accumulatedDividend = ref(
        props.userBookmark?.accumulatedDividend || 0
    );

    const recoveryPeriod = ref('1Y');
    const { dividendStats, payoutsPerYear } = useDividendStats(
        computed(() => props.dividendHistory),
        computed(() => props.tickerInfo),
        recoveryPeriod
    );
    const applyTax = ref(true);
    const calculationMode = ref('amount');

    const periodOptions = ref([
        { label: '前 3M', value: '3M' },
        { label: '前 6M', value: '6M' },
        { label: '前 1Y', value: '1Y' },
    ]);
    const taxOptions = ref([
        { icon: 'pi pi-shield', value: false, tooltip: '세전' },
        { icon: 'pi pi-building-columns', value: true, tooltip: '세후 (15%)' },
    ]);

    const currentPrice = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );
    const investmentPrincipal = computed(
        () => (quantity.value || 0) * (avgPrice.value || 0)
    );
    const currentValue = computed(
        () => (quantity.value || 0) * currentPrice.value
    );

    const profitLossRate = computed(() => {
        if (investmentPrincipal.value === 0) return 0;
        const profit = currentValue.value - investmentPrincipal.value;
        return (profit / investmentPrincipal.value) * 100;
    });

    const recoveryRate = computed({
        get() {
            if (investmentPrincipal.value === 0) return 0;
            return (
                (accumulatedDividend.value / investmentPrincipal.value) * 100
            );
        },
        set(newRate) {
            accumulatedDividend.value =
                investmentPrincipal.value * (newRate / 100);
        },
    });

    watch(avgPrice, (newValue) => {
        const symbol = props.tickerInfo?.symbol;
        if (symbol) updateBookmarkDetails(symbol, { avgPrice: newValue });
    });
    watch(quantity, (newValue) => {
        const symbol = props.tickerInfo?.symbol;
        if (symbol) updateBookmarkDetails(symbol, { quantity: newValue });
    });
    watch(accumulatedDividend, (newValue) => {
        const symbol = props.tickerInfo?.symbol;
        if (symbol)
            updateBookmarkDetails(symbol, { accumulatedDividend: newValue });
    });

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

    const { recoveryTimes, recoveryChartData, recoveryChartOptions } =
        useRecoveryChart({
            avgPrice,
            quantity,
            accumulatedDividend,
            dividendStats,
            payoutsPerYear,
            applyTax,
            currentPrice,
            theme: chartTheme,
        });
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
            <InputGroup
                :class="deviceType === 'mobile' ? 'flex-column gap-2' : ''">
                <IftaLabel>
                    <InputNumber
                        v-model="avgPrice"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                        inputId="myAveragePrice" />
                    <label for="myAveragePrice">평단</label>
                </IftaLabel>
                <IftaLabel>
                    <InputNumber
                        v-model="quantity"
                        suffix=" 주"
                        min="1"
                        inputId="myShares" />
                    <label for="myShares">수량</label>
                </IftaLabel>
            </InputGroup>
            <InputGroup
                :class="deviceType === 'mobile' ? 'flex-column gap-2' : ''">
                <FloatLabel variant="on">
                    <InputNumber
                        :modelValue="investmentPrincipal"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                        disabled
                        inputId="totalInvestment" />
                    <label for="totalInvestment">투자원금</label>
                </FloatLabel>
                <FloatLabel variant="on">
                    <InputNumber
                        :modelValue="currentValue"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                        disabled
                        inputId="currentValue" />
                    <label for="currentValue">현재가치 </label>
                </FloatLabel>
                <Tag
                    :severity="profitLossRate >= 0 ? 'success' : 'danger'"
                    :value="`${profitLossRate.toFixed(2)}%`" />
            </InputGroup>
            <div class="toto-already">
                <InputGroup>
                    <InputGroupAddon>
                        <RadioButton
                            v-model="calculationMode"
                            inputId="modeAmount"
                            name="calcMode"
                            value="amount" />
                    </InputGroupAddon>
                    <InputGroupAddon>
                        <i class="pi pi-dollar" />
                    </InputGroupAddon>
                    <FloatLabel variant="on">
                        <InputNumber
                            v-model="accumulatedDividend"
                            placeholder="누적 배당금"
                            mode="currency"
                            currency="USD"
                            locale="en-US"
                            :disabled="calculationMode !== 'amount'"
                            inputId="recoveredAmount" />
                        <label for="recoveredAmount">누적 배당금</label>
                    </FloatLabel>
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon>
                        <RadioButton
                            v-model="calculationMode"
                            inputId="modeRate"
                            name="calcMode"
                            value="rate" />
                    </InputGroupAddon>
                    <InputGroupAddon>
                        <i class="pi pi-percentage" />
                    </InputGroupAddon>
                    <InputGroupAddon class="text-xs">
                        <span> {{ recoveryRate.toFixed(2) }} %</span>
                    </InputGroupAddon>
                    <div
                        class="toto-range"
                        :disabled="calculationMode !== 'rate'">
                        <span>
                            <Slider
                                v-model="recoveryRate"
                                :min="0"
                                :max="99.99"
                                :step="0.01"
                                class="w-full"
                                :disabled="calculationMode !== 'rate'" />
                        </span>
                    </div>
                </InputGroup>
            </div>
            <InputGroup class="toto-reference-period">
                <IftaLabel>
                    <SelectButton
                        v-model="recoveryPeriod"
                        :options="periodOptions"
                        optionLabel="label"
                        optionValue="value"
                        inputId="recoveryPeriod" />
                    <label for="recoveryPeriod">
                        <span>前 배당금 참고 기간</span>
                        <Tag severity="contrast">{{ recoveryPeriod }}</Tag>
                    </label>
                </IftaLabel>
            </InputGroup>
            <InputGroup class="toto-tax-apply">
                <IftaLabel>
                    <SelectButton
                        v-model="applyTax"
                        :options="taxOptions"
                        optionValue="value"
                        dataKey="value"
                        inputId="applyTax">
                        <template #option="slotProps">
                            <i
                                :class="slotProps.option.icon"
                                v-tooltip.bottom="slotProps.option.tooltip" />
                            <span>{{ slotProps.option.tooltip }}</span>
                        </template>
                    </SelectButton>
                    <label for="applyTax">
                        <span>세금 적용</span>
                        <Tag severity="contrast">{{
                            applyTax ? '세후' : '세전'
                        }}</Tag>
                    </label>
                </IftaLabel>
            </InputGroup>
        </div>
        <Divider v-if="deviceType !== 'desktop'" />
        <Card class="toto-calculator-result flex-1">
            <template #title>
                <table class="w-full text-center">
                    <colgroup>
                        <col />
                        <col style="width: 28%" />
                        <col style="width: 28%" />
                        <col style="width: 28%" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th></th>
                            <th>희망</th>
                            <th>평균</th>
                            <th>절망</th>
                        </tr>
                        <tr>
                            <th>배당금</th>
                            <td>(${{ dividendStats.max.toFixed(4) }})</td>
                            <td>(${{ dividendStats.avg.toFixed(4) }})</td>
                            <td>(${{ dividendStats.min.toFixed(4) }})</td>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th rowspan="2">재투자</th>
                            <td>
                                <Tag severity="success" icon="pi pi-circle">{{
                                    formatMonthsToYears(
                                        recoveryTimes.hope_reinvest,
                                        true
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="warn" icon="pi pi-circle">{{
                                    formatMonthsToYears(
                                        recoveryTimes.avg_reinvest,
                                        true
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="danger" icon="pi pi-circle">{{
                                    formatMonthsToYears(
                                        recoveryTimes.despair_reinvest,
                                        true
                                    )
                                }}</Tag>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Tag severity="success" icon="pi pi-times">{{
                                    formatMonthsToYears(
                                        recoveryTimes.hope_no_reinvest,
                                        true
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="warn" icon="pi pi-times">{{
                                    formatMonthsToYears(
                                        recoveryTimes.avg_no_reinvest,
                                        true
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="danger" icon="pi pi-times">{{
                                    formatMonthsToYears(
                                        recoveryTimes.despair_no_reinvest,
                                        true
                                    )
                                }}</Tag>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </template>
            <template #content>
                <Chart
                    type="bar"
                    :data="recoveryChartData"
                    :options="recoveryChartOptions" />
            </template>
        </Card>
    </div>
</template>
