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
    import CalculatorResult from './CalculatorResult.vue';
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

    // --- State 정의 ---
    const myAveragePrice = ref(0); // 기본값 0, onMounted에서 설정
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

    // --- 공통 Computed ---
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

    // --- 계산 로직 Computed ---
    const remainingPrincipalPerShare = computed(() => {
        const price = myAveragePrice.value || 0;
        const rate = recoveryRate.value || 0;
        return price * ((100 - rate) / 100);
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

    const calculatedRecoveryTime = computed(() => {
        const calculateMonths = (dividendPerShare) => {
            if (
                remainingPrincipalPerShare.value <= 0 ||
                dividendPerShare <= 0 ||
                payoutsPerYear.value <= 0
            )
                return 0;
            const finalDividend = applyTax.value
                ? dividendPerShare * 0.85
                : dividendPerShare;
            if (finalDividend <= 0) return Infinity;

            const payoutsToRecover =
                remainingPrincipalPerShare.value / finalDividend;
            return (payoutsToRecover * 12) / payoutsPerYear.value;
        };
        return {
            hope: calculateMonths(dividendStats.value.max),
            avg: calculateMonths(dividendStats.value.avg),
            despair: calculateMonths(dividendStats.value.min),
        };
    });

    // 차트 컴포저블은 수정 없이 그대로 사용 가능!
    // investmentAmount에 남은 원금을, sharesToBuy에 1주를 기준으로 넘겨주면 됨.
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
            investmentAmount: remainingPrincipalPerShare,
            sharesToBuy: ref(1),
            dividendStats,
            payoutsPerYear,
            applyTax,
            theme: chartTheme,
        });

    // --- localStorage 핸들링 ---
    const getStorageKey = () =>
        `recoveryCalculatorState_${props.tickerInfo?.Symbol}`;

    const saveState = () => {
        const state = {
            myAveragePrice: myAveragePrice.value,
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
            recoveryRate.value = savedState.recoveryRate;
            recoveryPeriod.value = savedState.recoveryPeriod;
            applyTax.value = savedState.applyTax;
        } else {
            // 저장된 값이 없으면, 현재가를 평단 기본값으로 설정
            myAveragePrice.value = currentPrice.value;
        }
    };

    onMounted(() => {
        // 컴포넌트가 마운트되고, currentPrice 계산이 끝난 후에 상태 로드
        loadState();
    });

    // currentPrice가 처음 계산되었을 때, 저장된 값이 없다면 평단가 업데이트
    watch(currentPrice, (newPrice) => {
        const savedStateJSON = localStorage.getItem(getStorageKey());
        if (!savedStateJSON && newPrice > 0) {
            myAveragePrice.value = newPrice;
        }
    });

    // 사용자가 값을 변경할 때마다 자동으로 저장
    watch([myAveragePrice, recoveryRate, recoveryPeriod, applyTax], saveState, {
        deep: true,
    });
</script>

<template>
    <div v-if="deviceType === 'mobile'" class="card" id="t-calculator-step">
        <Stepper value="1">
            <StepItem value="1">
                <Step
                    ><span>나의 평단</span
                    ><Tag severity="contrast"
                        >${{ myAveragePrice.toFixed(2) }}</Tag
                    ></Step
                >
                <StepPanel
                    ><InputGroup
                        ><InputGroupAddon>$</InputGroupAddon
                        ><InputNumber
                            v-model="myAveragePrice"
                            placeholder="나의 평단"
                            mode="currency"
                            currency="USD"
                            locale="en-US" /></InputGroup
                ></StepPanel>
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
                        /><InputNumber
                            v-model="recoveryRate"
                            suffix=" %"
                            class="w-24"
                        /></div
                ></StepPanel>
            </StepItem>
            <StepItem value="3">
                <Step
                    ><span>지나간 배당금 참고</span
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
                    ><span>배당소득세 15%</span
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
        <CalculatorResult
            :formatMonthsToYears="formatMonthsToYears"
            :dividendStats="dividendStats"
            :recoveryTimes="calculatedRecoveryTime"
            :recoveryChartData="recoveryChartData"
            :recoveryChartOptions="recoveryChartOptions"
            containerClass="chart-container-mobile"
        />
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
                <label
                    >이미 회수한 원금 % <Tag :value="`${recoveryRate}%`"
                /></label>
                <Slider v-model="recoveryRate" :min="0" :max="100" />
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
            <CalculatorResult
                :formatMonthsToYears="formatMonthsToYears"
                :dividendStats="dividendStats"
                :recoveryTimes="calculatedRecoveryTime"
                :recoveryChartData="recoveryChartData"
                :recoveryChartOptions="recoveryChartOptions"
                containerClass="chart-container-desktop"
            />
        </SplitterPanel>
    </Splitter>
</template>
