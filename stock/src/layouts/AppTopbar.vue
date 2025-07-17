<!-- layouts/AppTopbar.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { joinURL } from 'ufo';
import AppConfig from "./AppConfig.vue";
import AppSidebar from "./AppSidebar.vue";
import Drawer from 'primevue/drawer';
import { useBreakpoint } from '@/composables/useBreakpoint';
import AutoComplete from 'primevue/autocomplete';
import { useLayout } from "../composables/useLayout";
import { useFilterState } from '@/composables/useFilterState'; // 1. 전역 필터 상태 import

const { isDarkMode, toggleDarkMode } = useLayout();
const { filters } = useFilterState(); // 2. 전역 필터 상태 가져오기

const visible = ref(false);

// AutoComplete를 위한 상태
const allEtfSuggestions = ref([]);
const filteredEtfSuggestions = ref([]);

onMounted(async () => {
    try {
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Navigation data not found');
        const data = await response.json();
        allEtfSuggestions.value = data.nav.map(item => `${item.name} - ${item.fullname}`);
    } catch (err) {
        console.error("Error fetching nav data for Topbar:", err);
    }
});

const searchEtfs = (event) => {
    filteredEtfSuggestions.value = allEtfSuggestions.value.filter(suggestion => 
        suggestion.toLowerCase().includes(event.query.toLowerCase())
    );
};
</script>

<template>
    <div class="topbar-actions">
        <router-link to="/">
            <Button icon="pi pi-home" text rounded />
        </router-link>
        <Button type="button" class="topbar-theme-button" @click="toggleDarkMode" text rounded>
            <i :class="['pi ', 'pi ', { 'pi-moon': isDarkMode, 'pi-sun': !isDarkMode }]" />
        </Button>
        <div class="relative">
            <Button v-styleclass="{
                selector: '@next',
                enterFromClass: 'hidden',
                enterActiveClass: 'animate-scalein',
                leaveToClass: 'hidden',
                leaveActiveClass: 'animate-fadeout',
                hideOnOutsideClick: true,
            }" icon="pi pi-cog" text rounded aria-label="Settings" />
            <AppConfig />
        </div>
        <Button icon="pi pi-bars" class="topbar-theme-button" text rounded @click="visible = true" />

        <Drawer v-model:visible="visible" position="right" class="toto-drawer">
            <!-- 👇 [핵심 수정] Drawer의 #header 슬롯에 검색창을 배치합니다. -->
            <template #header>
                 <div class="p-inputgroup flex-1">
                    <span class="p-inputgroup-addon"><i class="pi pi-search"></i></span>
                     <!-- 3. 전역 필터 상태와 연결 -->
                    <AutoComplete 
                        v-model="filters.global.value"
                        :suggestions="filteredEtfSuggestions" 
                        @complete="searchEtfs"
                        placeholder="티커 또는 종목명 검색"
                        class="w-full"
                    />
                </div>
            </template>
            <!-- AppSidebar에는 이제 props를 전달할 필요가 없습니다. -->
            <AppSidebar />
        </Drawer>
    </div>
</template>