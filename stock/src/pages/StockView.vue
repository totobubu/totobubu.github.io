<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { joinURL } from 'ufo';

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
const tickerInfo = ref(null);
const dividendHistory = ref([]);
const isLoading = ref(true);
const error = ref(null);

const timeRangeOptions = ref([]);
const selectedTimeRange = ref('1Y');
const isPriceChartMode = ref(false);
const isDesktop = ref(window.innerWidth >= 768);

const chartData = ref();
const chartOptions = ref();

const onResize = () => { isDesktop.value = window.innerWidth >= 768; };
onMounted(() => { window.addEventListener('resize', onResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); });

const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map(part => part.trim());
    if (parts.length !== 3) return null;
    return new Date(`20${parts[0]}`, parseInt(parts[1], 10) - 1, parts[2]);
};

const fetchData = async (tickerName) => {
    isLoading.value = true;
    error.value = null;
    tickerInfo.value = null;
    dividendHistory.value = [];
    timeRangeOptions.value = [];
    const url = joinURL(import.meta.env.BASE_URL, `data/${tickerName.toLowerCase()}.json`);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`File not found`);
        const responseData = await response.json();
        tickerInfo.value = responseData.tickerInfo;
        const sortedHistory = responseData.dividendHistory.sort((a, b) =>
            parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
        );
        dividendHistory.value = sortedHistory;
        generateDynamicTimeRangeOptions();
    } catch (err) {
        error.value = `${tickerName.toUpperCase()}의 분배금 정보를 찾을 수 없습니다.`;
    } finally {
        isLoading.value = false;
    }
};

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
    return Object.keys(dividendHistory.value[0]).map(key => ({ field: key, header: key }));
});

const chartDisplayData = computed(() => {
    if (dividendHistory.value.length === 0) return [];
    if (selectedTimeRange.value === 'Max') return [...dividendHistory.value].reverse();
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
    const zoomOptions = { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } };

    if (frequency === 'Weekly' && !isPriceChartMode.value) {
        const monthlyAggregated = data.reduce((acc, item) => {
            const date = parseYYMMDD(item['배당락']);
            if (!date) return acc;
            const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
            const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
            if (!acc[yearMonth]) { acc[yearMonth] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0 }; }
            acc[yearMonth][weekOfMonth] += amount;
            acc[yearMonth].total += amount;
            return acc;
        }, {});
        const labels = Object.keys(monthlyAggregated);
        const weekColors = { 1: '#4285F4', 2: '#EA4335', 3: '#FBBC04', 4: '#34A853', 5: '#FF6D01' };
        const datasets = [1, 2, 3, 4, 5].map(week => ({
            type: 'bar', label: `${week}주차`, backgroundColor: weekColors[week],
            data: labels.map(label => monthlyAggregated[label][week]),
            datalabels: {
                display: context => context.dataset.data[context.dataIndex] > 0.0001,
                formatter: (value) => `$${value.toFixed(4)}`, color: '#fff',
                font: { size: 15, weight: 'bold' }, align: 'center', anchor: 'center'
            }
        }));
        datasets.push({
            type: 'bar', label: 'Total', data: new Array(labels.length).fill(0),
            backgroundColor: 'transparent',
            datalabels: {
                display: true,
                formatter: (value, context) => {
                    const total = monthlyAggregated[context.chart.data.labels[context.dataIndex]]?.total || 0;
                    return total > 0 ? `$${total.toFixed(4)}` : '';
                },
                color: textColor, anchor: 'end', align: 'end',
                offset: 10, font: { size: 15, weight: 'bold' }
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
                    datalabels: { display: true, anchor: 'end', align: 'end', color: textColor, formatter: (value) => value > 0 ? `$${value.toFixed(2)}` : null, font: { size: individualLabelSize } }
                },
                {
                    type: 'line', label: '전일가', yAxisID: 'y1', order: 1,
                    borderColor: documentStyle.getPropertyValue(shuffledColors[1]),
                    data: data.map(item => parseFloat(item['전일가']?.replace('$', ''))),
                    tension: 0.4, borderWidth: 2, fill: false,
                    datalabels: { display: true, align: 'top', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
                },
                {
                    type: 'line', label: '당일가', yAxisID: 'y1', order: 1,
                    borderColor: documentStyle.getPropertyValue(shuffledColors[2]),
                    data: data.map(item => parseFloat(item['당일가']?.replace('$', ''))),
                    tension: 0.4, borderWidth: 2, fill: false,
                    datalabels: { display: true, align: 'bottom', color: textColor, formatter: (value) => value ? `$${value.toFixed(2)}` : null, font: { size: lineLabelSize } }
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

const home = ref({ icon: 'pi pi-home', route: '/' });
</script>

<template>
    <div class="card">
        <div v-if="isLoading" class="flex justify-center items-center h-screen">
            <ProgressSpinner />
        </div>

        <div v-else-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500"></i>
            <p class="text-red-500 text-xl mt-4">{{ error }}</p>
        </div>

        <div v-else-if="tickerInfo && dividendHistory.length > 0" class="flex flex-column gap-5">

            <div id="tickerInfo">
                <div class="tickerInfo__header">
                    <div class="tickerInfo__brand">{{ tickerInfo.company }} · {{ tickerInfo.frequency }} · {{ tickerInfo.group }}</div>
                    <h2 class="tickerInfo__title">{{ tickerInfo.name }} <small>· {{ tickerInfo.fullname }}</small></h2>
                </div>
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
            </div>

            <Card>
                <template #content>
                    <div class="flex justify-between items-center w-full gap-2 mb-4">
                        <div v-if="tickerInfo?.frequency === 'Weekly'">
                            <ToggleButton v-model="isPriceChartMode" onLabel="주가" offLabel="배당" onIcon="pi pi-chart-line" offIcon="pi pi-chart-bar" />
                        </div>
                        <div v-else></div>
                        <SelectButton v-model="selectedTimeRange" :options="timeRangeOptions" aria-labelledby="basic" />
                    </div>
                    <div class="card" id="p-chart" v-if="chartData && chartOptions">
                        <PrimeVueChart type="bar" :data="chartData" :options="chartOptions" />
                    </div>
                     <div v-else class="flex justify-center items-center h-48">
                        <ProgressSpinner />
                    </div>
                </template>
            </Card>

            <Panel :toggleable="true" header="배당금 상세 정보" :collapsed="true">
                <template #icons>
                    <span class="text-surface-500 dark:text-surface-400">Last Update: {{ tickerInfo.Update }}</span>
                </template>
                <DataTable :value="dividendHistory" responsiveLayout="scroll" stripedRows :rows="10" paginator>
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
