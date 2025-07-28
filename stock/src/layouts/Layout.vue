<script setup>
import { ref, watch, computed } from "vue";
import { RouterView, useRoute } from 'vue-router';
import AppSidebar from "./AppSidebar.vue";
import TickerSelector from "@/components/CalendarTickerSelector.vue";
import FilterInput from "@/components/FilterInput.vue";
import Drawer from "primevue/drawer";
import Button from "primevue/button";
import Breadcrumb from "primevue/breadcrumb";
import { useFilterState } from "@/composables/useFilterState";
import { useBreakpoint } from "@/composables/useBreakpoint";
import { useCalendarData } from '@/composables/useCalendarData.js';

const { deviceType, isDesktop, isMobile } = useBreakpoint();
const { filters } = useFilterState();
const { groupedTickers, selectedTickers, allTickers } = useCalendarData();

const visible = ref(false);
const visible2 = ref(false);
const route = useRoute();
const isHomePage = computed(() => route.path === '/');

const breadcrumbItems = computed(() => {
    const items = [];

    // stock 상세 페이지일 경우 (e.g., /stock/tslw)
    if (route.name === 'stock-detail' && route.params.ticker) {
        const currentTickerSymbol = route.params.ticker.toUpperCase();
        const tickerInfo = allTickers.value.find(t => t.symbol === currentTickerSymbol);

        if (tickerInfo) {
            // 운용사 항목 (링크 없음)
            items.push({ label: tickerInfo.company });
            // 티커 항목 (현재 페이지 링크)
            items.push({ label: currentTickerSymbol, to: route.path });
        } else {
            // tickerInfo를 아직 못 찾았을 경우 (데이터 로딩 중 등) 대비
            items.push({ label: 'Stock' });
            items.push({ label: currentTickerSymbol, to: route.path });
        }
    }
    // 다른 종류의 서브 페이지가 추가될 경우 여기에 로직 추가
    // else if (route.path.startsWith('/other-page')) { ... }

    return [...items];
});

watch(visible, (newValue) => {
    if (newValue) {
        document.body.classList.add("p-overflow-hidden");
    } else {
        document.body.classList.remove("p-overflow-hidden");
    }
});

watch(() => route.path, () => {
    visible.value = false;
    visible2.value = false;
});
</script>

<template>
    <div id="t-layout">
        <aside id="t-sidebar" v-if="deviceType === 'desktop'">
            <header>
                <FilterInput 
                    v-if="isHomePage" 
                    v-model="filters.calendarSearch.value" 
                    title="달력 티커 검색"
                    filter-type="calendar"
                />
                <FilterInput 
                    v-else 
                    v-model="filters.global.value" 
                    title="전체 티커 검색"
                    filter-type="global"
                />
            </header>
            <TickerSelector v-if="isHomePage" :groupedTickers="groupedTickers" v-model="selectedTickers" />
            <AppSidebar v-else />
        </aside>

        <main id="t-grid">
            <header id="t-header">
                <Breadcrumb :model="breadcrumbItems" id="t-breadcrumb" v-if="!isHomePage">
                    <template #item="{ item, props }">
                        <router-link v-if="item.to" v-slot="{ href, navigate }" :to="item.to" custom>
                            <a :href="href" v-bind="props.action" @click="navigate">
                                <span :class="[item.icon, 'text-color']"></span>
                                <span class="font-semibold" :class="{'text-primary': route.path === item.to}">{{ item.label }}</span>
                            </a>
                        </router-link>
                        <span v-else class="text-surface-700 dark:text-surface-0">{{ item.label }}</span>
                    </template>
                </Breadcrumb>
                <p class="text font-bold" v-else>배당금 일정</p>

                <div id="t-topbar" class="topbar-actions">
                    <router-link to="/" v-if="!isHomePage">
                        <Button icon="pi pi-home" variant="text"></Button>
                    </router-link>
                    <Button v-if="deviceType !== 'desktop'" icon="pi pi-bars" variant="text"
                        @click="visible = true"></Button>
                </div>
            </header>
            <section id="t-content">
                <div v-if="deviceType !== 'desktop' && isHomePage">
                    <Button id="t-calendar-search-button" label="배당금 검색" icon="pi pi-filter" variant="text" @click="visible2 = true" />
                </div>
                <RouterView />
            </section>
        </main>

        <Drawer v-if="deviceType !== 'desktop'" v-model:visible="visible"
            :position="deviceType === 'mobile' ? 'full' : 'right'" :modal="true" id="toto-search"
            :class="deviceType">
            <template #header>
                <FilterInput 
                    v-model="filters.global.value" 
                    title="전체 티커 검색" 
                    filter-type="global"
                />
            </template>
            <AppSidebar />
        </Drawer>

        <Drawer v-if="deviceType !== 'desktop' && isHomePage" v-model:visible="visible2"
            :position="deviceType === 'mobile' ? 'full' : 'right'" :modal="true" id="toto-filter" :class="deviceType">
             <template #header>
                <FilterInput 
                    v-model="filters.calendarSearch.value" 
                    title="달력 티커 검색" 
                    filter-type="calendar"
                />
            </template>
            <TickerSelector :groupedTickers="groupedTickers" v-model="selectedTickers" />
        </Drawer>
    </div>
</template>