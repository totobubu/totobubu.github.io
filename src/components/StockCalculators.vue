<!-- StockCaculators.vue -->
<script setup>
    import { ref } from 'vue';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    // PrimeVue 컴포넌트 import
    import Card from 'primevue/card';
    import Button from 'primevue/button';
    import Drawer from 'primevue/drawer';

    // 하위 컴포넌트 import
    import RecoveryCalculator from './calculators/RecoveryCalculator.vue';
    import ReinvestmentCalculator from './calculators/ReinvestmentCalculator.vue';
    import DividendYieldCalculator from './calculators/DividendYieldCalculator.vue';

    const { deviceType } = useBreakpoint();
    defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const activeTab = ref('0');
    const visibleRecovery = ref(false);
    const visibleReinvestment = ref(false);
    const visibleDividendYield = ref(false);
</script>

<template>
    <div>
        <Card id="t-calculator">
            <template #content>
                <div
                    class="flex justify-content-center items-center"
                    :class="
                        deviceType === 'mobile'
                            ? 'flex-column gap-2'
                            : 'flex-col gap-2'
                    ">
                    <Button
                        label="투자금 회수 기간"
                        icon="pi pi-refresh"
                        severity="secondary"
                        @click="visibleRecovery = true" />
                    <Button
                        label="목표 달성 기간"
                        icon="pi pi-chart-line"
                        severity="secondary"
                        @click="visibleReinvestment = true" />
                    <Button
                        label="얼마나 배당"
                        icon="pi pi-dollar"
                        severity="secondary"
                        @click="visibleDividendYield = true" />
                </div>
            </template>
        </Card>
        <Drawer
            v-model:visible="visibleRecovery"
            header="투자 원금 회수 기간 계산기"
            position="bottom"
            style="height: auto"
            modal
            :class="
                deviceType === 'desktop' ? 'toto-grid-row' : 'toto-grid-column'
            "
            id="calculator-recovery">
            <RecoveryCalculator
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
        </Drawer>
        <Drawer
            v-model:visible="visibleReinvestment"
            header="목표 달성 기간 계산기"
            position="bottom"
            style="height: auto"
            modal
            :class="
                deviceType === 'desktop' ? 'toto-grid-row' : 'toto-grid-column'
            "
            id="calculator-reinvestment">
            <ReinvestmentCalculator
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
        </Drawer>
        <Drawer
            v-model:visible="visibleDividendYield"
            header="얼마나 배당 계산기"
            position="bottom"
            style="height: auto"
            modal
            :class="
                deviceType === 'desktop' ? 'toto-grid-row' : 'toto-grid-column'
            "
            id="calculator-reinvestment">
            <DividendYieldCalculator
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
        </Drawer>
    </div>
</template>
