<!-- src\components\calculators\CalculatorLayout.vue -->
<script setup>
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import Divider from 'primevue/divider';

    const { deviceType } = useBreakpoint();
</script>

<template>
    <div
        class="flex"
        :class="deviceType === 'mobile' ? 'flex-column' : 'flex-row'">
        <!-- 옵션 영역: 각 입력 필드를 위한 세분화된 슬롯 -->
        <div class="calculator-option">
            <slot name="avgPriceAndQuantity"></slot>
            <slot name="investmentPrincipalAndCurrentValue"></slot>

            <!-- Recovery Calculator Slots -->
            <slot name="accumulatedDividend"></slot>

            <!-- Reinvestment Calculator Slots -->
            <slot name="targetAsset"></slot>
            <slot name="annualGrowthRate"></slot>

            <!-- Yield Calculator Slots -->
            <slot name="priceInfo"></slot>
            <slot name="investmentAmount"></slot>

            <!-- Shared Slots -->
            <slot name="periodSelect"></slot>
            <slot name="taxSelect"></slot>
        </div>

        <Divider v-if="deviceType !== 'desktop'" />

        <!-- 결과 영역: 테이블과 차트를 위한 분리된 슬롯 -->
        <div class="calculator-result">
            <slot name="resultsTable"></slot>
            <slot name="resultsChart"></slot>
        </div>
    </div>
</template>
