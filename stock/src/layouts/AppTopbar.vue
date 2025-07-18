<!-- layouts/AppTopbar.vue -->
<script setup>
import { ref, watch } from "vue"; // watch를 import에 추가
import AppConfig from "./AppConfig.vue";
import AppSidebar from "./AppSidebar.vue";
import Drawer from "primevue/drawer";
import InputText from "primevue/inputtext";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import Button from "primevue/button";
import { useLayout } from "../composables/useLayout";
import { useFilterState } from "@/composables/useFilterState";
import { useBreakpoint } from "@/composables/useBreakpoint";

const { deviceType } = useBreakpoint();
const { isDarkMode, toggleDarkMode } = useLayout();
const { filters } = useFilterState();

const visible = ref(false); // Drawer의 표시 상태
const { isDesktop, isMobile } = useBreakpoint();

const clearGlobalFilter = () => {
  filters.value.global.value = null;
};

// 👇 [핵심 수정] Drawer의 visible 상태를 감시하는 watch를 추가합니다.
watch(visible, (newValue) => {
  if (newValue) {
    // Drawer가 열리면, body에 'p-overflow-hidden' 클래스를 추가하여 스크롤을 막습니다.
    document.body.classList.add("p-overflow-hidden");
  } else {
    // Drawer가 닫히면, body에서 클래스를 제거하여 스크롤을 다시 활성화합니다.
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
    <Button icon="pi pi-bars" text rounded @click="visible = true" />

    <!-- 
            v-model:visible="visible"에 의해 visible ref와 동기화됩니다.
            :modal="true" 속성을 추가하면 배경 클릭 시 닫히고, 접근성이 향상됩니다.
            PrimeVue의 Drawer는 기본적으로 modal일 때 스크롤을 제어하지만,
            우리의 복잡한 레이아웃에서는 수동 제어가 더 확실할 수 있습니다.
        -->
    <Drawer
      v-model:visible="visible"
      position="right"
      :modal="true"
      class="toto-drawer"
      :class="deviceType"
    >
      <template #header>
        <div class="flex gap-3">
          <IconField>
            <InputIcon class="pi pi-search" :size="responsiveSize" />
            <InputText
              v-model="value1"
              value="티커"
              readonly
              :size="responsiveSize"
              disabled
            />
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
