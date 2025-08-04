<script setup>
import { ref, computed } from 'vue';
import Card from "primevue/card";
import Stepper from 'primevue/stepper';
import StepItem from 'primevue/stepitem';
import Step from 'primevue/step';
import StepPanel from 'primevue/steppanel';
import Chart from 'primevue/chart';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import InputGroup from 'primevue/inputgroup';
import InputGroupAddon from 'primevue/inputgroupaddon';
import InputNumber from 'primevue/inputnumber';
import SelectButton from 'primevue/selectbutton';
import Divider from 'primevue/divider';
import Tag from 'primevue/tag';
import { parseYYMMDD } from '@/utils/date.js';
import { useBreakpoint } from "@/composables/useBreakpoint";
import { useRecoveryChart } from "@/composables/charts/useRecoveryChart.js";

const { deviceType } = useBreakpoint();
const props = defineProps({ dividendHistory: Array, tickerInfo: Object });

const formatMonthsToYears = (totalMonths) => {
    if (totalMonths === Infinity || isNaN(totalMonths) || totalMonths <= 0) return '계산 불가';
    const years = Math.floor(totalMonths / 12);
    const months = Math.round(totalMonths % 12);
    if (years > 0) return `${years}년 ${months}개월`;
    return `${months}개월`;
};

const periodOptions = ref([ { label: '前 3M', value: '3M' }, { label: '前 6M', value: '6M' }, { label: '前 1Y', value: '1Y' } ]);
const currentPrice = computed(() => {
    if (!props.dividendHistory || props.dividendHistory.length === 0) return 0;
    const latestRecordWithPrice = props.dividendHistory.find(record => record['당일종가'] && record['당일종가'] !== 'N/A');
    if (!latestRecordWithPrice) return 0;
    return parseFloat(latestRecordWithPrice['당일종가'].replace('$', '')) || 0;
});
const payoutsPerYear = computed(() => {
    if (!props.dividendHistory || props.dividendHistory.length === 0) return 0;
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const pastYearHistory = props.dividendHistory.filter(item => parseYYMMDD(item['배당락']) >= oneYearAgo);
    if (pastYearHistory.length > 0) return pastYearHistory.length;
    const freq = props.tickerInfo?.frequency;
    return freq === '매주' ? 52 : (freq === '분기' ? 4 : 12);
});

// --- 1. 원금 회수 계산기 ---
const investmentAmount = ref(1000);
const recoveryPeriod = ref('1Y');
const priceScenario = ref('current');
const applyTax = ref(true);
const priceScenarioOptions = ref([ { label: '-5%', value: 'minus_5' }, { label: '-3%', value: 'minus_3' }, { label: '현재가', value: 'current' }, { label: '+3%', value: 'plus_3' }, { label: '+5%', value: 'plus_5' } ]);
const taxOptions = ref([ { icon: 'pi pi-shield', value: false, tooltip: '세전' }, { icon: 'pi pi-building-columns', value: true, tooltip: '세후 (15%)' } ]);

const calculatedPrice = computed(() => {
    switch(priceScenario.value) {
        case 'minus_5': return currentPrice.value * 0.95;
        case 'minus_3': return currentPrice.value * 0.97;
        case 'plus_3': return currentPrice.value * 1.03;
        case 'plus_5': return currentPrice.value * 1.05;
        default: return currentPrice.value;
    }
});
const sharesToBuy = computed(() => {
    if (!investmentAmount.value || calculatedPrice.value <= 0) return 0;
    return investmentAmount.value / calculatedPrice.value;
});
const dividendStats = computed(() => {
    const filtered = props.dividendHistory.filter(item => {
        const now = new Date(); let cutoffDate = new Date();
        const rangeValue = parseInt(recoveryPeriod.value); const rangeUnit = recoveryPeriod.value.slice(-1);
        if (rangeUnit === 'M') cutoffDate.setMonth(now.getMonth() - rangeValue); else cutoffDate.setFullYear(now.getFullYear() - rangeValue);
        return parseYYMMDD(item['배당락']) >= cutoffDate;
    });
    const validAmounts = filtered.map(h => parseFloat(h['배당금']?.replace('$', ''))).filter(a => a && a > 0);
    if (validAmounts.length === 0) return { min: 0, max: 0, avg: 0 };
    return { min: Math.min(...validAmounts), max: Math.max(...validAmounts), avg: validAmounts.reduce((s, a) => s + a, 0) / validAmounts.length };
});

const documentStyle = getComputedStyle(document.documentElement);
const chartTheme = {
    textColor: documentStyle.getPropertyValue('--p-text-color'),
    textColorSecondary: documentStyle.getPropertyValue('--p-text-muted-color'),
    surfaceBorder: documentStyle.getPropertyValue('--p-content-border-color'),
};
const { recoveryTimes, recoveryChartData, recoveryChartOptions } = useRecoveryChart({ investmentAmount, sharesToBuy, dividendStats, payoutsPerYear, applyTax, theme: chartTheme });

// --- 2. 재투자 목표 계산기 --- (로직은 동일)
</script>

<template>
    <Card id="t-calculator">
        <template #content>
            <Tabs value="0" class="p-tabs-calculator">
                <TabList id="t-calculator-tabs">
                    <Tab value="0"><i class="pi pi-replay mr-2"></i> <span>원금 회수 기간</span></Tab>
                    <Tab value="1"><i class="pi pi-chart-line mr-2"></i> <span>목표 달성 기간</span></Tab>
                </TabList>
                <TabPanels>
                    <TabPanel value="0">
                        <div class="card" id="t-calculator-step" v-if="deviceType === 'mobile'">
                            <Stepper value="1">
                                <StepItem value="1">
                                    <Step>
                                        <span>초기 투자금</span>
                                        <Tag severity="contrast" :value="`$${investmentAmount.toFixed(2)}`"></Tag>
                                    </Step>
                                    <StepPanel>
                                        <InputGroup><InputGroupAddon>$</InputGroupAddon><InputNumber v-model="investmentAmount" inputId="investment" mode="currency" currency="USD" locale="en-US" /></InputGroup>
                                    </StepPanel>
                                </StepItem>
                                <StepItem value="2">
                                    <Step>
                                        <span>배당소득세 15%</span>
                                        <Tag severity="contrast">{{ applyTax ? '세후' : '세전' }}</Tag>
                                    </Step>
                                    <StepPanel>
                                        <SelectButton v-model="applyTax" :options="taxOptions" optionValue="value" size="small" dataKey="value" aria-labelledby="tax-options">
                                            <template #option="slotProps"><i :class="slotProps.option.icon" v-tooltip.bottom="slotProps.option.tooltip"></i><span>{{ slotProps.option.tooltip }}</span></template>
                                        </SelectButton>
                                    </StepPanel>
                                </StepItem>
                                <StepItem value="3">
                                    <Step>
                                        <span>참고 주식 가격</span>
                                        <span><Tag severity="contrast">${{calculatedPrice.toFixed(2)}} / {{sharesToBuy.toFixed(2)}} 주</Tag></span>
                                    </Step>
                                    <StepPanel><SelectButton v-model="priceScenario" :options="priceScenarioOptions" optionLabel="label" optionValue="value" size="small" /></StepPanel>
                                </StepItem>
                                <StepItem value="4">
                                    <Step><span>지나간 배당금 참고</span><Tag severity="contrast">{{ recoveryPeriod }}</Tag></Step>
                                    <StepPanel><SelectButton v-model="recoveryPeriod" :options="periodOptions" optionLabel="label" optionValue="value" size="small" /></StepPanel>
                                </StepItem>
                            </Stepper>
                            <Divider />
                            <Card id="t-calculator-step-result">
                                <template #title>
                                    <table class="w-full text-center">
                                        <thead><tr><th>희망</th><th>평균</th><th>절망</th></tr></thead>
                                        <tbody><tr>
                                            <td><Tag severity="success">{{ formatMonthsToYears(recoveryTimes.hope) }}</Tag></td>
                                            <td><Tag severity="warning">{{ formatMonthsToYears(recoveryTimes.avg) }}</Tag></td>
                                            <td><Tag severity="danger">{{ formatMonthsToYears(recoveryTimes.despair) }}</Tag></td>
                                        </tr></tbody>
                                    </table>
                                </template>
                                <template #content>
                                     <div class="chart-container-mobile"><Chart type="bar" :data="recoveryChartData" :options="recoveryChartOptions" /></div>
                                </template>
                            </Card>
                        </div>
                        <div v-else class="calculator-panel" id="t-calculator-return">
                            <!-- 데스크탑 UI -->
                        </div>
                    </TabPanel>
                    <TabPanel value="1">
                        <!-- 재투자 탭 UI -->
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </template>
    </Card>
</template>

