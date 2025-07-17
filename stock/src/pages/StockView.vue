<!-- stock/src/views/StockView.vue -->
<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useStockData } from '@/composables/useStockData';
import { useStockChart } from '@/composables/useStockChart';
import { parseYYMMDD } from '@/utils/date.js';
import StockHeader from '@/components/StockHeader.vue';
import StockChartCard from '@/components/StockChartCard.vue';
import StockHistoryPanel from '@/components/StockHistoryPanel.vue';
import ProgressSpinner from 'primevue/progressspinner';

const route = useRoute();
const isDesktop = ref(window.innerWidth >= 768);
const isPriceChartMode = ref(false);
const selectedTimeRange = ref('1Y');
const timeRangeOptions = ref([]);

// --- DEBUG ---
console.log('%c[View] StockView.vue 컴포넌트 초기화', 'color: green; font-weight: bold;');

const { tickerInfo, dividendHistory, isLoading, error, fetchData } = useStockData();
const { chartData, chartOptions, updateChart } = useStockChart(dividendHistory, tickerInfo, isPriceChartMode, isDesktop, selectedTimeRange);

const onResize = () => { isDesktop.value = window.innerWidth >= 768; };
onMounted(() => { window.addEventListener('resize', onResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); });

const generateDynamicTimeRangeOptions = () => {
    // --- DEBUG ---
    console.log('%c[View] 기간 선택 버튼 생성 시도...', 'color: green;');
    if (dividendHistory.value.length === 0) {
        console.log('%c[View] 데이터가 없어서 버튼 생성 중단.', 'color: orange;');
        return;
    }
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
    // --- DEBUG ---
    console.log('%c[View] 생성된 버튼 옵션:', 'color: green; font-weight: bold;', options);
};

watch(() => route.params.ticker, (newTicker) => {
    if (newTicker) {
        // --- DEBUG ---
        console.log(`%c[View] 라우트 변경 감지: ${newTicker}. 데이터 로딩 시작.`, 'color: green; font-weight: bold;');
        isPriceChartMode.value = false;
        selectedTimeRange.value = '1Y';
        fetchData(newTicker);
    }
}, { immediate: true });

watch(dividendHistory, (newHistory) => {
    // --- DEBUG ---
    console.log('%c[View] dividendHistory 변경 감지!', 'color: green;');
    if (newHistory && newHistory.length > 0) {
        console.log(`%c[View] ${newHistory.length}개의 데이터 로드 완료.`, 'color: green; font-weight: bold;');
        generateDynamicTimeRangeOptions();
    }
}, { immediate: true });

watch([dividendHistory, isPriceChartMode, isDesktop, selectedTimeRange], () => {
    // --- DEBUG ---
    console.log('%c[View] 차트 업데이트 트리거 발생! updateChart() 호출.', 'color: green; font-weight: bold;');
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
            
            <StockHeader :info="tickerInfo" />

            <StockChartCard 
                :frequency="tickerInfo.frequency"
                :chart-data="chartData"
                :chart-options="chartOptions"
                :time-range-options="timeRangeOptions"
                v-model:isPriceChartMode="isPriceChartMode"
                v-model:selectedTimeRange="selectedTimeRange"
            />

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