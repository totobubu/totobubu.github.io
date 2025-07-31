<script setup>
import { computed } from "vue";
import Card from "primevue/card";
import ToggleButton from "primevue/togglebutton";
import SelectButton from "primevue/selectbutton";
import PrimeVueChart from "primevue/chart";
import ProgressSpinner from "primevue/progressspinner";
import Dropdown from "primevue/dropdown";
import { useBreakpoint } from "@/composables/useBreakpoint";

const props = defineProps({
  hasDividendChartMode: Boolean,
  chartData: Object,
  chartOptions: Object,
  chartContainerWidth: String,
  timeRangeOptions: Array,
  isPriceChartMode: Boolean,
  selectedTimeRange: String,
});

const emit = defineEmits([
  "update:isPriceChartMode",
  "update:selectedTimeRange",
]);

const { isDesktop, isMobile } = useBreakpoint();

const buttonSize = computed(() => {
    return isMobile.value ? 'small' : null; 
});

const localIsPriceChartMode = computed({
  get: () => props.isPriceChartMode,
  set: (value) => emit("update:isPriceChartMode", value),
});

const localSelectedTimeRange = computed({
  get: () => props.selectedTimeRange,
  set: (value) => emit("update:selectedTimeRange", value),
});

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
        <div v-if="hasDividendChartMode">
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

        <SelectButton
          v-if="isDesktop"
          v-model="localSelectedTimeRange"
          :options="timeRangeOptions"
          aria-labelledby="basic"
        />

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
        <div class="card" id="p-chart" v-if="chartData && chartOptions" :style="{ minWidth: chartContainerWidth }">
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