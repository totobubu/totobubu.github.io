<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";

import { useStockData } from "@/composables/useStockData";
import { useStockChart } from "@/composables/useStockChart";
import { useBreakpoint } from "@/composables/useBreakpoint";
import { parseYYMMDD } from "@/utils/date.js";
import StockHeader from "@/components/StockHeader.vue";
import StockChartCard from "@/components/StockChartCard.vue";
import StockHistoryPanel from "@/components/StockHistoryPanel.vue";
import ProgressSpinner from "primevue/progressspinner";

const route = useRoute();
const { isDesktop } = useBreakpoint();
const isPriceChartMode = ref(false);
const selectedTimeRange = ref("1Y"); // 초기값, watch에서 덮어씀
const timeRangeOptions = ref([]);

const { tickerInfo, dividendHistory, isLoading, error, fetchData } = useStockData();
const { chartData, chartOptions, chartContainerWidth, hasDividendChartMode, updateChart } = useStockChart(
  dividendHistory,
  tickerInfo,
  isPriceChartMode,
  selectedTimeRange
);

const generateDynamicTimeRangeOptions = () => {
  if (dividendHistory.value.length === 0) return;

  const frequency = tickerInfo.value?.frequency;
  const oldestRecordDate = parseYYMMDD(dividendHistory.value[dividendHistory.value.length - 1]["배당락"]);
  const now = new Date();
  const options = [];

  const oneYearAgo = new Date(new Date().setFullYear(now.getFullYear() - 1));
  const twoYearsAgo = new Date(new Date().setFullYear(now.getFullYear() - 2));
  const threeYearsAgo = new Date(new Date().setFullYear(now.getFullYear() - 3));
  const fiveYearsAgo = new Date(new Date().setFullYear(now.getFullYear() - 5));

  if (frequency === '분기') {
    const tenYearsAgo = new Date(new Date().setFullYear(now.getFullYear() - 10));
    if (oldestRecordDate < oneYearAgo) options.push("1Y");
    if (oldestRecordDate < twoYearsAgo) options.push("2Y");
    if (oldestRecordDate < threeYearsAgo) options.push("3Y");
    if (oldestRecordDate < fiveYearsAgo) options.push("5Y");
    if (oldestRecordDate < tenYearsAgo) options.push("10Y");
  } else { // 매주, 매월, 4주 등
    const sixMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 6));
    if (oldestRecordDate < sixMonthsAgo) options.push("6M");
    if (oldestRecordDate < oneYearAgo) options.push("1Y");
    if (oldestRecordDate < twoYearsAgo) options.push("2Y");
    if (oldestRecordDate < threeYearsAgo) options.push("3Y");
    if (oldestRecordDate < fiveYearsAgo) options.push("5Y");
  }

  options.push("Max");
  timeRangeOptions.value = options;
};

watch(
  () => route.params.ticker,
  async (newTicker) => {
    if (newTicker) {
      isPriceChartMode.value = false;
      await fetchData(newTicker);

      // 데이터 로드 후, frequency에 따라 기본 기간 설정
      const freq = tickerInfo.value?.frequency;
      if (freq === '분기') {
        selectedTimeRange.value = timeRangeOptions.value.includes('1Y') ? '1Y' : timeRangeOptions.value[0] || 'Max';
      } else if (['매주', '매월', '4주'].includes(freq)) {
        selectedTimeRange.value = timeRangeOptions.value.includes('6M') ? '6M' : timeRangeOptions.value[0] || 'Max';
      } else {
        selectedTimeRange.value = timeRangeOptions.value[0] || 'Max';
      }
    }
  },
  { immediate: true }
);

watch(
  dividendHistory,
  (newHistory) => {
    if (newHistory && newHistory.length > 0) {
      generateDynamicTimeRangeOptions();
    }
  },
  { immediate: true }
);

watch(
  [dividendHistory, isPriceChartMode, selectedTimeRange],
  () => {
    updateChart();
  },
  { deep: true, immediate: true }
);
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

    <div
      v-else-if="tickerInfo && dividendHistory.length > 0"
      class="flex flex-column gap-5"
    >
      <StockHeader :info="tickerInfo" />

      <StockChartCard
        :has-dividend-chart-mode="hasDividendChartMode"
        :chart-data="chartData"
        :chart-options="chartOptions"
        :chart-container-width="chartContainerWidth"
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