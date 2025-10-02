<!-- stock\src\pages\CalendarView.vue -->
<script setup>
    import { ref, onMounted } from 'vue';
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router';
    import { useBreakpoint } from '@/composables/useBreakpoint'; // [신규] useBreakpoint import

    import Skeleton from 'primevue/skeleton'; // [신규] Skeleton import
    import Panel from 'primevue/panel'; // [신규] Panel import for skeleton layout
    import Card from 'primevue/card'; // [신규] Card import for skeleton layout

    import CalendarGrid from '@/components/CalendarGrid.vue';
    import { useCalendarData } from '@/composables/useCalendarData.js';

    useHead({
        title: '배당달력',
    });

    const holidays = ref([]);
    const { dividendsByDate, isLoading, error, ensureDataLoaded } =
        useCalendarData();
    const { isMobile } = useBreakpoint(); // [신규] isMobile 가져오기

    const router = useRouter();
    const goToTickerPage = (tickerSymbol) => {
        if (tickerSymbol && typeof tickerSymbol === 'string') {
            const sanitizedTicker = tickerSymbol.replace(/\./g, '-');
            router.push(`/${sanitizedTicker.toLowerCase()}`);
        }
    };

    onMounted(async () => {
        ensureDataLoaded();

        const holidayResponse = await fetch('/holidays.json');
        holidays.value = await holidayResponse.json();
    });
</script>

<template>
    <!-- [핵심 수정] 로딩 상태 UI 변경 -->
    <div v-if="isLoading" id="p-calendar-skeleton">
        <!-- 모바일용 스켈레톤 -->
        <Card v-if="isMobile">
            <template #header>
                <Skeleton
                    width="10rem"
                    height="1.5rem"
                    class="mx-auto mt-4"></Skeleton>
            </template>
            <template #title>
                <div class="flex justify-content-center">
                    <Skeleton
                        shape="circle"
                        size="2rem"
                        class="mx-2"></Skeleton>
                    <Skeleton
                        width="5rem"
                        height="2rem"
                        class="mx-2"></Skeleton>
                    <Skeleton
                        shape="circle"
                        size="2rem"
                        class="mx-2"></Skeleton>
                </div>
            </template>
            <template #content>
                <Skeleton height="calc(100vh - 15rem)"></Skeleton>
            </template>
        </Card>
        <!-- 데스크탑용 스켈레톤 -->
        <Panel v-else>
            <template #header>
                <div class="flex justify-content-between w-full">
                    <Skeleton width="5rem" height="2.5rem"></Skeleton>
                    <div class="flex align-items-center gap-2">
                        <Skeleton width="3rem" height="1.5rem"></Skeleton>
                        <Skeleton width="8rem" height="1.5rem"></Skeleton>
                        <Skeleton width="3rem" height="1.5rem"></Skeleton>
                    </div>
                    <Skeleton width="8rem" height="2.5rem"></Skeleton>
                </div>
            </template>
            <Skeleton height="calc(100vh - 10rem)"></Skeleton>
        </Panel>
    </div>

    <div v-else-if="error" class="text-center mt-8">
        <p>{{ error }}</p>
    </div>

    <div v-else id="p-calendar">
        <CalendarGrid
            :dividendsByDate="dividendsByDate"
            :holidays="holidays"
            @view-ticker="goToTickerPage" />
    </div>
</template>

<style scoped>
    /* 스켈레톤 레이아웃을 위한 스타일 */
    #p-calendar-skeleton .p-panel-header,
    #p-calendar-skeleton .p-card-body {
        background-color: var(--surface-card);
    }
    #p-calendar-skeleton .p-panel-content {
        border: 0;
    }
</style>
