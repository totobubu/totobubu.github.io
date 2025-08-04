<script setup>
    import { ref, onMounted } from 'vue'
    import Panel from 'primevue/panel'
    import ProgressSpinner from 'primevue/progressspinner'
    import CalendarGrid from '@/components/CalendarGrid.vue'
    import { useCalendarData } from '@/composables/useCalendarData.js'

    const holidays = ref([])
    const { allTickers, dividendsByDate, isLoading, error, removeTicker } =
        useCalendarData()

    const router = useRouter()
    const goToTickerPage = (tickerSymbol) => {
        if (tickerSymbol && typeof tickerSymbol === 'string') {
            router.push(`/stock/${tickerSymbol.toLowerCase()}`)
        }
    }

    onMounted(async () => {
        const holidayResponse = await fetch('/holidays.json')
        holidays.value = await holidayResponse.json()
        // loadAllData() 호출은 이제 Layout.vue가 담당하므로 여기서 제거합니다.
    })
</script>

<template>
    <div
        v-if="isLoading"
        class="flex justify-center items-center h-screen"
    >
        <ProgressSpinner />
    </div>
    <div
        v-else-if="error"
        class="text-center mt-8"
    >
        <p>{{ error }}</p>
    </div>
    <div
        v-else
        id="p-calendar"
    >
        <CalendarGrid
            :dividendsByDate="dividendsByDate"
            :holidays="holidays"
            :allTickers="allTickers"
            @remove-ticker="removeTicker"
            @view-ticker="goToTickerPage"
        />
    </div>
</template>
