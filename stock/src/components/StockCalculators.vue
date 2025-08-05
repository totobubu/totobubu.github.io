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

    defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
    });

    const activeTab = ref('0');
</script>

<template>
    <Card id="t-calculator">
        <template #content>
            <Tabs v-model:value="activeTab" class="p-tabs-calculator">
                <TabList id="t-calculator-tabs">
                    <Tab value="0"
                        ><i class="pi pi-replay mr-2"></i>
                        <span>원금 회수 기간</span></Tab
                    >
                    <Tab value="1"
                        ><i class="pi pi-chart-line mr-2"></i>
                        <span>목표 달성 기간</span></Tab
                    >
                </TabList>
                <TabPanels>
                    <TabPanel value="0">
                        <RecoveryCalculator
                            v-if="activeTab === '0'"
                            :dividendHistory="dividendHistory"
                            :tickerInfo="tickerInfo"
                        />
                    </TabPanel>
                    <TabPanel value="1">
                        <ReinvestmentCalculator
                            v-if="activeTab === '1'"
                            :dividendHistory="dividendHistory"
                            :tickerInfo="tickerInfo"
                        />
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </template>
    </Card>
</template>

<style scoped>
    .chart-container-mobile {
        position: relative;
        height: 250px;
    }
    .chart-container-desktop {
        position: relative;
        height: 300px;
    }
</style>
