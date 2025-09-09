<!-- stock\src\pages\HomeView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router';
    import ProgressSpinner from 'primevue/progressspinner';
    import CalendarGrid from '@/components/CalendarGrid.vue';
    import { useCalendarData } from '@/composables/useCalendarData.js';

    useHead({
        title: '배당금 일정',
    });

    // [핵심] useCalendarData에서 holidays를 직접 가져옵니다.
    const { dividendsByDate, holidays, isLoading, error } = useCalendarData();

    const router = useRouter();
    const goToTickerPage = (tickerSymbol) => {
        if (tickerSymbol && typeof tickerSymbol === 'string') {
            router.push(`/${tickerSymbol.toLowerCase()}`);
        }
    };

    // onMounted에서 holidays.json을 fetch하는 로직을 완전히 제거합니다.
</script>

<template>
    <div v-if="isLoading" class="flex justify-center items-center h-screen">
        <ProgressSpinner />
    </div>
    <div v-else-if="error" class="text-center mt-8">
        <p>{{ error }}</p>
    </div>
    <div v-else id="p-calendar">
        <!-- [핵심] props로 holidays ref를 그대로 전달합니다. -->
        <CalendarGrid
            :dividendsByDate="dividendsByDate"
            :holidays="holidays"
            @view-ticker="goToTickerPage" />
    </div>
</template>
