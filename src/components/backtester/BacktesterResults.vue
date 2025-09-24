<!-- src\components\backtester\BacktesterResults.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import { use } from 'echarts/core';
    import { CanvasRenderer } from 'echarts/renderers';
    import { LineChart } from 'echarts/charts';
    import {
        TitleComponent,
        TooltipComponent,
        LegendComponent,
        GridComponent,
        DataZoomComponent,
    } from 'echarts/components';
    import VChart from 'vue-echarts';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Button from 'primevue/button';

    use([
        CanvasRenderer,
        LineChart,
        TitleComponent,
        TooltipComponent,
        LegendComponent,
        GridComponent,
        DataZoomComponent,
    ]);

    const props = defineProps({ result: Object, isLoading: Boolean });

    const chartInstanceReinvest = ref(null);
    const chartInstanceNoReinvest = ref(null);

    const formatCurrency = (val) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(val || 0);
    const formatPercent = (val) => `${((val || 0) * 100).toFixed(2)}%`;

    const createChartOption = (title, seriesData) => {
        return {
            title: { text: title, left: 'center' },
            tooltip: {
                trigger: 'axis',
                valueFormatter: (value) => formatCurrency(value),
            },
            legend: { top: 'bottom' },
            grid: {
                left: '10%',
                right: '10%',
                bottom: '15%',
                containLabel: true,
            },
            xAxis: { type: 'time' },
            yAxis: {
                type: 'value',
                scale: true,
                axisLabel: { formatter: '${value}' },
            },
            dataZoom: [{ type: 'inside' }, { type: 'slider' }],
            series: seriesData.map((s) => ({
                name: s.name,
                type: 'line',
                showSymbol: false,
                data: s.data,
                smooth: true,
            })),
        };
    };

    const chartOptionWithReinvest = computed(() =>
        createChartOption(
            'Growth of Investment - With Dividends Reinvested',
            props.result?.withReinvest.series || []
        )
    );
    const chartOptionWithoutReinvest = computed(() =>
        createChartOption(
            'Growth of Investment - Without Dividends Reinvested',
            props.result?.withoutReinvest.series || []
        )
    );

    const downloadChart = (chartRef, filename) => {
        if (!chartRef) return;
        const dataUrl = chartRef.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#FFFFFF',
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
    };
</script>

<template>
    <div
        v-if="isLoading"
        class="flex justify-content-center align-items-center"
        style="height: 400px">
        <i class="pi pi-spin pi-spinner" style="font-size: 3rem"></i>
    </div>
    <div
        v-else-if="result && !result.error"
        class="mt-4 surface-card p-4 border-round">
        <div class="grid">
            <div class="col-12 md:col-6">
                <div
                    class="flex justify-content-between align-items-center mb-2">
                    <h3 class="m-0">배당 재투자 O (DRIP)</h3>
                    <Button
                        icon="pi pi-download"
                        text
                        rounded
                        @click="
                            downloadChart(
                                chartInstanceReinvest,
                                'DRIP_Chart.png'
                            )
                        " />
                </div>
                <v-chart
                    ref="chartInstanceReinvest"
                    :option="chartOptionWithReinvest"
                    autoresize
                    style="height: 400px" />
                <ul class="list-none p-0 m-0 mt-4">
                    <li>
                        <strong>초기 투자금:</strong>
                        {{ formatCurrency(result.initialInvestment) }}
                    </li>
                    <li>
                        <strong>최종 평가액:</strong>
                        {{
                            formatCurrency(
                                result.withReinvest.summary.endingInvestment
                            )
                        }}
                    </li>
                    <li>
                        <strong>총 수익률:</strong>
                        {{
                            formatPercent(
                                result.withReinvest.summary.totalReturn
                            )
                        }}
                    </li>
                    <li>
                        <strong>연평균 수익률 (CAGR):</strong>
                        {{ formatPercent(result.withReinvest.summary.cagr) }}
                    </li>
                    <li>
                        <strong>기간:</strong> {{ result.years.toFixed(2) }} 년
                    </li>
                </ul>
            </div>
            <div class="col-12 md:col-6">
                <div
                    class="flex justify-content-between align-items-center mb-2">
                    <h3 class="m-0">배당 재투자 X</h3>
                    <Button
                        icon="pi pi-download"
                        text
                        rounded
                        @click="
                            downloadChart(
                                chartInstanceNoReinvest,
                                'No_DRIP_Chart.png'
                            )
                        " />
                </div>
                <v-chart
                    ref="chartInstanceNoReinvest"
                    :option="chartOptionWithoutReinvest"
                    autoresize
                    style="height: 400px" />
                <ul class="list-none p-0 m-0 mt-4">
                    <li>
                        <strong>초기 투자금:</strong>
                        {{ formatCurrency(result.initialInvestment) }}
                    </li>
                    <li>
                        <strong>최종 평가액:</strong>
                        {{
                            formatCurrency(
                                result.withoutReinvest.summary.endingInvestment
                            )
                        }}
                    </li>
                    <li>
                        <strong>누적 현금 배당금:</strong>
                        {{
                            formatCurrency(
                                result.withoutReinvest.summary
                                    .dividendsCollected
                            )
                        }}
                    </li>
                    <li>
                        <strong>총 수익률:</strong>
                        {{
                            formatPercent(
                                result.withoutReinvest.summary.totalReturn
                            )
                        }}
                    </li>
                    <li>
                        <strong>연평균 수익률 (CAGR):</strong>
                        {{ formatPercent(result.withoutReinvest.summary.cagr) }}
                    </li>
                    <li>
                        <strong>기간:</strong> {{ result.years.toFixed(2) }} 년
                    </li>
                </ul>
            </div>
            <div
                v-if="result.cashDividends && result.cashDividends.length > 0"
                class="col-12 mt-4">
                <h4>배당금 수령 내역 (재투자 X 기준)</h4>
                <DataTable
                    :value="result.cashDividends"
                    paginator
                    :rows="5"
                    class="p-datatable-sm">
                    <Column field="date" header="지급일" sortable></Column>
                    <Column field="ticker" header="종목" sortable></Column>
                    <Column field="amount" header="세후 배당금 (USD)" sortable>
                        <template #body="slotProps">{{
                            formatCurrency(slotProps.data.amount)
                        }}</template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
    <div v-else-if="result && result.error" class="mt-4 text-center">
        <p class="text-red-500">{{ result.error }}</p>
    </div>
    <div v-else class="mt-4 text-center text-surface-500">
        <p>종목과 기간을 설정하고 백테스팅을 실행해주세요.</p>
    </div>
</template>
