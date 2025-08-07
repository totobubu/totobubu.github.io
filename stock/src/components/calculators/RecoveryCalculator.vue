<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import Stepper from 'primevue/stepper';
    import StepItem from 'primevue/stepitem';
    import Step from 'primevue/step';
    import StepPanel from 'primevue/steppanel';
    import Chart from 'primevue/chart';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import InputNumber from 'primevue/inputnumber';
    import SelectButton from 'primevue/selectbutton';
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import Slider from 'primevue/slider';
    import Card from 'primevue/card';
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
    const myShares = ref(1); // [핵심 수정] 기본값 1로 설정
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

    const totalInvestment = computed(
        () => (myAveragePrice.value || 0) * (myShares.value || 0)
    );

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
    <Stepper value="1" class="w-full">
        <StepList class="mx-8" v-if="deviceType !== 'mobile'">
            <Step value="1">계산</Step>
            <Step value="2">결과</Step>
        </StepList>
        <StepPanels>
            <StepPanel v-slot="{ activateCallback }" value="1">
                <div
                    class="flex flex-column"
                    :class="deviceType === 'mobile' ? 'gap-2' : ' gap-5'"
                >
                    <InputGroup
                        :class="
                            deviceType === 'mobile' ? 'flex-column gap-2' : ''
                        "
                    >
                        <IftaLabel>
                            <InputNumber
                                v-model="myAveragePrice"
                                mode="currency"
                                currency="USD"
                                locale="en-US"
                                inputId="myAveragePrice"
                            />
                            <label for="myAveragePrice">나의 평단</label>
                        </IftaLabel>
                        <IftaLabel>
                            <InputNumber
                                v-model="myShares"
                                suffix=" 주"
                                min="1"
                                inputId="myShares"
                            />
                            <label for="myShares">보유 수량</label>
                        </IftaLabel>
                        <IftaLabel>
                            <InputNumber
                                :modelValue="myAveragePrice * myShares"
                                mode="currency"
                                currency="USD"
                                locale="en-US"
                                disabled
                                inputId="totalInvestment"
                            />
                            <label for="totalInvestment">투자원금</label>
                        </IftaLabel>
                    </InputGroup>
                    <InputGroup>
                        <InputGroupAddon
                            style="font-size: var(--p-iftalabel-font-size)"
                            >회수율</InputGroupAddon
                        >

                        <div class="p-inputtext toto-range">
                            <span>
                                <Slider
                                    v-model="recoveryRate"
                                    :min="0"
                                    :max="99"
                                    class="flex-1"
                                />
                            </span>
                        </div>

                        <InputGroupAddon class="text-xs">
                            <span> {{ recoveryRate }} % </span>
                        </InputGroupAddon>
                    </InputGroup>
                    <div
                        class="flex w-full"
                        :class="
                            deviceType === 'mobile'
                                ? 'flex-column gap-2'
                                : 'flex-row gap-4'
                        "
                    >
                        <Card class="toto-reference-period">
                            <template #header>
                                <label class="text-sm"
                                    ><span>前 배당금 참고 기간</span>
                                    <Tag severity="contrast">{{
                                        recoveryPeriod
                                    }}</Tag></label
                                >
                            </template>
                            <template #content>
                                <SelectButton
                                    v-model="recoveryPeriod"
                                    :options="periodOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    size="small"
                                />
                            </template>
                        </Card>
                        <Card class="toto-tax-apply">
                            <template #header>
                                <label class="text-sm">
                                    <span>세금 적용</span>
                                    <Tag severity="contrast">{{
                                        applyTax ? '세후' : '세전'
                                    }}</Tag></label
                                >
                            </template>
                            <template #content>
                                <SelectButton
                                    v-model="applyTax"
                                    :options="taxOptions"
                                    optionValue="value"
                                    size="small"
                                    dataKey="value"
                                    class="w-full"
                                >
                                    <template #option="slotProps"
                                        ><i
                                            :class="slotProps.option.icon"
                                            v-tooltip.bottom="
                                                slotProps.option.tooltip
                                            "
                                        ></i
                                        ><span>{{
                                            slotProps.option.tooltip
                                        }}</span></template
                                    >
                                </SelectButton>
                            </template>
                        </Card>
                    </div>
                </div>
                <div class="flex pt-2 justify-content-end w-full">
                    <Button
                        label="결과보기"
                        severity="secondary"
                        icon="pi pi-arrow-right"
                        iconPos="right"
                        @click="activateCallback('2')"
                        size="small"
                    />
                </div>
            </StepPanel>
            <StepPanel v-slot="{ activateCallback }" value="2">
                <Card class="toto-calculator-result">
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
                                    <td>배당금</td>
                                    <td>
                                        (${{ dividendStats.max.toFixed(4) }})
                                    </td>
                                    <td>
                                        (${{ dividendStats.avg.toFixed(4) }})
                                    </td>
                                    <td>
                                        (${{ dividendStats.min.toFixed(4) }})
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <th>재투자</th>
                                    <td>
                                        <div
                                            class="flex flex-column gap-1 justify-content-center"
                                        >
                                            <Tag
                                                severity="success"
                                                icon="pi pi-circle"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes.hope_reinvest
                                                    )
                                                }}</Tag
                                            >
                                            <Tag
                                                severity="success"
                                                icon="pi pi-times"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes.hope_no_reinvest
                                                    )
                                                }}</Tag
                                            >
                                        </div>
                                    </td>
                                    <td>
                                        <div
                                            class="flex flex-column gap-1 justify-content-center"
                                        >
                                            <Tag
                                                severity="warn"
                                                icon="pi pi-circle"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes.avg_reinvest
                                                    )
                                                }}</Tag
                                            >
                                            <Tag
                                                severity="warn"
                                                icon="pi pi-times"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes.avg_no_reinvest
                                                    )
                                                }}</Tag
                                            >
                                        </div>
                                    </td>
                                    <td>
                                        <div
                                            class="flex flex-column gap-1 justify-content-center"
                                        >
                                            <Tag
                                                severity="danger"
                                                icon="pi pi-circle"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes.despair_reinvest
                                                    )
                                                }}</Tag
                                            >
                                            <Tag
                                                severity="danger"
                                                icon="pi pi-times"
                                                >{{
                                                    formatMonthsToYears(
                                                        recoveryTimes.despair_no_reinvest
                                                    )
                                                }}</Tag
                                            >
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </template>
                    <template #content>
                        <Chart
                            type="bar"
                            :data="recoveryChartData"
                            :options="recoveryChartOptions"
                        />
                    </template>
                </Card>
                <div class="flex pt-2 justify-content-start w-full">
                    <Button
                        label="다시계산"
                        severity="secondary"
                        icon="pi pi-arrow-left"
                        @click="activateCallback('1')"
                        size="small"
                    />
                </div>
            </StepPanel>
        </StepPanels>
    </Stepper>
</template>
