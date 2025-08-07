<!-- StockCaculators.vue -->
<script setup>
    import { ref } from 'vue';
    import Card from 'primevue/card';
    import Tabs from 'primevue/tabs';
    import TabList from 'primevue/tablist';
    import Tab from 'primevue/tab';
    import TabPanels from 'primevue/tabpanels';
    import TabPanel from 'primevue/tabpanel';
    import RecoveryCalculator from './calculators/RecoveryCalculator.vue';
    import ReinvestmentCalculator from './calculators/ReinvestmentCalculator.vue';

    import { useBreakpoint } from '@/composables/useBreakpoint';
    const { deviceType } = useBreakpoint();
    defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
    });

    const activeTab = ref('0');
    const visibleRecovery = ref(false);
    const visibleReinvestment = ref(false);
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
                    "
                >
                    <Button
                        label="투자금 회수 기간 계산기"
                        icon="pi pi-refresh"
                        severity="secondary"
                        @click="visibleRecovery = true"
                    />
                    <Button
                        label="목표 달성 기간 계산기"
                        icon="pi pi-chart-line"
                        severity="secondary"
                        @click="visibleReinvestment = true"
                    />
                </div>
            </template>
        </Card>
        <Dialog
            v-model:visible="visibleRecovery"
            modal
            :style="{ width: '600px' }"
            :breakpoints="{ '640px': '90vw' }"
            id="calculator-recovery"
        >
            <RecoveryCalculator
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
            />
        </Dialog>
        <Dialog
            v-model:visible="visibleReinvestment"
            modal
            :style="{ width: '600px' }"
            :breakpoints="{ '640px': '90vw' }"
            id="calculator-reinvestment"
        >
            <ReinvestmentCalculator
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
            />
        </Dialog>
    </div>
</template>
<!-- 
<style scoped>
    .chart-container-mobile {
        position: relative;
        height: 250px;
    }
    .chart-container-desktop {
        position: relative;
        height: 300px;
    }
</style> -->
