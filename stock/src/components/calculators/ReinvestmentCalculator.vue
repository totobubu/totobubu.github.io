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
    import InputText from 'primevue/inputtext';
    import Slider from 'primevue/slider';
    import SelectButton from 'primevue/selectbutton';
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import Card from 'primevue/card';
    import { parseYYMMDD } from '@/utils/date.js';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useReinvestmentChart } from '@/composables/charts/useReinvestmentChart.js';
    import { formatLargeNumber } from '@/utils/numberFormat.js';

    const { deviceType } = useBreakpoint();
    const props = defineProps({ dividendHistory: Array, tickerInfo: Object });

    const formatMonthsToYears = (totalMonths) => {
        if (totalMonths === Infinity || isNaN(totalMonths) || totalMonths <= 0)
            return '계산 불가';
        const years = Math.floor(totalMonths / 12);
        const months = Math.round(totalMonths % 12);
        return years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
    };

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

    const ownedShares = ref(100);
    const targetAmount = ref(100000);
    const reinvestmentPeriod = ref('1Y');
    const dividendStatistic = ref('avg');
    const annualGrowthRateScenario = ref(0);
    const applyTax = ref(true); // [핵심] 세금 상태 추가

    const dividendStatisticOptions = ref([
        { icon: 'pi pi-arrow-down-left', label: '절망', value: 'min' },
        { icon: 'pi pi-equals', label: '평균', value: 'avg' },
        { icon: 'pi pi-arrow-up-right', label: '희망', value: 'max' },
    ]);
    const growthRateForCalculation = computed(
        () => annualGrowthRateScenario.value / 100
    );
    const currentAssets = computed(
        () => (ownedShares.value || 0) * currentPrice.value
    );

    const reinvestDividendStats = computed(() => {
        const filtered = props.dividendHistory.filter((item) => {
            const now = new Date();
            let cutoffDate = new Date();
            const rangeValue = parseInt(reinvestmentPeriod.value);
            const rangeUnit = reinvestmentPeriod.value.slice(-1);
            if (rangeUnit === 'M')
                cutoffDate.setMonth(now.getMonth() - rangeValue);
            else cutoffDate.setFullYear(now.getFullYear() - rangeValue);
            return parseYYMMDD(item['배당락']) >= cutoffDate;
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

    const goalAchievementTimes = computed(() => {
        const calculateMonths = (dividendPerShare) => {
            if (
                currentAssets.value <= 0 ||
                targetAmount.value <= currentAssets.value ||
                dividendPerShare <= 0 ||
                currentPrice.value <= 0 ||
                payoutsPerYear.value <= 0
            )
                return 0;

            const finalDividendPerShare = applyTax.value
                ? dividendPerShare * 0.85
                : dividendPerShare;
            if (finalDividendPerShare <= 0) return Infinity;

            let assetValue = currentAssets.value;
            let months = 0;
            const monthlyGrowthRate =
                (1 + growthRateForCalculation.value) ** (1 / 12) - 1;

            while (assetValue < targetAmount.value) {
                if (months > 1200) {
                    months = Infinity;
                    break;
                }
                assetValue *= 1 + monthlyGrowthRate;
                const currentShares = assetValue / currentPrice.value;
                const dividendReceived =
                    currentShares *
                    finalDividendPerShare *
                    (payoutsPerYear.value / 12);
                assetValue += dividendReceived;
                months++;
            }
            return months;
        };
        return {
            hope: calculateMonths(reinvestDividendStats.value.max),
            avg: calculateMonths(reinvestDividendStats.value.avg),
            despair: calculateMonths(reinvestDividendStats.value.min),
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
    const { reinvestmentChartData, reinvestmentChartOptions } =
        useReinvestmentChart({
            currentAssets,
            targetAmount,
            payoutsPerYear,
            dividendStats: reinvestDividendStats,
            annualGrowthRateScenario: growthRateForCalculation,
            currentPrice,
            goalAchievementTimes,
            theme: chartTheme,
        });
</script>

<template>
    <div
        class="flex"
        :class="
            deviceType === 'desktop'
                ? 'flex-row justify-content-between'
                : 'flex-column  gap-2'
        "
    >
        <div class="flex flex-column gap-2">
            <InputGroup
                :class="deviceType === 'mobile' ? 'flex-column gap-2' : ''"
            >
                <IftaLabel>
                    <InputNumber
                        :modelValue="currentAssets"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                        disabled
                        inputId="currentAssets"
                    />
                    <label for="currentAssets">현재 자산</label>
                </IftaLabel>
                <IftaLabel>
                    <InputNumber
                        v-model="ownedShares"
                        inputId="shares"
                        suffix=" 주"
                        min="1"
                    />
                    <label for="shares">보유 수량</label>
                </IftaLabel>
                <IftaLabel>
                    <InputNumber
                        v-model="targetAmount"
                        inputId="target"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                    />
                    <label for="target">목표 자산</label>
                </IftaLabel>
            </InputGroup>
            <InputGroup>
                <InputGroupAddon style="font-size: var(--p-iftalabel-font-size)"
                    >주가 성장률</InputGroupAddon
                >
                <div class="p-inputtext toto-range">
                    <span>
                        <Slider
                            v-model="annualGrowthRateScenario"
                            :min="-15"
                            :max="15"
                            :step="1"
                            class="flex-1"
                        />
                    </span>
                </div>
                <InputGroupAddon class="text-xs"
                    ><span>
                        {{ annualGrowthRateScenario }} %
                    </span></InputGroupAddon
                >
            </InputGroup>
            <Card class="toto-reference-period">
                <template #header>
                    <label class="text-sm"
                        ><span>前 배당금 참고 기간</span>
                        <Tag severity="contrast">{{
                            reinvestmentPeriod
                        }}</Tag></label
                    ></template
                >
                <template #content
                    ><SelectButton
                        v-model="reinvestmentPeriod"
                        :options="periodOptions"
                        optionLabel="label"
                        optionValue="value"
                        size="small"
                /></template>
            </Card>
            <Card class="toto-tax-apply">
                <template #header>
                    <label class="text-sm"
                        ><span>세금 적용</span>
                        <Tag severity="contrast">{{
                            applyTax ? '세후' : '세전'
                        }}</Tag></label
                    ></template
                >
                <template #content
                    ><SelectButton
                        v-model="applyTax"
                        :options="taxOptions"
                        optionValue="value"
                        size="small"
                        dataKey="value"
                        class="w-full"
                        ><template #option="slotProps"
                            ><i
                                :class="slotProps.option.icon"
                                v-tooltip.bottom="slotProps.option.tooltip"
                            ></i
                            ><span>{{
                                slotProps.option.tooltip.split(' ')[0]
                            }}</span></template
                        ></SelectButton
                    ></template
                >
            </Card>
        </div>
        <Card class="toto-calculator-result">
            <template #title>
                <table class="w-full text-center">
                    <colgroup>
                        <col style="width: 3rem" />
                        <col />
                        <col />
                        <col />
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
                            <td>
                                (${{ reinvestDividendStats.max.toFixed(4) }})
                            </td>
                            <td>
                                (${{ reinvestDividendStats.avg.toFixed(4) }})
                            </td>
                            <td>
                                (${{ reinvestDividendStats.min.toFixed(4) }})
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
            <template #content>
                <Chart
                    v-if="reinvestmentChartData"
                    type="line"
                    :data="reinvestmentChartData"
                    :options="reinvestmentChartOptions"
                />
            </template>
        </Card>
    </div>
</template>
