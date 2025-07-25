<!-- stock/src/layouts/TotoLayout.vue -->
<script setup>
import { ref, watch, computed } from "vue";

import { RouterView } from 'vue-router';
import AppSidebar from "./AppSidebar.vue";
import Drawer from "primevue/drawer";
import Card from "primevue/card";
import InputOtp from "primevue/inputotp"; // InputOtp만 사용
import Button from "primevue/button";
import { useFilterState } from "@/composables/useFilterState";
import { useBreakpoint } from "@/composables/useBreakpoint";

const { deviceType, isDesktop, isMobile } = useBreakpoint();
const { filters } = useFilterState();
const visible = ref(false);

const clearGlobalFilter = () => {
  filters.value.global.value = null;
};

watch(visible, (newValue) => {
  if (newValue) {
    document.body.classList.add("p-overflow-hidden");
  } else {
    document.body.classList.remove("p-overflow-hidden");
  }
});

const responsiveSize = computed(() => {
  if (isMobile.value) {
    return "small";
  } else if (isDesktop.value) {
    return "large";
  } else {
    return null;
  }
});


const home = ref({
    icon: 'pi pi-home',
    route: '/'
});
const items = ref([
    { label: 'company' },
    { label: 'stock', route: '/inputtext' }
]);
</script>

<template>
    <!-- 
      이제 이 최상위 div는 화면 크기에 따라 
      'mobile', 'tablet', 'desktop' 클래스를 동적으로 갖게 됩니다. 
    -->
    <!-- <div class="layout-container" :class="deviceType">
        <div class="layout-grid">
            <AppTopbar />
            <RouterView />
        </div>
    </div> -->


    <div id="t-layout">
        <aside id="t-sidebar" v-if="deviceType === 'desktop'">
            <header>
                <div class="flex-auto flex items-center gap-2">
                    <Button icon="pi pi-search" disabled title="티커검색"></Button>
                    <InputOtp v-model="filters.global.value" :length="4" :size="responsiveSize" id="ticker-otp" />
                    <Button v-if="filters.global.value" icon="pi pi-times" text rounded severity="secondary"
                        @click="clearGlobalFilter" aria-label="Clear Filter"></Button>
                </div>
            </header>
            <article>
                 <AppSidebar />
            </article>
        </aside>
        <main id="t-grid">
            <header id="t-header">
                <Breadcrumb :home="home" :model="items" id="t-breadcrumb">
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
                <div id="t-topbar" class="topbar-actions">
                    <router-link to="/">
                        <Button icon="pi pi-home" severity="contrast"></Button>
                    </router-link>

                    <Button v-if="deviceType !== 'desktop'" 
                    icon="pi pi-bars" severity="contrast" @click="visible = true"></Button>
                </div>
            </header>
            <section id="t-content">
                <RouterView />
            </section>
        </main>
        <Drawer v-if="deviceType !== 'desktop'" v-model:visible="visible" :position="deviceType === 'mobile' ? 'full' : 'right'" :modal="true" class="toto-drawer" :class="deviceType">
            <template #header>
                <div class="flex-auto flex items-center gap-2">
                    <Button icon="pi pi-search" disabled title="티커검색"></Button>
                    <InputOtp v-model="filters.global.value" :length="4" :size="responsiveSize" id="ticker-otp" />
                    <Button v-if="filters.global.value" icon="pi pi-times" text rounded severity="secondary"
                        @click="clearGlobalFilter" aria-label="Clear Filter"></Button>
                </div>
            </template>
            <AppSidebar />
        </Drawer>
        
    </div>

    
</template>