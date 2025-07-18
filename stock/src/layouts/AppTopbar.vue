<!-- layouts/AppTopbar.vue -->
<script setup>
import { ref, watch, computed } from "vue";
import AppConfig from "./AppConfig.vue";
import AppSidebar from "./AppSidebar.vue";
import Drawer from "primevue/drawer";
import InputText from "primevue/inputtext";
import InputOtp from "primevue/inputotp";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
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
</script>

<template>
    <div class="topbar-actions">
        <router-link to="/">
            <Button icon="pi pi-home" text rounded />
        </router-link>
        <div class="relative">
            <Button
                v-styleclass="{
                    selector: '@next',
                    enterFromClass: 'hidden',
                    enterActiveClass: 'animate-scalein',
                    leaveToClass: 'hidden',
                    leaveActiveClass: 'animate-fadeout',
                    hideOnOutsideClick: true,
                }"
                icon="pi pi-cog"
                text
                rounded
                aria-label="Settings"
            />
            <AppConfig />
        </div>
        <Button icon="pi pi-bars" text rounded @click="visible = true" />

        <Drawer v-model:visible="visible" position="right" :modal="true" class="toto-drawer" :class="deviceType">
            <template #header>
                <div class="flex gap-3">
                    <Button icon="pi pi-search" severity="secondary" aria-label="Search" :size="responsiveSize" v-if="isMobile" />
                    <IconField v-else>
                        <InputIcon class="pi pi-search" :size="responsiveSize" />
                        <InputText v-model="value1" value="티커" readonly :size="responsiveSize" disabled />
                    </IconField>
                    <InputOtp v-model="filters.global.value" :size="responsiveSize" />
                    <Button
                        v-if="filters.global.value"
                        icon="pi pi-times"
                        text
                        rounded
                        severity="secondary"
                        @click="clearGlobalFilter"
                    />
                </div>
            </template>
            <AppSidebar />
        </Drawer>
    </div>
</template>