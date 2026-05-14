<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useHead } from '@vueuse/head';
import { useRouter } from 'vue-router';
import { useCalendarData } from '@/composables/data/useCalendarData';
import { useFilterState } from '@/composables/portfolio/useFilterState';
import { getRouteParamsFromSymbol } from '@/utils/tickerRoute';

import LoadingOverlay from '@/components/common/LoadingOverlay.vue';
import CalendarGrid from '@/components/CalendarGrid.vue';
import ScheduleList from '@/components/ScheduleList.vue';

useHead({ title: '배당달력' });

const holidays = ref([]);
const { dividendsByDate, isLoading, error, ensureDataLoaded } = useCalendarData();
const { mainFilterTab, isBookmarksLoading } = useFilterState();
const router = useRouter();

const selectedDateStr = ref(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local

const goToTickerPage = (tickerSymbol) => {
    if (!tickerSymbol || typeof tickerSymbol !== 'string') return;
    const params = getRouteParamsFromSymbol(tickerSymbol);
    if (params) router.push({ name: 'stock-detail', params });
};

const handleSelectDate = (dateStr) => {
    selectedDateStr.value = dateStr;
};

const loadHolidays = async () => {
    const fileName = 'us_holidays.json';
    try {
        const response = await fetch(`/holidays/${fileName}`);
        if (!response.ok) throw new Error(`Failed to fetch ${fileName}`);
        holidays.value = await response.json();
    } catch (e) {
        console.error(`Could not load or parse ${fileName}:`, e);
        holidays.value = [];
    }
};

onMounted(() => {
    ensureDataLoaded();
    loadHolidays();
});

watch(mainFilterTab, () => {
    loadHolidays();
});

</script>

<template>
    <LoadingOverlay
        :visible="
            (isLoading && Object.keys(dividendsByDate).length === 0) ||
            (mainFilterTab === '북마크' && isBookmarksLoading)
        "
        :message="
            mainFilterTab === '북마크'
                ? '북마크 데이터를 불러오는 중...'
                : '달력 데이터를 불러오는 중...'
        " />

    <div v-if="error" class="text-center mt-8 text-negative font-bold">
        <p>{{ error }}</p>
    </div>
    
    <div v-else id="p-calendar" class="calendar-page-layout">
        <div class="calendar-section">
            <CalendarGrid
                :dividendsByDate="dividendsByDate"
                :holidays="holidays"
                :selectedDateStr="selectedDateStr"
                @select-date="handleSelectDate" />
        </div>
        
        <div class="schedule-section">
            <ScheduleList 
                :selectedDateStr="selectedDateStr"
                :dividendsByDate="dividendsByDate"
                @view-ticker="goToTickerPage" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.calendar-page-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100vh;
    background-color: var(--p-surface-0);
    color: var(--p-text-color);
}

.calendar-section {
    flex: 1;
    padding: 1rem;
    border-bottom: 1px solid var(--p-surface-200);
}

.schedule-section {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
}

/* Desktop layout */
@media (min-width: 1024px) {
    .calendar-page-layout {
        flex-direction: row;
        align-items: flex-start;
    }
    .calendar-section {
        flex: 0 0 450px;
        border-bottom: none;
        border-right: 1px solid var(--p-surface-200);
        padding: 2rem;
        position: sticky;
        top: 0;
        max-height: 100vh;
        overflow-y: auto;
    }
    .schedule-section {
        flex: 1;
        padding: 2rem;
    }
}
</style>
