<!-- stock\src\pages\HomeView.vue -->
<script setup>
    import { ref, onMounted } from 'vue';
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router'; // useRouter import 추가

    import Panel from 'primevue/panel';
    import ProgressSpinner from 'primevue/progressspinner';

    import CalendarGrid from '@/components/CalendarGrid.vue';
    import { useCalendarData } from '@/composables/useCalendarData.js';

    useHead({
        title: '배당금 일정',
    });

    const holidays = ref([]);
    // useCalendarData에서 필요한 것만 가져옵니다.
    const { dividendsByDate, isLoading, error } = useCalendarData();

    const router = useRouter();
    const goToTickerPage = (tickerSymbol) => {
        if (tickerSymbol && typeof tickerSymbol === 'string') {
            router.push(`/${tickerSymbol.toLowerCase()}`);
        }
    };

    onMounted(async () => {
        const holidayResponse = await fetch('/holidays.json');
        holidays.value = await holidayResponse.json();
    });
</script>

<template>
    <div v-if="isLoading" class="flex justify-center items-center h-screen">
        <ProgressSpinner />
    </div>
    <div v-else-if="error" class="text-center mt-8">
        <p>{{ error }}</p>
    </div>
    <div v-else id="p-calendar">
        <!-- CalendarGrid에 더 이상 필요없는 props를 전달하지 않습니다. -->
        <CalendarGrid
            :dividendsByDate="dividendsByDate"
            :holidays="holidays"
            @view-ticker="goToTickerPage" />
    </div>
</template>
