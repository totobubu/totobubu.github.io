<!-- stock/src/layouts/Layout.vue -->
<script setup>
import { RouterView } from 'vue-router';
import AppTopbar from "./AppTopbar.vue";
import { useBreakpoint } from '@/composables/useBreakpoint';

// useBreakpoint를 호출하여 반응형 상태를 가져옵니다.
const { deviceType } = useBreakpoint();
</script>

<template>
    <!-- 
      이제 이 최상위 div는 화면 크기에 따라 
      'mobile', 'tablet', 'desktop' 클래스를 동적으로 갖게 됩니다. 
    -->
    <div class="layout-container" :class="deviceType">
        <div class="layout-grid">
            <AppTopbar />
            <RouterView />
        </div>
    </div>
</template>