<!-- src\components\backtester\BacktesterResults.vue -->
<template>
    <div
        v-if="isLoading"
        class="flex justify-content-center align-items-center"
        style="height: 400px">
        <i class="pi pi-spin pi-spinner" style="font-size: 3rem"></i>
    </div>
    <div v-else-if="result && !result.error" class="mt-4">
        <div class="surface-card border-round">
            <div class="grid">
                <div class="col-12">
                    <div
                        class="flex justify-content-end align-items-center mb-2">
                        <Button
                            icon="pi pi-download"
                            text
                            rounded
                            @click="downloadResultsAsImage" />
                    </div>
                    <v-chart
                        ref="chartInstance"
                        :option="combinedChartOption"
                        autoresize
                        style="height: 500px" />
                </div>
                <div class="col-12">
                    <BacktesterSummaryTable
                        ref="summaryTableInstance"
                        :result="result" />
                </div>
                <div class="col-12">
                    <BacktesterResultDetails :result="result" />
                </div>
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
    import { use, init } from 'echarts/core';
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
    import Button from 'primevue/button';
    import BacktesterSummaryTable from './BacktesterSummaryTable.vue';
    import BacktesterResultDetails from './BacktesterResultDetails.vue';
    import { getBacktesterChartPalette } from '@/utils/chartColors.js';
    import html2canvas from 'html2canvas';

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
            const summaryTableInstance = ref(null);

            const formatCurrency = (val) =>
                new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                }).format(val || 0);

            const createChartOption = (
                title,
                seriesData,
                legendData,
                palette
            ) => {
                return {
                    backgroundColor: palette.background,
                    title: {
                        text: title,
                        left: 'center',
                        textStyle: { color: palette.textColor, fontSize: 16 },
                    },
                    tooltip: {
                        trigger: 'axis',
                        formatter: (params) => {
                            if (!params || params.length === 0) return '';
                            let tooltipHtml = `${params[0].axisValueLabel}<br/>`;
                            params.forEach((param) => {
                                let marker = `<span style="display:inline-block;margin-right:5px;border-radius:2px;width:10px;height:4px;background-color:${param.color};vertical-align:middle;"></span>`;
                                tooltipHtml += `${marker} ${param.seriesName}: <strong>${formatCurrency(param.value[1])}</strong><br/>`;
                            });
                            return tooltipHtml;
                        },
                    },
                    legend: {
                        top: 30,
                        left: 'center',
                        data: legendData,
                        textStyle: { color: palette.textColorSecondary },
                    },
                    grid: {
                        top: 80,
                        left: '3%',
                        right: '4%',
                        bottom: '15%',
                        containLabel: true,
                    },
                    xAxis: {
                        type: 'time',
                        axisLabel: { color: palette.textColorSecondary },
                        splitLine: {
                            show: true,
                            lineStyle: {
                                color: palette.gridColor,
                                type: 'dashed',
                            },
                        },
                    },
                    yAxis: {
                        type: 'value',
                        scale: true,
                        axisLabel: {
                            formatter: '${value}',
                            color: palette.textColorSecondary,
                        },
                        splitLine: {
                            show: true,
                            lineStyle: {
                                color: palette.gridColor,
                                type: 'dashed',
                            },
                        },
                    },
                    dataZoom: [{ type: 'inside' }, { type: 'slider' }],
                    series: seriesData,
                };
            };

            const chartTitle = computed(() => {
                if (!props.result) return 'DivGrow.com/Backtester';
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

                const themeMode = document.documentElement.classList.contains(
                    'p-dark'
                )
                    ? 'dark'
                    : 'light';
                const palette = getBacktesterChartPalette(themeMode);

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
                        name: 'Portfolio (주가)',
                        type: 'line',
                        smooth: true,
                        stack: 'PortfolioNoDrip',
                        areaStyle: { color: palette.portfolioStock },
                        symbol: 'none',
                        lineStyle: { width: 0 },
                        emphasis: { focus: 'series' },
                        data: portfolioNoDrip_Stock.data,
                    });
                }
                if (portfolioNoDrip_Cash) {
                    legendData.push('Portfolio (현금)');
                    seriesData.push({
                        name: 'Portfolio (현금)',
                        type: 'line',
                        smooth: true,
                        stack: 'PortfolioNoDrip',
                        areaStyle: { color: palette.portfolioCash },
                        symbol: 'none',
                        lineStyle: { width: 0 },
                        emphasis: { focus: 'series' },
                        data: portfolioNoDrip_Cash.data,
                    });
                }
                if (portfolioDrip) {
                    legendData.push('Portfolio (DRIP)');
                    seriesData.push({
                        name: 'Portfolio (DRIP)',
                        type: 'line',
                        smooth: true,
                        symbol: 'none',
                        lineStyle: {
                            width: 2.5,
                            color: palette.portfolioDripLine,
                        },
                        emphasis: { focus: 'series' },
                        data: portfolioDrip.data,
                        z: 10,
                        markPoint: {
                            ...palette.markPoint,
                            data: [
                                {
                                    type: 'max',
                                    name: '최고점',
                                    label: { formatter: 'H' },
                                },
                                {
                                    type: 'min',
                                    name: '최저점',
                                    label: { formatter: 'L' },
                                },
                            ],
                        },
                    });
                }
                if (comparisonDrip) {
                    legendData.push(comparisonDrip.name);
                    seriesData.push({
                        name: comparisonDrip.name,
                        type: 'line',
                        smooth: true,
                        symbol: 'none',
                        lineStyle: { width: 2, opacity: 0.8 },
                        itemStyle: { color: palette.comparisonLine },
                        emphasis: { focus: 'series' },
                        data: comparisonDrip.data,
                        z: 8,
                        markPoint: {
                            ...palette.markPoint,
                            itemStyle: {
                                color: palette.comparisonLine,
                                opacity: 0.8,
                            },
                            data: [
                                {
                                    type: 'max',
                                    name: '최고점',
                                    label: { formatter: 'H' },
                                },
                                {
                                    type: 'min',
                                    name: '최저점',
                                    label: { formatter: 'L' },
                                },
                            ],
                        },
                    });
                }
                return createChartOption(
                    chartTitle.value,
                    seriesData,
                    legendData,
                    palette
                );
            });

            const downloadResultsAsImage = async () => {
                if (!props.result) return;

                const lightPalette = getBacktesterChartPalette('light');
                const IMAGE_WIDTH = 600;

                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.top = '-9999px';
                container.style.left = '0px';
                container.style.width = `${IMAGE_WIDTH}px`;
                container.style.padding = '0.5rem';
                container.style.backgroundColor = lightPalette.background;
                container.style.fontFamily =
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

                // --- [핵심 수정 1] 제목(h2)을 먼저 생성하여 컨테이너에 추가 ---
                const titleElement = document.createElement('h2');
                titleElement.innerText = chartTitle.value; // computed의 최신 값을 직접 사용
                titleElement.style.textAlign = 'center';
                titleElement.style.color = lightPalette.textColor;
                titleElement.style.fontSize = '18px';
                titleElement.style.fontWeight = 'bold';
                titleElement.style.marginBottom = '1rem'; // 차트와의 간격
                container.appendChild(titleElement);

                const chartDiv = document.createElement('div');
                const chartHeight = IMAGE_WIDTH * (3 / 3.5);
                chartDiv.style.width = '100%';
                chartDiv.style.height = `${chartHeight}px`;
                container.appendChild(chartDiv);

                const lightChartOptions = JSON.parse(
                    JSON.stringify(combinedChartOption.value)
                );
                lightChartOptions.title.text = ''; // [핵심 수정 2] ECharts 자체 제목은 제거
                lightChartOptions.animation = false;
                lightChartOptions.backgroundColor = lightPalette.background;
                lightChartOptions.legend.textStyle.color =
                    lightPalette.textColorSecondary;
                lightChartOptions.xAxis.axisLabel.color =
                    lightPalette.textColorSecondary;
                lightChartOptions.yAxis.axisLabel.color =
                    lightPalette.textColorSecondary;
                lightChartOptions.xAxis.splitLine.lineStyle.color =
                    lightPalette.gridColor;
                lightChartOptions.yAxis.splitLine.lineStyle.color =
                    lightPalette.gridColor;
                lightChartOptions.dataZoom = [];

                const tableHtml = createTableHtml(props.result);
                container.insertAdjacentHTML('beforeend', tableHtml);

                document.body.appendChild(container);

                let tempChart;
                try {
                    tempChart = init(chartDiv);
                    tempChart.setOption(lightChartOptions);

                    await new Promise((resolve) => setTimeout(resolve, 500));

                    const canvas = await html2canvas(container, {
                        useCORS: true,
                        scale: 2,
                    });

                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = 'backtest-result.png';
                    link.click();
                } catch (error) {
                    console.error('Failed to download results:', error);
                } finally {
                    if (tempChart) tempChart.dispose();
                    document.body.removeChild(container);
                }
            };

            const createTableHtml = (result) => {
                const r = result;
                const comp = r.comparisonResult;
                const formatPercent = (val) =>
                    `${((val || 0) * 100).toFixed(2)}%`;

                const rows = [
                    {
                        label: '초기 투자금',
                        drip: formatCurrency(r.initialInvestment),
                        noDrip: formatCurrency(r.initialInvestment),
                        comp: comp
                            ? formatCurrency(r.initialInvestment)
                            : undefined,
                    },
                    {
                        label: '최종 평가액',
                        drip: formatCurrency(
                            r.withReinvest.summary.endingInvestment
                        ),
                        noDrip: formatCurrency(
                            r.withoutReinvest.summary.endingInvestment
                        ),
                        comp: comp
                            ? formatCurrency(comp.withReinvest.endingInvestment)
                            : undefined,
                    },
                    {
                        label: '누적 현금 배당금',
                        drip: '-',
                        noDrip: formatCurrency(
                            r.withoutReinvest.summary.dividendsCollected
                        ),
                        comp: comp
                            ? formatCurrency(
                                  comp.withoutReinvest.dividendsCollected
                              )
                            : undefined,
                    },
                    {
                        label: '총 수익률',
                        drip: formatPercent(r.withReinvest.summary.totalReturn),
                        noDrip: formatPercent(
                            r.withoutReinvest.summary.totalReturn
                        ),
                        comp: comp
                            ? formatPercent(comp.withReinvest.totalReturn)
                            : undefined,
                    },
                    {
                        label: '연평균 수익률 (CAGR)',
                        drip: formatPercent(r.withReinvest.summary.cagr),
                        noDrip: formatPercent(r.withoutReinvest.summary.cagr),
                        comp: comp
                            ? formatPercent(comp.withReinvest.cagr)
                            : undefined,
                    },
                    {
                        label: '기간',
                        drip: `${(r.years || 0).toFixed(2)} 년`,
                        noDrip: `${(r.years || 0).toFixed(2)} 년`,
                        comp: comp
                            ? `${(r.years || 0).toFixed(2)} 년`
                            : undefined,
                    },
                ];

                const header = `
                    <th style="background: #e5e7eb; color: #111827; border: 1px solid #d1d5db; padding: 0.75rem; text-align: left;">항목</th>
                    <th style="background: #e5e7eb; color: #111827; border: 1px solid #d1d5db; padding: 0.75rem; text-align: right;">배당 재투자 O (DRIP)</th>
                    <th style="background: #e5e7eb; color: #111827; border: 1px solid #d1d5db; padding: 0.75rem; text-align: right;">배당 재투자 X</th>
                    ${comp ? `<th style="background: #e5e7eb; color: #111827; border: 1px solid #d1d5db; padding: 0.75rem; text-align: right;">${r.comparisonSymbol}</th>` : ''}
                `;

                const body = rows
                    .map(
                        (row, index) => `
                    <tr style="${index % 2 === 1 ? 'background-color: #f9fafb;' : ''}">
                        <td style="border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left;">${row.label}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 0.75rem; text-align: right;">${row.drip}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 0.75rem; text-align: right;">${row.noDrip}</td>
                        ${comp ? `<td style="border: 1px solid #e5e7eb; padding: 0.75rem; text-align: right;">${row.comp !== undefined ? row.comp : '-'}</td>` : ''}
                    </tr>
                `
                    )
                    .join('');

                return `
                    <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; color: #1f2937; font-size: 14px;">
                        <thead><tr>${header}</tr></thead>
                        <tbody>${body}</tbody>
                    </table>
                `;
            };

            return {
                chartInstance,
                combinedChartOption,
                downloadResultsAsImage,
            };
        },
    });
</script>

<style>
    /* 이 컴포넌트의 스타일은 이제 다운로드 전용 CSS를 포함하지 않습니다. */
</style>
