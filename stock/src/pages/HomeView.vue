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
import { ref } from "vue";
import Panel from "primevue/panel";
import ProgressSpinner from "primevue/progressspinner";
import CalendarTickerSelector from "@/components/CalendarTickerSelector.vue";
import CalendarGrid from "@/components/CalendarGrid.vue";
import { useCalendarData } from "@/composables/useCalendarData.js";

const selectedTickers = ref([]);
const { groupedTickers, dividendsByDate, isLoading, error } =
  useCalendarData(selectedTickers);
</script>
