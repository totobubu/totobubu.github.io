<!-- REFACTORED: src/components/charts/StockPriceCandlestickChart.vue -->
<script setup>
    import { computed } from 'vue';
    import { use } from 'echarts/core';
    import { CanvasRenderer } from 'echarts/renderers';
    import { CandlestickChart, BarChart } from 'echarts/charts';
    import {
        TooltipComponent,
        GridComponent,
        DataZoomComponent,
        LegendComponent,
        VisualMapComponent,
    } from 'echarts/components';
    import VChart from 'vue-echarts';
    import { useLayout } from '@/composables/useLayout';

    use([
        CanvasRenderer,
        CandlestickChart,
        BarChart,
        TooltipComponent,
        GridComponent,
        DataZoomComponent,
        LegendComponent,
        VisualMapComponent,
    ]);

    const props = defineProps({
        priceData: {
            type: Array,
            default: () => [],
        },
    });

    const { isDarkMode } = useLayout();

    const chartData = computed(() => {
        if (!props.priceData || props.priceData.length === 0) {
            return { dates: [], ohlc: [], volumes: [] };
        }
        const dates = [];
        const ohlc = [];
        const volumes = [];
        for (let i = 0; i < props.priceData.length; i++) {
            const item = props.priceData[i];
            dates.push(item.date);
            ohlc.push([item.open, item.close, item.low, item.high]);
            volumes.push(item.volume);
        }
        return { dates, ohlc, volumes };
    });

    const chartOption = computed(() => {
        const upColor = isDarkMode.value ? '#ef4444' : '#d94c4c';
        const downColor = isDarkMode.value ? '#3b82f6' : '#2563eb';
        const textColor = isDarkMode.value ? '#f8fafc' : '#334155';

        return {
            animation: false,
            legend: {
                bottom: 10,
                left: 'center',
                data: ['주가', '거래량'],
                textStyle: { color: textColor },
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: isDarkMode.value ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode.value ? '#475569' : '#e2e8f0',
                textStyle: { color: textColor },
            },
            axisPointer: {
                link: [{ xAxisIndex: 'all' }],
                label: { backgroundColor: '#777' },
            },
            grid: [
                { left: '10%', right: '8%', height: '50%' },
                { left: '10%', right: '8%', top: '68%', height: '16%' },
            ],
            xAxis: [
                {
                    type: 'category',
                    data: chartData.value.dates,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    splitLine: { show: false },
                    min: 'dataMin',
                    max: 'dataMax',
                    axisPointer: { z: 100 },
                    axisLabel: { color: textColor },
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: chartData.value.dates,
                    boundaryGap: false,
                    axisLine: { onZero: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { show: false },
                    min: 'dataMin',
                    max: 'dataMax',
                },
            ],
            yAxis: [
                {
                    scale: true,
                    splitArea: { show: true },
                    axisLabel: { color: textColor },
                },
                {
                    scale: true,
                    gridIndex: 1,
                    splitNumber: 2,
                    axisLabel: { show: false },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                },
            ],
            dataZoom: [
                { type: 'inside', xAxisIndex: [0, 1], start: 80, end: 100 },
                {
                    show: true,
                    xAxisIndex: [0, 1],
                    type: 'slider',
                    top: '90%',
                    start: 80,
                    end: 100,
                },
            ],
            series: [
                {
                    name: '주가',
                    type: 'candlestick',
                    data: chartData.value.ohlc,
                    itemStyle: {
                        color: upColor,
                        color0: downColor,
                        borderColor: upColor,
                        borderColor0: downColor,
                    },
                },
                {
                    name: '거래량',
                    type: 'bar',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: chartData.value.volumes,
                    itemStyle: {
                        color: (params) => {
                            const ohlc = chartData.value.ohlc[params.dataIndex];
                            return ohlc[1] > ohlc[0] ? upColor : downColor;
                        },
                    },
                },
            ],
        };
    });
</script>

<template>
    <Card class="toto-chart toto-candlestick-chart">
        <template #content>
            <div class="chart-wrapper">
                <div class="chart-container" style="height: 500px">
                    <v-chart
                        v-if="priceData && priceData.length > 0"
                        :option="chartOption"
                        autoresize />
                    <div
                        v-else
                        class="flex justify-center items-center h-full dark:text-surface-500">
                        <p>주가 데이터가 없습니다.</p>
                    </div>
                </div>
            </div>
        </template>
    </Card>
</template>
