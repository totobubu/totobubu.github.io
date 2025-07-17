<!-- stock/src/views/StockView.vue -->
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
const selectedTimeRange = ref("1Y");
const timeRangeOptions = ref([]);

const { tickerInfo, dividendHistory, isLoading, error, fetchData } =
  useStockData();
const { chartData, chartOptions, updateChart } = useStockChart(
  dividendHistory,
  tickerInfo,
  isPriceChartMode,
  selectedTimeRange
);

const generateDynamicTimeRangeOptions = () => {
  if (dividendHistory.value.length === 0) return;
  const oldestRecordDate = parseYYMMDD(
    dividendHistory.value[dividendHistory.value.length - 1]["배당락"]
  );
  const now = new Date();
  const options = [];
  const threeMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 3));
  const sixMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 6));
  const nineMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 9));
  const oneYearAgo = new Date(new Date().setFullYear(now.getFullYear() - 1));
  const twoYearsAgo = new Date(new Date().setFullYear(now.getFullYear() - 2));
  // 👇 [오류 수정] now.getFullYear()로 수정
  const threeYearsAgo = new Date(new Date().setFullYear(now.getFullYear() - 3));

  if (oldestRecordDate < threeMonthsAgo) options.push("3M");
  if (oldestRecordDate < sixMonthsAgo) options.push("6M");
  if (oldestRecordDate < nineMonthsAgo) options.push("9M");
  if (oldestRecordDate < oneYearAgo) options.push("1Y");
  if (oldestRecordDate < twoYearsAgo) options.push("2Y");
  if (oldestRecordDate < threeYearsAgo) options.push("3Y");

  options.push("Max");
  timeRangeOptions.value = options;

  if (!options.includes(selectedTimeRange.value)) {
    selectedTimeRange.value = options[options.length - 2] || "Max";
  }
};

watch(
  () => route.params.ticker,
  (newTicker) => {
    if (newTicker) {
      isPriceChartMode.value = false;
      selectedTimeRange.value = "1Y";
      fetchData(newTicker);
    }
  },
  { immediate: true }
);

// 👇 [개선] 두 개의 watch를 하나로 통합하여 더 명확하게 만듭니다.
watch(
  [dividendHistory, isPriceChartMode, selectedTimeRange],
  (values) => {
    const newHistory = values[0];
    if (newHistory && newHistory.length > 0) {
      generateDynamicTimeRangeOptions();
    }
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
