<!-- stock/src/components/StockChartCard.vue -->
<script setup>
import { computed } from "vue";
import Card from "primevue/card";
import ToggleButton from "primevue/togglebutton";
import SelectButton from "primevue/selectbutton";
import PrimeVueChart from "primevue/chart";
import ProgressSpinner from "primevue/progressspinner";
import Dropdown from "primevue/dropdown"; // 1. Dropdown 컴포넌트 import
import { useBreakpoint } from "@/composables/useBreakpoint"; // 2. useBreakpoint import

const props = defineProps({
  frequency: String,
  chartData: Object,
  chartOptions: Object,
  timeRangeOptions: Array,
  isPriceChartMode: Boolean,
  selectedTimeRange: String,
});

const emit = defineEmits([
  "update:isPriceChartMode",
  "update:selectedTimeRange",
]);

// 3. isDesktop 상태 가져오기
const { isDesktop, isMobile } = useBreakpoint();

// 👇 [핵심 수정 1] 기기 크기에 따라 동적으로 버튼 크기를 결정하는 computed 속성
const buttonSize = computed(() => {
    if (isMobile.value) {
        return 'small';
    }
    // 태블릿과 데스크톱은 기본 크기(null) 또는 'large'를 사용할 수 있습니다.
    // PrimeVue 기본값이 적절하므로, null을 반환하여 기본 크기를 사용하게 합니다.
    // 만약 더 크게 하고 싶다면 'large'를 반환하면 됩니다.
    return null; 
});

const localIsPriceChartMode = computed({
  get: () => props.isPriceChartMode,
  set: (value) => emit("update:isPriceChartMode", value),
});

const localSelectedTimeRange = computed({
  get: () => props.selectedTimeRange,
  set: (value) => emit("update:selectedTimeRange", value),
});

// Dropdown을 위한 옵션 형식 변환 (PrimeVue Dropdown은 객체 배열을 사용)
const dropdownTimeRangeOptions = computed(() => {
  return props.timeRangeOptions.map((option) => ({
    name: option,
    code: option,
  }));
});
</script>

<template>
  <Card class="toto-chart">
    <template #content>
      <div class="flex justify-between items-center w-full gap-2 mb-4">
        <div v-if="frequency === 'Weekly'">
          <ToggleButton
            v-model="localIsPriceChartMode"
            onLabel="주가"
            offLabel="배당"
            onIcon="pi pi-chart-line"
            offIcon="pi pi-chart-bar"
            :size="buttonSize"
          />
        </div>
        <div v-else></div>

        <!-- 👇 [핵심 수정] 화면 크기에 따라 다른 컴포넌트를 렌더링합니다. -->

        <!-- 데스크톱 & 태블릿일 때: 기존의 SelectButton -->
        <SelectButton
          v-if="isDesktop"
          v-model="localSelectedTimeRange"
          :options="timeRangeOptions"
          aria-labelledby="basic"
          :allowEmpty="true"
          
        />

        <!-- 모바일일 때: 새로운 Dropdown -->
        <Dropdown
          v-else
          v-model="localSelectedTimeRange"
          :options="dropdownTimeRangeOptions"
          optionLabel="name"
          optionValue="code"
          placeholder="기간 선택"
          :size="buttonSize"
        />
      </div>
      <div class="chart-container">
        <div class="card" id="p-chart" v-if="chartData && chartOptions">
          <PrimeVueChart
            ref="chartRef"
            type="bar"
            :data="chartData"
            :options="chartOptions"
          />
        </div>
        <div v-else class="flex justify-center items-center h-48">
          <ProgressSpinner />
        </div>
      </div>
    </template>
  </Card>
</template>
