<script setup>
import { ref, watch, computed } from "vue";
import { RouterView, useRoute, useRouter } from 'vue-router';
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
const { groupedTickers, selectedTickers } = useCalendarData();

const visible = ref(false);
const visible2 = ref(false);
const route = useRoute();
const isHomePage = computed(() => route.path === '/');

const home = ref({
    icon: 'pi pi-home',
    route: '/'
});
const items = ref([
    { label: 'company' },
    { label: 'stock', route: '/inputtext' }
]);

watch(visible, (newValue) => {
    if (newValue) {
        document.body.classList.add("p-overflow-hidden");
    } else {
        document.body.classList.remove("p-overflow-hidden");
    }
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
                <Breadcrumb :home="home" :model="items" id="t-breadcrumb" v-if="!isHomePage">
                    <template #item="{ item, props }">
                        <router-link v-if="item.route" v-slot="{ href, navigate }" :to="item.route" custom>
                            <a :href="href" v-bind="props.action" @click="navigate">
                                <span :class="[item.icon, 'text-color']"></span>
                                <span class="text-primary font-semibold">{{ item.label }}</span>
                            </a>
                        </router-link>
                        <a v-else :href="item.url" :target="item.target" v-bind="props.action">
                            <span class="text-surface-700 dark:text-surface-0">{{ item.label }}</span>
                        </a>
                    </template>
                </Breadcrumb>
                <p class="text font-bold" v-else>배당금 일정</p>

                <div id="t-topbar" class="topbar-actions">
                    <router-link to="/" v-if="!isHomePage">
                        <Button icon="pi pi-home" severity="contrast"></Button>
                    </router-link>
                    <Button v-if="deviceType !== 'desktop'" icon="pi pi-bars" severity="contrast"
                        @click="visible = true"></Button>
                </div>
            </header>
            <section id="t-content">
                <div v-if="deviceType !== 'desktop' && isHomePage">
                    <Button id="t-calendar-search-button" label="배당금 검색" icon="pi pi-filter" severity="contrast" @click="visible2 = true" />
                </div>
                <RouterView />
            </section>
        </main>

        <Drawer v-if="deviceType !== 'desktop'" v-model:visible="visible"
            :position="deviceType === 'mobile' ? 'full' : 'right'" :modal="true" class="toto-drawer"
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
            :position="deviceType === 'mobile' ? 'full' : 'right'" :modal="true" id="toto-search" :class="deviceType">
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