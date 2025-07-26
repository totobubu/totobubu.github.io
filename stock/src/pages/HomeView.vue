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
            <CalendarGrid 
                :dividendsByDate="dividendsByDate" 
                :holidays="holidays"
                :allTickers="allTickers"
                @remove-ticker="removeTicker"
                @view-ticker="goToTickerPage"
            />
        </Panel>
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import Panel from "primevue/panel";
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