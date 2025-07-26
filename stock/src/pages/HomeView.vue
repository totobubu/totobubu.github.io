<!-- stock/src/views/HomeView.vue -->
<template>
        <div v-if="isLoading" class="flex justify-center items-center h-screen">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-center mt-8">
            <p>{{ error }}</p>
        </div>
        <CalendarGrid  v-else id="t-calendar"
            :dividendsByDate="dividendsByDate" 
            :holidays="holidays"
            :allTickers="allTickers"
            @remove-ticker="removeTicker"
            @view-ticker="goToTickerPage"
        />
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import ProgressSpinner from "primevue/progressspinner";
import CalendarGrid from "@/components/CalendarGrid.vue";
import { useCalendarData } from '@/composables/useCalendarData.js';

const router = useRouter();
const holidays = ref([]);

const { 
    allTickers, 
    dividendsByDate, 
    isLoading, 
    error, 
    loadAllData,
    removeTicker
} = useCalendarData();

const goToTickerPage = (tickerSymbol) => {
    if (tickerSymbol && typeof tickerSymbol === 'string') {
        router.push(`/stock/${tickerSymbol.toLowerCase()}`);
    }
};

onMounted(async () => {
    const holidayResponse = await fetch('/holidays.json');
    holidays.value = await holidayResponse.json();
    
    await loadAllData();
});
</script>