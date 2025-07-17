<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useLayout } from "../composables/useLayout";
import AppConfig from "./AppConfig.vue";
import AppSidebar from "./AppSidebar.vue";
import Drawer from 'primevue/drawer';
import { useBreakpoint } from '@/composables/useBreakpoint';

// useBreakpoint를 호출하여 반응형 상태를 가져옵니다.
const { deviceType } = useBreakpoint();

const { isDarkMode, toggleDarkMode } = useLayout();
const router = useRouter();

const visible = ref(false);
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

        <div class="card flex justify-center">
            <Drawer v-model:visible="visible" position="right" class="toto-drawer" :class="deviceType">
                <AppSidebar />
            </Drawer>
        </div>
    </div>
</template>
