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
            
            <!-- 👇 [핵심 수정] @remove-ticker 이벤트를 수신합니다. -->
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
import { ref, onMounted, watch } from "vue"; // watch 추가
import Panel from "primevue/panel";
import ProgressSpinner from "primevue/progressspinner";
import CalendarTickerSelector from "@/components/CalendarTickerSelector.vue";
import CalendarGrid from "@/components/CalendarGrid.vue";
import { useCalendarData } from '@/composables/useCalendarData.js';


const router = useRouter(); // router 인스턴스 생성
const STORAGE_KEY = 'selectedCalendarTickers';
const selectedTickers = ref([]);
const holidays = ref([]);
const { allTickers, groupedTickers, dividendsByDate, isLoading, error, loadAllData } = 
    useCalendarData(selectedTickers);

const removeTicker = (tickerSymbol) => {
    selectedTickers.value = selectedTickers.value.filter(
        (ticker) => ticker.symbol !== tickerSymbol
    );
};

// 👇 [핵심 수정] 페이지 이동을 처리하는 새로운 함수
const goToTickerPage = (tickerSymbol) => {
    if (tickerSymbol && typeof tickerSymbol === 'string') {
        router.push(`/stock/${tickerSymbol.toLowerCase()}`);
    }
};


onMounted(async () => {
    // holidays.json은 여기서 직접 불러오는 것이 더 간단합니다.
    const holidayResponse = await fetch('/holidays.json');
    holidays.value = await holidayResponse.json();

    // useCalendarData에서 받은 데이터 로딩 함수를 호출합니다.
    await loadAllData();
});

// localStorage 저장을 위한 watch는 그대로 유지합니다.
watch(selectedTickers, (newSelection) => {
    const symbolsToSave = newSelection.map(ticker => ticker.symbol);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbolsToSave));
}, { deep: true });
</script>