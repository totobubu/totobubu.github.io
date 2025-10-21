<!-- stock\src\pages\CalendarView.vue -->
<script setup>
    import { ref, onMounted, watch } from 'vue';
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useCalendarData } from '@/composables/useCalendarData.js';
    import { useFilterState } from '@/composables/useFilterState.js';

    import Skeleton from 'primevue/skeleton';
    import Panel from 'primevue/panel';
    import Card from 'primevue/card';
    import CalendarGrid from '@/components/CalendarGrid.vue';

    useHead({ title: '배당달력' });

    const holidays = ref([]);
    // [핵심 수정] 임시 데이터를 제거하고, useCalendarData를 다시 활성화합니다.
    const { dividendsByDate, isLoading, error, ensureDataLoaded } =
        useCalendarData();
    const { mainFilterTab } = useFilterState();
    const { isMobile } = useBreakpoint();
    const router = useRouter();

    const goToTickerPage = (tickerSymbol) => {
        if (tickerSymbol && typeof tickerSymbol === 'string') {
            const sanitizedTicker = tickerSymbol.replace(/\./g, '-');
            router.push(`/${sanitizedTicker.toLowerCase()}`);
        }
    };

    const loadHolidays = async (tab) => {
        // [핵심 수정] 북마크, 미국 탭은 미국 휴일, 한국 탭은 한국 휴일을 로드합니다.
        const fileName =
            tab === '한국' ? 'kr_holidays.json' : 'us_holidays.json';
        try {
            const response = await fetch(`/holidays/${fileName}`);
            if (!response.ok) throw new Error(`Failed to fetch ${fileName}`);
            holidays.value = await response.json();
        } catch (e) {
            console.error(`Could not load or parse ${fileName}:`, e);
            holidays.value = [];
        }
    };

    // [핵심 수정] onMounted와 watch를 다시 활성화합니다.
    onMounted(() => {
        ensureDataLoaded();
        loadHolidays(mainFilterTab.value);
    });

    watch(mainFilterTab, (newTab) => {
        loadHolidays(newTab);
    });
</script>

<template>
    <div
        v-if="isLoading && Object.keys(dividendsByDate).length === 0"
        id="p-calendar-skeleton">
        <Card v-if="isMobile">
            <template #header
                ><Skeleton
                    width="10rem"
                    height="1.5rem"
                    class="mx-auto mt-4"></Skeleton
            ></template>
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
            <template #content
                ><Skeleton height="calc(100vh - 15rem)"></Skeleton
            ></template>
        </Card>
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
    #p-calendar-skeleton .p-panel-header,
    #p-calendar-skeleton .p-card-body {
        background-color: var(--surface-card);
    }
    #p-calendar-skeleton .p-panel-content {
        border: 0;
    }
</style>
