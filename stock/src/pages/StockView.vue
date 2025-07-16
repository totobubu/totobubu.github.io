<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';

// 1. 필요한 컴포저블만 import 합니다.
import { useStockData } from '@/composables/useStockData';
import { useStockChart } from '@/composables/useStockChart';

// 2. 필요한 자식 컴포넌트들을 각각의 이름으로 import 합니다.
import StockHeader from '@/components/StockHeader.vue';
import StockChartCard from '@/components/StockChartCard.vue';
import StockHistoryPanel from '@/components/StockHistoryPanel.vue';

// 3. 로딩/에러 표시를 위한 컴포넌트만 남깁니다.
import ProgressSpinner from 'primevue/progressspinner';
import { Chart as ChartJS } from 'chart.js'; // Chart 인스턴스 접근을 위해 필요

// --- 상태 관리 ---
const route = useRoute();
const isDesktop = ref(window.innerWidth >= 768);
const isPriceChartMode = ref(false);
const selectedTimeRange = ref('1Y');
const timeRangeOptions = ref([]);

// --- 로직 실행 (컴포저블) ---
const { tickerInfo, dividendHistory, isLoading, error, fetchData } = useStockData();

// chartDisplayData는 여러 곳에서 사용되므로 부모에 둡니다.
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

// useStockChart에 필요한 상태들을 인자로 전달합니다.
const { chartData, chartOptions, updateChart } = useStockChart(chartDisplayData, tickerInfo, isPriceChartMode, isDesktop, selectedTimeRange);


// --- 유틸리티 및 라이프사이클 훅 ---
const onResize = () => { isDesktop.value = window.innerWidth >= 768; };
onMounted(() => { window.addEventListener('resize', onResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); });

const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map(part => part.trim());
    if (parts.length !== 3) return null;
    return new Date(`20${parts[0]}`, parseInt(parts[1], 10) - 1, parts[2]);
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

// --- Watchers (상태 변경 감지 및 반응) ---
watch(() => route.params.ticker, (newTicker) => {
    if (newTicker) {
        isPriceChartMode.value = false;
        selectedTimeRange.value = '1Y';
        fetchData(newTicker);
    }
}, { immediate: true });

// 데이터 로드가 완료되면, 기간 선택 옵션을 생성합니다.
watch(dividendHistory, (newHistory) => {
    if (newHistory && newHistory.length > 0) {
        generateDynamicTimeRangeOptions();
    }
});

// 차트를 다시 그려야 할 조건이 변경되면 updateChart 함수를 호출합니다.
watch([chartDisplayData, isPriceChartMode, isDesktop], () => {
    updateChart();
}, { deep: true });

// 기간 선택 버튼을 누르면 차트 줌을 리셋합니다.
watch(selectedTimeRange, (newRange) => {
    if (newRange && chartData.value) {
        const chartInstance = ChartJS.getChart('p-chart-instance');
        if (chartInstance) {
            chartInstance.resetZoom();
        }
    }
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
            
            <!-- 헤더 컴포넌트에 종목 정보 전달 -->
            <StockHeader :info="tickerInfo" />

            <!-- 차트 컴포넌트에 필요한 모든 데이터와 상태를 props와 v-model로 전달 -->
            <StockChartCard 
                :frequency="tickerInfo.frequency"
                :chart-data="chartData"
                :chart-options="chartOptions"
                :time-range-options="timeRangeOptions"
                v-model:isPriceChartMode="isPriceChartMode"
                v-model:selectedTimeRange="selectedTimeRange"
            />

            <!-- 히스토리 패널에 필요한 데이터 전달 -->
            <StockHistoryPanel 
                :history="dividendHistory" 
                :update-time="tickerInfo.Update" 
                :is-desktop="isDesktop" 
            />

        </div>

        <div v-else class="text-center mt-8">
            <i class="pi pi-inbox text-5xl text-surface-500"></i>
            <p class="text-xl mt-4">표시할 데이터가 없습니다.</p>
        </div>
    </div>
</template>