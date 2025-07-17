<!-- layouts/AppTopbar.vue -->
<script setup>
import { ref } from "vue";
import AppConfig from "./AppConfig.vue";
import AppSidebar from "./AppSidebar.vue";
import Drawer from "primevue/drawer";
import InputText from "primevue/inputtext"; // AutoComplete 대신 InputText 사용
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import { useLayout } from "../composables/useLayout";
import { useFilterState } from "@/composables/useFilterState"; // 전역 필터 상태만 import

const { isDarkMode, toggleDarkMode } = useLayout();
const { filters } = useFilterState(); // 전역 필터 상태만 가져옴

const visible = ref(false);
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

    <Drawer v-model:visible="visible" position="right" class="toto-drawer">
      <template #header>
        <IconField iconPosition="left" class="w-full">
          <InputIcon class="pi pi-search" />
          <!-- 👇 [핵심 수정] AutoComplete를 기본 InputText로 변경 -->
          <InputText
            v-model="filters.global.value"
            placeholder="티커 검색"
            autofocus
          />
        </IconField>
      </template>
      <AppSidebar />
    </Drawer>
  </div>
</template>
