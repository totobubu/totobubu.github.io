<!-- src\components\calculators\CalculatorLayout.vue -->
<script setup>
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import Divider from 'primevue/divider';

    const { deviceType } = useBreakpoint();
</script>

<template>
    <div
        class="toto-calculator-grid"
        :class="
            deviceType === 'desktop'
                ? 'toto-calculator-grid-row'
                : 'toto-calculator-grid-column'
        ">
        <div class="toto-calculator-option">
            <!-- 입력 필드가 이 슬롯에 들어옵니다 -->
            <slot name="options"></slot>
        </div>

        <Divider v-if="deviceType !== 'desktop'" />

        <div class="toto-calculator-result flex-1">
            <!-- 결과(Card 컴포넌트 포함)가 이 슬롯에 들어옵니다 -->
            <slot name="results"></slot>
        </div>
    </div>
</template>
