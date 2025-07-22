<!-- stock/src/views/HomeView.vue -->
<template>
  <div class="card">
    <div v-if="isLoading" class="flex justify-center items-center h-screen">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="text-center mt-8">
      <p>{{ error }}</p>
    </div>
    <Panel v-else id="p-calendar">
      <template #header>
        <CalendarTickerSelector
          :groupedTickers="groupedTickers"
          v-model="selectedTickers"
        />
      </template>

      <CalendarGrid :dividendsByDate="dividendsByDate" />
    </Panel>
  </div>
</template>

<script setup>
import { ref, watch } from "vue"; // watch 추가
import Panel from "primevue/panel";
import ProgressSpinner from "primevue/progressspinner";
import CalendarTickerSelector from "@/components/CalendarTickerSelector.vue";
import CalendarGrid from "@/components/CalendarGrid.vue";
import { useCalendarData } from "@/composables/useCalendarData.js";

const STORAGE_KEY = "selectedCalendarTickers"; // 동일한 키 사용

const selectedTickers = ref([]);
const { groupedTickers, dividendsByDate, isLoading, error } =
  useCalendarData(selectedTickers);

// 👇 [핵심 수정 2] selectedTickers가 변경될 때마다 localStorage에 저장
watch(
  selectedTickers,
  (newSelection) => {
    // 객체 배열 전체를 저장하는 대신, symbol 문자열 배열만 저장하여 용량을 줄입니다.
    const symbolsToSave = newSelection.map((ticker) => ticker.symbol);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbolsToSave));
  },
  { deep: true }
); // 배열 내부의 변경도 감지하기 위해 deep: true 옵션 사용
</script>
