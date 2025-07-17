<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';

// 컴포저블 및 자식 컴포넌트 import
import { useStockData } from '@/composables/useStockData';
import { useStockChart } from '@/composables/useStockChart';
import { parseYYMMDD } from '@/utils/date.js';
import StockHeader from '@/components/StockHeader.vue';
import StockChartCard from '@/components/StockChartCard.vue';
import StockHistoryPanel from '@/components/StockHistoryPanel.vue';
import ProgressSpinner from 'primevue/progressspinner';

// --- 상태 변수 선언 ---
const route = useRoute();
const isDesktop = ref(window.innerWidth >= 768);
const isPriceChartMode = ref(false);
const selectedTimeRange = ref('1Y');
const timeRangeOptions = ref([]);

// --- 컴포저블 실행 ---
const { tickerInfo, dividendHistory, isLoading, error, fetchData } = useStockData();
const { chartData, chartOptions, updateChart } = useStockChart(chartDisplayData, tickerInfo, isPriceChartMode, isDesktop, selectedTimeRange);


// --- 라이프사이클 훅 ---
const onResize = () => { isDesktop.value = window.innerWidth >= 768; };
onMounted(() => { window.addEventListener('resize', onResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); });


// --- 👇 [누락된 부분 복원] 유틸리티 함수 ---

// 날짜 파싱 함수 (매우 중요)
// const parseYYMMDD = (dateStr) => {
//     if (!dateStr || typeof dateStr !== 'string') return null;
//     const parts = dateStr.split('.').map(part => part.trim());
//     if (parts.length !== 3) return null;
//     return new Date(`20${parts[0]}`, parseInt(parts[1], 10) - 1, parts[2]);
// };

// 기간 선택 버튼 옵션 생성 함수 (매우 중요)
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


// --- Computed 속성 ---
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


// --- Watchers (상태 변경 감지 및 반응) ---
watch(() => route.params.ticker, (newTicker) => {
    if (newTicker) {
        isPriceChartMode.value = false;
        selectedTimeRange.value = '1Y';
        fetchData(newTicker);
    }
}, { immediate: true });

watch(dividendHistory, (newHistory) => {
    if (newHistory && newHistory.length > 0) {
        generateDynamicTimeRangeOptions();
    }
}, { immediate: true }); // 데이터 로드 후 즉시 옵션 생성

// 모든 차트 관련 상태가 변경될 때마다, updateChart() 함수만 호출합니다.
watch([chartDisplayData, isPriceChartMode, isDesktop, selectedTimeRange], () => {
    updateChart();
}, { deep: true, immediate: true });
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