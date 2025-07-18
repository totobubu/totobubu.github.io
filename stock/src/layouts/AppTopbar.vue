<!-- layouts/AppTopbar.vue -->
<script setup>
import { ref } from "vue";
import AppConfig from "./AppConfig.vue";
import AppSidebar from "./AppSidebar.vue";
import Drawer from "primevue/drawer";
import InputText from "primevue/inputtext";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import Button from "primevue/button"; // Clear 버튼을 위해 Button import
import { useLayout } from "../composables/useLayout";
import { useFilterState } from "@/composables/useFilterState";
import { useBreakpoint } from "@/composables/useBreakpoint";

const { deviceType } = useBreakpoint();
const { isDarkMode, toggleDarkMode } = useLayout();
const { filters } = useFilterState();

const visible = ref(false);

// [핵심 수정 1] 클리어 버튼을 위한 함수
const clearGlobalFilter = () => {
  filters.value.global.value = null;
};
</script>

<template>
  <div class="topbar-actions">
    <router-link to="/">
      <Button icon="pi pi-home" text rounded />
    </router-link>
    <Button
      type="button"
      class="topbar-theme-button"
      @click="toggleDarkMode"
      text
      rounded
    >
      <i
        :class="[
          'pi ',
          'pi ',
          { 'pi-moon': isDarkMode, 'pi-sun': !isDarkMode },
        ]"
      />
    </Button>
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
    <Button
      icon="pi pi-bars"
      class="topbar-theme-button"
      text
      rounded
      @click="visible = true"
    />

    <Drawer
      v-model:visible="visible"
      position="right"
      class="toto-drawer"
      :class="deviceType"
    >
      <template #header>
        <div class="flex gap-3">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="value1"
              value="티커"
              readonly
              size="large"
              disabled
            />
          </IconField>
          <InputOtp v-model="filters.global.value" size="large" />
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
