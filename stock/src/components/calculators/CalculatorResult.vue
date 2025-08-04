<script setup>
import Card from "primevue/card";
import Chart from 'primevue/chart';
import Tag from 'primevue/tag';

defineProps({
    formatMonthsToYears: Function,
    dividendStats: Object,
    recoveryTimes: Object,
    recoveryChartData: Object,
    recoveryChartOptions: Object,
    containerClass: String
});
</script>

<template>
    <Card id="t-calculator-result">
        <template #title>
            <table class="w-full text-center text-sm">
                <thead>
                    <tr><th>희망</th><th>평균</th><th>절망</th></tr>
                </thead>
                <tbody>
                    <tr class="text-xs text-surface-500">
                        <td>(${{ dividendStats.max.toFixed(4) }})</td>
                        <td>(${{ dividendStats.avg.toFixed(4) }})</td>
                        <td>(${{ dividendStats.min.toFixed(4) }})</td>
                    </tr>
                    <tr>
                        <td><Tag severity="success">{{ formatMonthsToYears(recoveryTimes.hope) }}</Tag></td>
                        <td><Tag severity="warning">{{ formatMonthsToYears(recoveryTimes.avg) }}</Tag></td>
                        <td><Tag severity="danger">{{ formatMonthsToYears(recoveryTimes.despair) }}</Tag></td>
                    </tr>
                </tbody>
            </table>
        </template>
        <template #content>
            <div :class="containerClass">
                <Chart type="bar" :data="recoveryChartData" :options="recoveryChartOptions" />
            </div>
        </template>
    </Card>
</template>