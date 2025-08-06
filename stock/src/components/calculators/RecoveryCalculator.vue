<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import Stepper from 'primevue/stepper';
    import StepItem from 'primevue/stepitem';
    import Step from 'primevue/step';
    import StepPanel from 'primevue/steppanel';
    import Splitter from 'primevue/splitter';
    import SplitterPanel from 'primevue/splitterpanel';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import InputNumber from 'primevue/inputnumber';
    import SelectButton from 'primevue/selectbutton';
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import Slider from 'primevue/slider';
    // import CalculatorResult from './CalculatorResult.vue';
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
    const myShares = ref(100);
    const recoveryRate = ref(0);
    const recoveryPeriod = ref('1Y');
    const applyTax = ref(true);

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
            myAveragePrice.value = currentPrice.value;
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
    <div v-if="deviceType === 'mobile'" class="card" id="t-calculator-step">
        <Stepper value="1">
            <StepItem value="1">
                <Step
                    ><span>나의 투자 현황</span
                    ><Tag severity="contrast"
                        >${{ myAveragePrice.toFixed(2) }} /
                        {{ myShares }}주</Tag
                    ></Step
                >
                <StepPanel>
                    <div class="flex flex-column gap-2">
                        <InputGroup
                            ><InputGroupAddon>$</InputGroupAddon
                            ><InputNumber
                                v-model="myAveragePrice"
                                placeholder="나의 평단"
                        /></InputGroup>
                        <InputGroup
                            ><InputNumber
                                v-model="myShares"
                                placeholder="보유 수량"
                            /><InputGroupAddon>주</InputGroupAddon></InputGroup
                        >
                    </div>
                </StepPanel>
            </StepItem>
            <StepItem value="2">
                <Step
                    ><span>이미 회수한 원금 %</span
                    ><Tag severity="contrast">{{ recoveryRate }}%</Tag></Step
                >
                <StepPanel
                    ><div class="flex items-center gap-2">
                        <Slider
                            v-model="recoveryRate"
                            :min="0"
                            :max="100"
                            class="flex-1"
                        /></div
                ></StepPanel>
            </StepItem>
            <StepItem value="3">
                <Step
                    ><span>배당금 참고 기간</span
                    ><Tag severity="contrast">{{ recoveryPeriod }}</Tag></Step
                >
                <StepPanel
                    ><SelectButton
                        v-model="recoveryPeriod"
                        :options="periodOptions"
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                /></StepPanel>
            </StepItem>
            <StepItem value="4">
                <Step
                    ><span>세금 적용</span
                    ><Tag severity="contrast">{{
                        applyTax ? '세후' : '세전'
                    }}</Tag></Step
                >
                <StepPanel
                    ><SelectButton
                        v-model="applyTax"
                        :options="taxOptions"
                        optionValue="value"
                        size="small"
                        dataKey="value"
                        ><template #option="slotProps"
                            ><i
                                :class="slotProps.option.icon"
                                v-tooltip.bottom="slotProps.option.tooltip"
                            ></i
                            ><span>{{
                                slotProps.option.tooltip
                            }}</span></template
                        ></SelectButton
                    ></StepPanel
                >
            </StepItem>
        </Stepper>
        <Divider />
        <Card class="t-calculator-result">
            <template #title>
                <table class="w-full text-center text-sm">
                    <thead>
                        <tr>
                            <th></th>
                            <th>희망</th>
                            <th>평균</th>
                            <th>절망</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="font-bold text-green-500">재투자 O</td>
                            <td>
                                <Tag severity="success">{{
                                    formatMonthsToYears(
                                        recoveryTimes.hope_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="warning">{{
                                    formatMonthsToYears(
                                        recoveryTimes.avg_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="danger">{{
                                    formatMonthsToYears(
                                        recoveryTimes.despair_reinvest
                                    )
                                }}</Tag>
                            </td>
                        </tr>
                        <tr>
                            <td class="font-bold text-gray-500">재투자 X</td>
                            <td>
                                <Tag severity="success" outlined>{{
                                    formatMonthsToYears(
                                        recoveryTimes.hope_no_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="warning" outlined>{{
                                    formatMonthsToYears(
                                        recoveryTimes.avg_no_reinvest
                                    )
                                }}</Tag>
                            </td>
                            <td>
                                <Tag severity="danger" outlined>{{
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
                <div class="chart-container-desktop">
                    <Chart
                        type="bar"
                        :data="recoveryChartData"
                        :options="recoveryChartOptions"
                    />
                </div>
            </template>
        </Card>
    </div>
    <Splitter v-else id="t-calculator-return">
        <SplitterPanel
            class="flex items-center justify-center flex-column gap-5 p-4"
            :size="deviceType === 'tablet' ? '60' : '50'"
        >
            <div class="flex flex-column gap-2 w-full">
                <label>나의 평단 ($)</label
                ><InputNumber
                    v-model="myAveragePrice"
                    mode="currency"
                    currency="USD"
                    locale="en-US"
                />
            </div>
            <div class="flex flex-column gap-2 w-full">
                <label>보유 수량</label
                ><InputNumber v-model="myShares" suffix=" 주" />
            </div>
            <div class="flex flex-column gap-2 w-full">
                <label
                    >이미 회수한 원금 %
                    <Tag :value="`${recoveryRate}%`" /></label
                ><Slider v-model="recoveryRate" :min="0" :max="100" />
            </div>
            <div class="flex flex-column gap-2 w-full">
                <label
                    ><span>지나간 배당금 참고</span
                    ><Tag severity="contrast">{{ recoveryPeriod }}</Tag></label
                ><SelectButton
                    v-model="recoveryPeriod"
                    :options="periodOptions"
                    optionLabel="label"
                    optionValue="value"
                />
            </div>
            <div class="flex flex-column gap-2 w-full">
                <label
                    ><span>배당소득세 15%</span
                    ><Tag severity="contrast">{{
                        applyTax ? '세후' : '세전'
                    }}</Tag></label
                ><SelectButton
                    v-model="applyTax"
                    :options="taxOptions"
                    optionValue="value"
                    dataKey="value"
                    ><template #option="slotProps"
                        ><i
                            :class="slotProps.option.icon"
                            v-tooltip.bottom="slotProps.option.tooltip"
                        ></i
                        ><span>{{ slotProps.option.tooltip }}</span></template
                    ></SelectButton
                >
            </div>
        </SplitterPanel>
        <SplitterPanel
            class="flex items-center justify-center p-4"
            :size="deviceType === 'tablet' ? '40' : '50'"
            :minSize="10"
        >
            <Card class="t-calculator-result">
                <template #title>
                    <table class="w-full text-center text-sm">
                        <thead>
                            <tr>
                                <th></th>
                                <th>희망</th>
                                <th>평균</th>
                                <th>절망</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="font-bold text-green-500">
                                    재투자 O
                                </td>
                                <td>
                                    <Tag severity="success">{{
                                        formatMonthsToYears(
                                            recoveryTimes.hope_reinvest
                                        )
                                    }}</Tag>
                                </td>
                                <td>
                                    <Tag severity="warning">{{
                                        formatMonthsToYears(
                                            recoveryTimes.avg_reinvest
                                        )
                                    }}</Tag>
                                </td>
                                <td>
                                    <Tag severity="danger">{{
                                        formatMonthsToYears(
                                            recoveryTimes.despair_reinvest
                                        )
                                    }}</Tag>
                                </td>
                            </tr>
                            <tr>
                                <td class="font-bold text-gray-500">
                                    재투자 X
                                </td>
                                <td>
                                    <Tag severity="success" outlined>{{
                                        formatMonthsToYears(
                                            recoveryTimes.hope_no_reinvest
                                        )
                                    }}</Tag>
                                </td>
                                <td>
                                    <Tag severity="warning" outlined>{{
                                        formatMonthsToYears(
                                            recoveryTimes.avg_no_reinvest
                                        )
                                    }}</Tag>
                                </td>
                                <td>
                                    <Tag severity="danger" outlined>{{
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
                    <div class="chart-container-desktop">
                        <Chart
                            type="bar"
                            :data="recoveryChartData"
                            :options="recoveryChartOptions"
                        />
                    </div>
                </template>
            </Card>
        </SplitterPanel>
    </Splitter>
</template>
