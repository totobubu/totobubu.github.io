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
                <BacktesterSummaryTable :result="result" />
            </div>
            <div class="col-12">
                <BacktesterResultDetails :result="result" />
            </div>
        </div>
    </div>
    <div v-else-if="result && result.error" class="mt-4 text-center">
        <p class="text-red-500">{{ result.error }}</p>
    </div>
    <div v-else></div>
</template>

<script>
    import { defineComponent, ref, computed } from 'vue';
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
    import BacktesterSummaryTable from './BacktesterSummaryTable.vue';
    import BacktesterResultDetails from './BacktesterResultDetails.vue';

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

    export default defineComponent({
        name: 'BacktesterResults',
        components: {
            VChart,
            DataTable,
            Column,
            Button,
            BacktesterSummaryTable,
            BacktesterResultDetails,
        },
        props: {
            result: Object,
            isLoading: Boolean,
        },
        setup(props) {
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
                            const compSymbol = props.result?.comparisonSymbol;
                            const compIndex = params.findIndex(
                                (p) =>
                                    p.seriesName &&
                                    compSymbol &&
                                    p.seriesName.includes(compSymbol)
                            );

                            params.forEach((param, index) => {
                                if (compIndex !== -1 && index === compIndex) {
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
                const portfolioNoDrip_Stock =
                    props.result.withoutReinvest?.series.find(
                        (s) => s.name === 'Portfolio (주가)'
                    );
                const portfolioNoDrip_Cash =
                    props.result.withoutReinvest?.series.find(
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
                            label: {
                                fontSize: 14,
                                fontWeight: 'bold',
                                color: '#000',
                            },
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
                            label: {
                                fontSize: 14,
                                fontWeight: 'bold',
                                color: '#000',
                            },
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
                return createChartOption(
                    chartTitle.value,
                    seriesData,
                    legendData
                );
            });

            const downloadChart = () => {
                if (
                    chartInstance.value &&
                    typeof chartInstance.value.getDataURL === 'function'
                ) {
                    const dataUrl = chartInstance.value.getDataURL({
                        type: 'png',
                        pixelRatio: 2,
                        backgroundColor: '#18181b',
                    });
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = 'backtest-result.png';
                    link.click();
                } else {
                    console.error('ECharts instance is not ready.');
                }
            };

            return {
                chartInstance,
                combinedChartOption,
                downloadChart,
            };
        },
    });
</script>
