<!-- stock\src\pages\CalendarView.vue -->
<script setup>
    import { ref, onMounted, computed } from 'vue';
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import Skeleton from 'primevue/skeleton';
    import Panel from 'primevue/panel';
    import Card from 'primevue/card';
    import CalendarGrid from '@/components/CalendarGrid.vue';
    import { useCalendarData } from '@/composables/useCalendarData.js';

    useHead({ title: '배당달력' });

    const usHolidays = ref([]);
    const krHolidays = ref([]);
    const {
        dividendsByDate,
        isLoading,
        error,
        ensureDataLoaded,
        activeCalendarFilter,
    } = useCalendarData();
    const { isMobile } = useBreakpoint();
    const router = useRouter();

    const goToTickerPage = (tickerSymbol) => {
        if (tickerSymbol && typeof tickerSymbol === 'string') {
            router.push(`/${tickerSymbol.replace(/\./g, '-').toLowerCase()}`);
        }
    };

    const calendarFilterClass = computed(() => {
        const filter = activeCalendarFilter.value;
        if (filter === '북마크') {
            // 북마크에 한국 주식이 포함되어 있는지 여부로 클래스 결정
            const hasKoreanStock = dividendsByDate.value.some(
                (event) => event.currency === 'KRW'
            );
            return hasKoreanStock ? 'filter-kr' : 'filter-us';
        }
        if (filter === '한국주식') return 'filter-kr';
        if (filter === '미국주식') return 'filter-us';
        if (filter === 'ETF') return 'filter-etf';
        return 'filter-us';
    });

    // [핵심 수정] 현재 필터에 맞는 휴일 목록을 동적으로 계산
    const filteredHolidays = computed(() => {
        const filter = activeCalendarFilter.value;

        // 북마크 탭에서는 휴일 표시 안 함
        if (filter === '북마크') {
            return [];
        }
        if (filter === '한국주식') {
            return krHolidays.value;
        }
        // ETF, 미국주식 탭에서는 미국 휴일 표시
        return usHolidays.value;
    });

    onMounted(async () => {
        ensureDataLoaded();
        try {
            const [usResponse, krResponse] = await Promise.all([
                fetch('/holidays/us_holidays.json'),
                fetch('/holidays/kr_holidays.json'),
            ]);
            usHolidays.value = await usResponse.json();
            krHolidays.value = await krResponse.json();
        } catch (e) {
            console.error('Failed to load holiday files:', e);
        }
    });
</script>

<template>
    <div v-if="isLoading" id="p-calendar-skeleton">
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
    <div v-else id="p-calendar" :class="calendarFilterClass">
        <CalendarGrid
            :dividendsByDate="dividendsByDate"
            :holidays="filteredHolidays"
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
