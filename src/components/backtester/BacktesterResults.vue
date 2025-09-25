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
        MarkPointComponent,
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
        MarkPointComponent,
    ]);

    const props = defineProps({ result: Object, isLoading: Boolean });

    const chartInstance = ref(null);

    const formatCurrency = (val) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(val || 0);
    const formatPercent = (val) => `${((val || 0) * 100).toFixed(2)}%`;

    const createChartOption = (title, seriesData, legendData) => {
        return {
            title: {
                text: title,
                left: 'center',
                textStyle: { color: '#ccc' },
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    let tooltipHtml = `${params[0].axisValueLabel}<br/>`;
                    const spyIndex = params.findIndex(
                        (p) => p.seriesName && p.seriesName.includes('SPY')
                    );

                    params.forEach((param, index) => {
                        if (spyIndex !== -1 && index === spyIndex) {
                            tooltipHtml += `<hr class="my-1 border-surface-700"/>`;
                        }
                        let marker = param.marker;
                        if (
                            param.seriesType === 'line' &&
                            !param.seriesName.includes('(주가)') &&
                            !param.seriesName.includes('(현금)')
                        ) {
                            marker = `<span style="display:inline-block;margin-right:5px;border-radius:2px;width:10px;height:4px;background-color:${param.color};vertical-align:middle;"></span>`;
                        }
                        tooltipHtml += `${marker} ${param.seriesName}: <strong>${formatCurrency(param.value[1])}</strong><br/>`;
                    });
                    return tooltipHtml;
                },
            },
            legend: {
                top: 'bottom',
                data: legendData,
                textStyle: { color: '#ccc' },
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '20%',
                containLabel: true,
            },
            xAxis: { type: 'time', axisLabel: { color: '#ccc' } },
            yAxis: {
                type: 'value',
                scale: true,
                axisLabel: { formatter: '${value}', color: '#ccc' },
            },
            dataZoom: [{ type: 'inside' }, { type: 'slider' }],
            series: seriesData,
        };
    };

    const chartTitle = computed(() => {
        if (!props.result) return 'Growth of Investment';
        const portfolioName = props.result.symbols.join(', ');
        const comparisonName =
            props.result.comparisonSymbol !== 'None'
                ? props.result.comparisonSymbol
                : null;
        return comparisonName
            ? `${portfolioName} vs ${comparisonName}`
            : portfolioName;
    });

    const combinedChartOption = computed(() => {
        if (!props.result) return {};
        const seriesData = [];
        const legendData = [];

        const portfolioDrip = props.result.withReinvest?.series.find(
            (s) => s.name === 'Portfolio'
        );
        const portfolioNoDrip_Stock = props.result.withoutReinvest?.series.find(
            (s) => s.name === 'Portfolio (주가)'
        );
        const portfolioNoDrip_Cash = props.result.withoutReinvest?.series.find(
            (s) => s.name === 'Portfolio (현금 배당)'
        );
        const comparisonDrip = props.result.withReinvest?.series.find(
            (s) => s.name !== 'Portfolio'
        );

        if (portfolioNoDrip_Stock) {
            legendData.push('Portfolio (주가)');
            seriesData.push({
                id: 'PortfolioNoDrip_Stock',
                name: 'Portfolio (주가)',
                type: 'line',
                smooth: true,
                stack: 'PortfolioNoDrip',
                areaStyle: {},
                symbol: 'none',
                lineStyle: { width: 0 },
                emphasis: { focus: 'series' },
                data: portfolioNoDrip_Stock.data,
            });
        }
        if (portfolioNoDrip_Cash) {
            legendData.push('Portfolio (현금)');
            seriesData.push({
                id: 'PortfolioNoDrip_Cash',
                name: 'Portfolio (현금)',
                type: 'line',
                smooth: true,
                stack: 'PortfolioNoDrip',
                areaStyle: {},
                symbol: 'none',
                lineStyle: { width: 0 },
                emphasis: { focus: 'series' },
                data: portfolioNoDrip_Cash.data,
            });
        }
        if (portfolioDrip) {
            legendData.push('Portfolio (DRIP)');
            seriesData.push({
                id: 'PortfolioDrip',
                name: 'Portfolio (DRIP)',
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 2.5 },
                emphasis: { focus: 'series' },
                data: portfolioDrip.data,
                z: 10,
                markPoint: {
                    symbol: 'circle',
                    symbolSize: 40,
                    itemStyle: { color: '#f59e0b' },
                    label: { fontSize: 14, fontWeight: 'bold', color: '#000' },
                    data: [
                        {
                            type: 'max',
                            name: '최고점',
                            label: { formatter: '高' },
                        },
                        {
                            type: 'min',
                            name: '최저점',
                            label: { formatter: '低' },
                        },
                    ],
                },
            });
        }
        if (comparisonDrip) {
            legendData.push(comparisonDrip.name);
            seriesData.push({
                id: 'ComparisonDrip',
                name: comparisonDrip.name,
                type: 'line',
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 2, opacity: 0.7 },
                itemStyle: { color: '#9ca3af' },
                emphasis: { focus: 'series' },
                data: comparisonDrip.data,
                z: 8,
                markPoint: {
                    symbol: 'circle',
                    symbolSize: 40,
                    itemStyle: { color: '#fef08a' },
                    label: { fontSize: 14, fontWeight: 'bold', color: '#000' },
                    data: [
                        {
                            type: 'max',
                            name: '최고점',
                            label: { formatter: '高' },
                        },
                        {
                            type: 'min',
                            name: '최저점',
                            label: { formatter: '低' },
                        },
                    ],
                },
            });
        }

        return createChartOption(chartTitle.value, seriesData, legendData);
    });

    const downloadChart = () => {
        if (!chartInstance.value) return;
        const chart = chartInstance.value.getChart();
        const dataUrl = chart.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#18181b',
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'backtest-result.png';
        link.click();
    };

    const resultTableData = computed(() => {
        if (!props.result) return [];
        const r = props.result;
        const rows = [
            {
                label: '초기 투자금',
                drip: r.initialInvestment,
                noDrip: r.initialInvestment,
                comp: r.initialInvestment,
            },
            {
                label: '최종 평가액',
                drip: r.withReinvest.summary.endingInvestment,
                noDrip: r.withoutReinvest.summary.endingInvestment,
                comp: r.comparisonResult?.withReinvest.endingInvestment,
            },
            {
                label: '누적 현금 배당금',
                drip: '-',
                noDrip: r.withoutReinvest.summary.dividendsCollected,
                comp: r.comparisonResult?.withoutReinvest.dividendsCollected,
            },
            {
                label: '총 수익률',
                drip: r.withReinvest.summary.totalReturn,
                noDrip: r.withoutReinvest.summary.totalReturn,
                comp: r.comparisonResult?.withReinvest.totalReturn,
            },
            {
                label: '연평균 수익률 (CAGR)',
                drip: r.withReinvest.summary.cagr,
                noDrip: r.withoutReinvest.summary.cagr,
                comp: r.comparisonResult?.withReinvest.cagr,
            },
            {
                label: '기간',
                drip: `${r.years.toFixed(2)} 년`,
                noDrip: `${r.years.toFixed(2)} 년`,
                comp: `${r.years.toFixed(2)} 년`,
            },
        ];
        return rows;
    });

    const individualResultsArray = computed(() => {
        if (!props.result || !props.result.individualResults) return [];
        return Object.entries(props.result.individualResults);
    });
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
            <div class="col-12">
                <div class="flex justify-content-end align-items-center mb-2">
                    <Button
                        icon="pi pi-download"
                        text
                        rounded
                        @click="downloadChart" />
                </div>
                <v-chart
                    ref="chartInstance"
                    :option="combinedChartOption"
                    autoresize
                    style="height: 500px" />
            </div>

            <div class="col-12">
                <DataTable :value="resultTableData" class="p-datatable-sm mt-4">
                    <Column field="label" header="항목" />
                    <Column header="배당 재투자 O (DRIP)" class="text-right">
                        <template #body="{ data }">
                            <span v-if="typeof data.drip === 'number'">{{
                                ['총 수익률', '연평균 수익률 (CAGR)'].includes(
                                    data.label
                                )
                                    ? formatPercent(data.drip)
                                    : formatCurrency(data.drip)
                            }}</span>
                            <span v-else>{{ data.drip }}</span>
                        </template>
                    </Column>
                    <Column header="배당 재투자 X" class="text-right">
                        <template #body="{ data }">
                            <span v-if="typeof data.noDrip === 'number'">{{
                                ['총 수익률', '연평균 수익률 (CAGR)'].includes(
                                    data.label
                                )
                                    ? formatPercent(data.noDrip)
                                    : formatCurrency(data.noDrip)
                            }}</span>
                            <span v-else>{{ data.noDrip }}</span>
                        </template>
                    </Column>
                    <Column
                        v-if="result.comparisonResult"
                        :header="result.comparisonSymbol"
                        class="text-right">
                        <template #body="{ data }">
                            <span
                                v-if="
                                    data.comp === undefined ||
                                    data.comp === null
                                "
                                >-</span
                            >
                            <span v-else-if="typeof data.comp === 'number'">{{
                                ['총 수익률', '연평균 수익률 (CAGR)'].includes(
                                    data.label
                                )
                                    ? formatPercent(data.comp)
                                    : formatCurrency(data.comp)
                            }}</span>
                            <span v-else>{{ data.comp }}</span>
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div v-if="individualResultsArray.length > 0" class="col-12 mt-4">
                <h4>종목별 초기 매수 수량</h4>
                <DataTable
                    :value="individualResultsArray"
                    class="p-datatable-sm">
                    <Column field="[0]" header="종목"></Column>
                    <Column field="[1].initialShares" header="초기 수량 (주)">
                        <template #body="slotProps">{{
                            (slotProps.data[1].initialShares || 0).toFixed(4)
                        }}</template>
                    </Column>
                </DataTable>
            </div>

            <div
                v-if="result.cashDividends && result.cashDividends.length > 0"
                class="col-12 mt-4">
                <h4>배당금 수령 내역 (재투자 X 기준)</h4>
                <DataTable
                    :value="result.cashDividends"
                    paginator
                    :rows="5"
                    class="p-datatable-sm"
                    sortField="date"
                    :sortOrder="-1">
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
