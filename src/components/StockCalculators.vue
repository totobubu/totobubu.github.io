<!-- Components/StockCaculators.vue -->
<script setup>
    import { ref } from 'vue';
    import Button from 'primevue/button';
    import Drawer from 'primevue/drawer';
    import SelectButton from 'primevue/selectbutton'; // SelectButton import
    import StockCalculatorsUnified from './calculators/StockCalculatorsUnified.vue';

    defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const isDrawerVisible = ref(false);

    // --- [핵심 수정] 계산기 선택 상태를 부모로 이동 ---
    const activeCalculator = ref('recovery');
    const calculatorOptions = ref([
        { label: '원금 회수', value: 'recovery' },
        { label: '목표 달성', value: 'reinvestment' },
        { label: '예상 배당', value: 'yield' },
    ]);
</script>

<template>
    <div id="t-calculator-button">
        <Button
            icon="pi pi-calculator"
            @click="isDrawerVisible = true"
            severity="secondary"
            text
            aria-label="Calculators" />

        <Drawer
            id="t-stock-calculator"
            v-model:visible="isDrawerVisible"
            position="bottom"
            style="height: auto"
            modal>
            <template #header>
                <!-- [핵심 수정] SelectButton을 header 슬롯으로 이동 -->
                <SelectButton
                    v-model="activeCalculator"
                    :options="calculatorOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full" />
            </template>

            <!-- [핵심 수정] activeCalculator를 prop으로 전달 -->
            <StockCalculatorsUnified
                :active-calculator="activeCalculator"
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
        </Drawer>
    </div>
</template>
