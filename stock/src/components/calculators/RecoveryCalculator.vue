<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import Card from 'primevue/card';
    import RadioButton from 'primevue/radiobutton';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import InputNumber from 'primevue/inputnumber';
    import InputText from 'primevue/inputtext';
    import SelectButton from 'primevue/selectbutton';
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import Slider from 'primevue/slider';
    import Chart from 'primevue/chart';
    import { parseYYMMDD } from '@/utils/date.js';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useRecoveryChart } from '@/composables/charts/useRecoveryChart.js';

    const { deviceType } = useBreakpoint();
    const props = defineProps({ dividendHistory: Array, tickerInfo: Object });

    const formatMonthsToYears = (totalMonths) => {
        if (totalMonths === Infinity || isNaN(totalMonths) || totalMonths <= 0)
            return '계산 불가';
        const years = Math.floor(totalMonths / 12);
        const months = Math.round(totalMonths % 12);
        return years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
    };

    const myAveragePrice = ref(0);
    const myShares = ref(1);
    const recoveryPeriod = ref('1Y');
    const applyTax = ref(true);

    const calculationMode = ref('amount'); // 'amount' or 'rate'
    const recoveredAmount = ref(0);
    const recoveryRate = ref(0);

    const periodOptions = ref([
        { label: '前 3M', value: '3M' },
        { label: '前 6M', value: '6M' },
        { label: '前 1Y', value: '1Y' },
    ]);
    const taxOptions = ref([
        { icon: 'pi pi-shield', value: false, tooltip: '세전' },
        { icon: 'pi pi-building-columns', value: true, tooltip: '세후 (15%)' },
    ]);

    const currentPrice = computed(() => {
        if (!props.dividendHistory || props.dividendHistory.length === 0)
            return 0;
        const latestRecord = props.dividendHistory.find(
            (r) => r['당일종가'] && r['당일종가'] !== 'N/A'
        );
        return latestRecord
            ? parseFloat(latestRecord['당일종가'].replace('$', '')) || 0
            : 0;
    });
    const payoutsPerYear = computed(() => {
        if (!props.dividendHistory || props.dividendHistory.length === 0)
            return 0;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const pastYear = props.dividendHistory.filter(
            (i) => parseYYMMDD(i['배당락']) >= oneYearAgo
        );
        if (pastYear.length > 0) return pastYear.length;
        const freq = props.tickerInfo?.frequency;
        return freq === '매주' ? 52 : freq === '분기' ? 4 : 12;
    });

    const totalInvestment = computed(
        () => (myAveragePrice.value || 0) * (myShares.value || 0)
    );

    watch(recoveredAmount, (newAmount) => {
        if (calculationMode.value === 'amount' && totalInvestment.value > 0) {
            recoveryRate.value = (newAmount / totalInvestment.value) * 100;
        }
    });

    watch(recoveryRate, (newRate) => {
        if (calculationMode.value === 'rate') {
            recoveredAmount.value = totalInvestment.value * (newRate / 100);
        }
    });

    watch(totalInvestment, () => {
        if (calculationMode.value === 'amount') {
            if (totalInvestment.value > 0) {
                recoveryRate.value =
                    (recoveredAmount.value / totalInvestment.value) * 100;
            }
        } else {
            recoveredAmount.value =
                totalInvestment.value * (recoveryRate.value / 100);
        }
    });

    const dividendStats = computed(() => {
        const filtered = props.dividendHistory.filter((i) => {
            const now = new Date();
            let cutoffDate = new Date();
            const rangeValue = parseInt(recoveryPeriod.value);
            const rangeUnit = recoveryPeriod.value.slice(-1);
            if (rangeUnit === 'M')
                cutoffDate.setMonth(now.getMonth() - rangeValue);
            else cutoffDate.setFullYear(now.getFullYear() - rangeValue);
            return parseYYMMDD(i['배당락']) >= cutoffDate;
        });
        const validAmounts = filtered
            .map((h) => parseFloat(h['배당금']?.replace('$', '')))
            .filter((a) => a && a > 0);
        if (validAmounts.length === 0) return { min: 0, max: 0, avg: 0 };
        return {
            min: Math.min(...validAmounts),
            max: Math.max(...validAmounts),
            avg: validAmounts.reduce((s, a) => s + a, 0) / validAmounts.length,
        };
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
            myAveragePrice,
            myShares,
            recoveryRate,
            dividendStats,
            payoutsPerYear,
            applyTax,
            currentPrice,
            theme: chartTheme,
        });

    const getStorageKey = () =>
        `recoveryCalculatorState_${props.tickerInfo?.Symbol}`;
    const saveState = () => {
        const state = {
            myAveragePrice: myAveragePrice.value,
            myShares: myShares.value,
            recoveryRate: recoveryRate.value,
            recoveryPeriod: recoveryPeriod.value,
            applyTax: applyTax.value,
        };
        localStorage.setItem(getStorageKey(), JSON.stringify(state));
    };
    const loadState = () => {
        const savedStateJSON = localStorage.getItem(getStorageKey());
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            myAveragePrice.value = savedState.myAveragePrice;
            myShares.value = savedState.myShares;
            recoveryRate.value = savedState.recoveryRate || 0;
            recoveryPeriod.value = savedState.recoveryPeriod;
            applyTax.value = savedState.applyTax;
        } else {
            // [핵심 수정] 기본값 로드 시 myShares도 함께 초기화합니다.
            myAveragePrice.value = currentPrice.value;
            myShares.value = 100; // 또는 1 (최소값)
        }
    };

    onMounted(loadState);
    watch(currentPrice, (newPrice) => {
        const savedStateJSON = localStorage.getItem(getStorageKey());
        if (!savedStateJSON && newPrice > 0) {
            myAveragePrice.value = newPrice;
        }
    });
    watch(
        [myAveragePrice, myShares, recoveryRate, recoveryPeriod, applyTax],
        saveState,
        { deep: true }
    );
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
                        v-model="myAveragePrice"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                        inputId="myAveragePrice" />
                    <label for="myAveragePrice">현재 평단</label>
                </IftaLabel>
                <IftaLabel>
                    <InputNumber
                        v-model="myShares"
                        suffix=" 주"
                        min="1"
                        inputId="myShares" />
                    <label for="myShares">현재 수량</label>
                </IftaLabel>
                <IftaLabel>
                    <InputNumber
                        :modelValue="totalInvestment"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                        disabled
                        inputId="totalInvestment" />
                    <label for="totalInvestment">현재 가치</label>
                </IftaLabel>
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
                    <IftaLabel>
                        <InputNumber
                            v-model="recoveredAmount"
                            placeholder="이미 받은 배당금"
                            mode="currency"
                            currency="USD"
                            locale="en-US"
                            :disabled="calculationMode !== 'amount'"
                            inputId="recoveredAmount" />
                        <label for="recoveredAmount">누적 배당금</label>
                    </IftaLabel>
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
                                        recoveryTimes.hope_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="warn" icon="pi pi-circle">{{
                                    formatMonthsToYears(
                                        recoveryTimes.avg_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="danger" icon="pi pi-circle">{{
                                    formatMonthsToYears(
                                        recoveryTimes.despair_reinvest
                                    )
                                }}</Tag>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Tag severity="success" icon="pi pi-times">{{
                                    formatMonthsToYears(
                                        recoveryTimes.hope_no_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="warn" icon="pi pi-times">{{
                                    formatMonthsToYears(
                                        recoveryTimes.avg_no_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="danger" icon="pi pi-times">{{
                                    formatMonthsToYears(
                                        recoveryTimes.despair_no_reinvest
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
