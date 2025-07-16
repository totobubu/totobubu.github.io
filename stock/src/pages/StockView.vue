<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { joinURL } from 'ufo';
import { useStockData } from '@/composables/useStockData'; // @는 src를 가리킵니다.

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressSpinner from 'primevue/progressspinner';
import SelectButton from 'primevue/selectbutton';
import ToggleButton from 'primevue/togglebutton';
import Panel from 'primevue/panel';
import Card from 'primevue/card';
import PrimeVueChart from 'primevue/chart';

import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, BarController, LineController } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import zoomPlugin from 'chartjs-plugin-zoom';
import Hammer from 'hammerjs';

ChartJS.register(
  Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale,
  PointElement, LineElement, BarController, LineController,
  ChartDataLabels, zoomPlugin
);

const route = useRoute();

const timeRangeOptions = ref([]);
const selectedTimeRange = ref('1Y');
const isPriceChartMode = ref(false);
const isDesktop = ref(window.innerWidth >= 768);

const chartData = ref();
const chartOptions = ref();

const onResize = () => { isDesktop.value = window.innerWidth >= 768; };
onMounted(() => { window.addEventListener('resize', onResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); });

const { tickerInfo, dividendHistory, isLoading, error, fetchData } = useStockData();

const generateDynamicTimeRangeOptions = () => {
    if (dividendHistory.value.length === 0) return;
    const oldestRecordDate = parseYYMMDD(dividendHistory.value[dividendHistory.value.length - 1]['배당락']);
    const now = new Date();
    const options = [];
    const threeMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 3));
    const sixMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 6));
    const nineMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 9));
    const oneYearAgo = new Date(new Date().setFullYear(now.getFullYear() - 1));

    if (oldestRecordDate < threeMonthsAgo) options.push('3M');
    if (oldestRecordDate < sixMonthsAgo) options.push('6M');
    if (oldestRecordDate < nineMonthsAgo) options.push('9M');
    if (oldestRecordDate < oneYearAgo) options.push('1Y');

    options.push('Max');
    timeRangeOptions.value = options;

    if (!options.includes(selectedTimeRange.value)) {
        selectedTimeRange.value = options[options.length - 2] || 'Max';
    }
};

const columns = computed(() => {
    if (dividendHistory.value.length === 0) return [];

    const allKeys = new Set();
    dividendHistory.value.forEach(item => {
        Object.keys(item).forEach(key => allKeys.add(key));
    });

    const desiredOrder = ['배당락', '배당금', '전일가', '당일가'];
    const sortedKeys = Array.from(allKeys).sort((a, b) => {
        const indexA = desiredOrder.indexOf(a);
        const indexB = desiredOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return sortedKeys.map(key => ({ field: key, header: key }));
});

const chartDisplayData = computed(() => {
    if (dividendHistory.value.length === 0) return [];

    if (tickerInfo.value?.frequency === 'Weekly' && !isPriceChartMode.value && selectedTimeRange.value && selectedTimeRange.value !== 'Max') {
        const now = new Date();
        const rangeValue = parseInt(selectedTimeRange.value);
        const rangeUnit = selectedTimeRange.value.slice(-1);

        let startDate = new Date(now);
        if (rangeUnit === 'M') {
            startDate.setMonth(now.getMonth() - rangeValue);
        } else {
            startDate.setFullYear(now.getFullYear() - rangeValue);
        }

        const cutoffDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const filteredData = dividendHistory.value.filter(item => parseYYMMDD(item['배당락']) >= cutoffDate);
        return filteredData.reverse();
    }

    if (selectedTimeRange.value === 'Max' || !selectedTimeRange.value) {
        return [...dividendHistory.value].reverse();
    }

    const now = new Date();
    const rangeValue = parseInt(selectedTimeRange.value);
    const rangeUnit = selectedTimeRange.value.slice(-1);
    let cutoffDate;
    if (rangeUnit === 'M') {
        cutoffDate = new Date(new Date().setMonth(now.getMonth() - rangeValue));
    } else {
        cutoffDate = new Date(new Date().setFullYear(now.getFullYear() - rangeValue));
    }
    const filteredData = dividendHistory.value.filter(item => parseYYMMDD(item['배당락']) >= cutoffDate);
    return filteredData.reverse();
});

const setChartDataAndOptions = (data, frequency) => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');
    const individualLabelSize = isDesktop.value ? 12 : 10;
    const totalLabelSize = isDesktop.value ? 15 : 12;
    const lineLabelSize = isDesktop.value ? 11 : 9;
    const colorPresets = ['--p-cyan-400', '--p-orange-400', '--p-purple-400', '--p-green-400', '--p-red-400', '--p-blue-400'];
    const shuffledColors = [...colorPresets].sort(() => 0.5 - Math.random());
    const zoomOptions = {
        pan: {
            enabled: true,
            mode: 'x',
            onPanComplete: () => { selectedTimeRange.value = null; }
        },
        zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
            onZoomComplete: () => { selectedTimeRange.value = null; }
        }
    };

    if (frequency === 'Weekly' && !isPriceChartMode.value) {
        const monthlyAggregated = data.reduce((acc, item) => {
            const date = parseYYMMDD(item['배당락']);
            if (!date) return acc;
            const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
            const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
            if (!acc[yearMonth]) { acc[yearMonth] = { total: 0, weeks: {} }; }
            if (!acc[yearMonth].weeks[weekOfMonth]) { acc[yearMonth].weeks[weekOfMonth] = 0; }
            acc[yearMonth].weeks[weekOfMonth] += amount;
            acc[yearMonth].total += amount;
            return acc;
        }, {});

        const labels = Object.keys(monthlyAggregated);
        const weekColors = { 1: '#4285F4', 2: '#EA4335', 3: '#FBBC04', 4: '#34A853', 5: '#FF6D01' };

        const existingWeeks = [...new Set(Object.values(monthlyAggregated).flatMap(m => Object.keys(m.weeks)))].map(Number).sort();
        const datasets = existingWeeks.map(week => ({
            type: 'bar', label: `${week}주차`, backgroundColor: weekColors[week],
            data: labels.map(label => monthlyAggregated[label].weeks[week] || 0),
            datalabels: {
                display: context => (context.dataset.data[context.dataIndex] || 0) > 0.0001,
                formatter: (value) => `$${value.toFixed(4)}`,
                color: '#fff',
                font: { size: individualLabelSize, weight: 'bold' },
                align: 'center', anchor: 'center'
            }
        }));

        datasets.push({
            type: 'bar', label: 'Total', data: new Array(labels.length).fill(0),
            backgroundColor: 'transparent',
            datalabels: {
                display: (context) => isDesktop.value && (monthlyAggregated[labels[context.dataIndex]]?.total || 0) > 0,
                formatter: (value, context) => {
                    const total = monthlyAggregated[labels[context.dataIndex]]?.total || 0;
                    return `$${total.toFixed(4)}`;
                },
                color: textColor, anchor: 'end', align: 'end',
                offset: -8,
                font: { size: totalLabelSize, weight: 'bold' }
            }
        });

        chartData.value = { labels, datasets };
        const maxTotal = Math.max(...Object.values(monthlyAggregated).map(m => m.total));
        const yAxisMax = maxTotal * 1.25;
        chartOptions.value = {
            maintainAspectRatio: false, aspectRatio: 0.8,
            plugins: {
                title: { display: false },
                tooltip: { mode: 'index', intersect: false, callbacks: {
                    filter: item => item.dataset.label !== 'Total' && item.parsed.y > 0,
                    footer: items => 'Total: $' + items.reduce((a, b) => a + b.parsed.y, 0).toFixed(4),
                }},
                legend: { display: false },
                datalabels: { display: true },
                zoom: zoomOptions
            },
            scales: {
                x: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
                y: { stacked: true, ticks: { color: textColorSecondary }, grid: { color: surfaceBorder }, max: yAxisMax }
            }
        };

    } else {
        const prices = data.flatMap(item => [parseFloat(item['전일가']?.replace('$', '')), parseFloat(item['당일가']?.replace('$', ''))]).filter(p => !isNaN(p));
        const priceMin = prices.length > 0 ? Math.min(...prices) * 0.98 : 0;
        const priceMax = prices.length > 0 ? Math.max(...prices) * 1.02 : 1;
        chartData.value = {
            labels: data.map(item => item['배당락']),
            datasets: [
                {
                    type: 'bar', label: '배당금', yAxisID: 'y', order: 2,
                    backgroundColor: documentStyle.getPropertyValue(shuffledColors[0]),
                    data: data.map(item => parseFloat(item['배당금']?.replace('$', '') || 0)),
                    datalabels: { display: isDesktop.value, anchor: 'end', align: 'end', color: textColor, formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null, font: { size: individualLabelSize } }
                },
                {
                    type: 'line', label: '전일가', yAxisID: 'y1', order: 1,
                    borderColor: documentStyle.getPropertyValue(shuffledColors[1]),
                    data: data.map(item => parseFloat(item['전일가']?.replace('$', ''))),
                    tension: 0.4, borderWidth: 2, fill: false,
                    datalabels: { display: isDesktop.value, align: 'top', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
                },
                {
                    type: 'line', label: '당일가', yAxisID: 'y1', order: 1,
                    borderColor: documentStyle.getPropertyValue(shuffledColors[2]),
                    data: data.map(item => parseFloat(item['당일가']?.replace('$', ''))),
                    tension: 0.4, borderWidth: 2, fill: false,
                    datalabels: { display: isDesktop.value, align: 'bottom', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
                }
            ]
        };
        chartOptions.value = {
            maintainAspectRatio: false, aspectRatio: 0.6,
            plugins: {
                legend: { display: false },
                datalabels: { display: false },
                tooltip: { mode: 'index', intersect: false, callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (context.parsed.y !== null) { label += `: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y)}`; }
                        return label;
                    }
                }},
                zoom: zoomOptions
            },
            scales: {
                x: { ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
                y: { type: 'linear', display: true, position: 'left', ticks: { color: textColorSecondary }, grid: { color: surfaceBorder } },
                y1: {
                    type: 'linear', display: true, position: 'right', min: priceMin, max: priceMax,
                    ticks: { color: textColorSecondary }, grid: { drawOnChartArea: false, color: surfaceBorder }
                }
            }
        };
    }
};

watch(() => route.params.ticker, (newTicker) => {
    if (newTicker) {
        isPriceChartMode.value = false;
        selectedTimeRange.value = '1Y';
        fetchData(newTicker); 
    }
}, { immediate: true });

watch(selectedTimeRange, (newRange) => {
    if (newRange && chartData.value) {
        const chartInstance = ChartJS.getChart('p-chart-instance');
        if (chartInstance) {
            chartInstance.resetZoom();
        }
    }
});

watch([chartDisplayData, isPriceChartMode, isDesktop], ([newData]) => {
    if (newData && newData.length > 0 && tickerInfo.value) {
        setChartDataAndOptions(newData, tickerInfo.value.frequency);
    } else {
        chartData.value = null;
        chartOptions.value = null;
    }
}, { deep: true, immediate: true });

const stats = computed(() => {
  if (!tickerInfo.value) {
    return [
        { title: "시가총액", value: "..." }, { title: "52주", value: "..." },
        { title: "NAV", value: "..." }, { title: "Total Return", value: "..." },
    ];
  }
  return [
    { title: "시가총액", value: tickerInfo.value.Volume },
    { title: "52주", value: tickerInfo.value['52Week'] },
    { title: "NAV", value: tickerInfo.value.NAV },
    { title: "Total Return", value: tickerInfo.value.TotalReturn },
  ];
});

</script>

<template>
    <div class="card" :class="{ 'is-mobile': !isDesktop }">
        <div v-if="isLoading" class="flex justify-center items-center h-screen">
            <ProgressSpinner />
        </div>

        <div v-else-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500"></i>
            <p class="text-red-500 text-xl mt-4">{{ error }}</p>
        </div>

        <div v-else-if="tickerInfo && dividendHistory.length > 0" class="flex flex-column" :class="isDesktop ? 'gap-5' : 'gap-3'">

            <div id="tickerInfo">
                <Accordion expandIcon="pi pi-plus" collapseIcon="pi pi-minus">
                    <AccordionPanel value="0">
                        <AccordionHeader>
                            <div class="tickerInfo__header">
                                <div class="tickerInfo__brand">{{ tickerInfo.company }} · {{ tickerInfo.frequency }} · {{ tickerInfo.group }}</div>
                                <h2 class="tickerInfo__title">{{ tickerInfo.name }} <small>· {{ tickerInfo.fullname }}</small></h2>
                            </div>
                        </AccordionHeader>
                        <AccordionContent>
                            <div class="tickerInfo__status">
                                <div class="stats">
                                    <div v-for="(stat, index) in stats" :key="index" class="layout-card">
                                        <div class="stats-content">
                                            <div class="stats-value">{{ stat.value }}</div>
                                        </div>
                                        <div class="stats-header">
                                            <span class="stats-title">{{ stat.title }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionPanel>
                </Accordion>
            </div>

            <Card>
                <template #content>
                    <div class="flex justify-between items-center w-full gap-2" :class="isDesktop ? 'mb-4' : 'mb-3'">
                        <div v-if="tickerInfo?.frequency === 'Weekly'">
                            <ToggleButton v-model="isPriceChartMode" onLabel="주가" offLabel="배당" onIcon="pi pi-chart-line" offIcon="pi pi-chart-bar" />
                        </div>
                        <div v-else></div>
                        <SelectButton v-model="selectedTimeRange" :options="timeRangeOptions" aria-labelledby="basic" :allowEmpty="true" />
                    </div>
                    <div class="chart-container">
                        <div class="card" id="p-chart" v-if="chartData && chartOptions">
                            <PrimeVueChart type="bar" :data="chartData" :options="chartOptions" :canvas-props="{'id': 'p-chart-instance'}" />
                        </div>
                        <div v-else class="flex justify-center items-center h-48">
                            <ProgressSpinner />
                        </div>
                    </div>
                </template>
            </Card>

            <Panel :toggleable="true" header="배당금 상세 정보" :collapsed="true">
                <template #icons>
                    <span class="text-surface-500 dark:text-surface-400">Last Update: {{ tickerInfo.Update }}</span>
                </template>
                <DataTable :value="dividendHistory" responsiveLayout="scroll" stripedRows :rows="10" paginator
                    :paginatorTemplate="isDesktop ? 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink' : 'PrevPageLink CurrentPageReport NextPageLink'"
                    currentPageReportTemplate="{first} - {last} of {totalRecords}">
                    <Column v-for="col in columns" :key="col.field" :field="col.field" :header="col.header" sortable></Column>
                </DataTable>
            </Panel>
        </div>

        <div v-else class="text-center mt-8">
            <i class="pi pi-inbox text-5xl text-surface-500"></i>
            <p class="text-xl mt-4">표시할 데이터가 없습니다.</p>
        </div>
    </div>
</template>
