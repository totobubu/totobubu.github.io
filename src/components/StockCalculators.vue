<!-- Components/StockCaculators.vue -->
<script setup>
    import { ref } from 'vue';
    import Button from 'primevue/button';
    import Drawer from 'primevue/drawer';
    import Menu from 'primevue/menu';

    import RecoveryCalculator from './calculators/RecoveryCalculator.vue';
    import ReinvestmentCalculator from './calculators/ReinvestmentCalculator.vue';
    import DividendYieldCalculator from './calculators/DividendYieldCalculator.vue';

    defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const visibleDrawer = ref(null);
    const menu = ref();

    const openDrawer = (drawerName) => {
        visibleDrawer.value = drawerName;
    };

    const items = ref([
        {
            label: '투자금 회수 기간',
            icon: 'pi pi-refresh',
            command: () => openDrawer('recovery'),
        },
        {
            label: '목표 달성 기간',
            icon: 'pi pi-chart-line',
            command: () => openDrawer('reinvestment'),
        },
        {
            label: '얼마나 배당',
            icon: 'pi pi-dollar',
            command: () => openDrawer('yield'),
        },
    ]);

    const toggle = (event) => {
        menu.value.toggle(event);
    };
</script>

<template>
    <div id="t-calculator-button">
        <Button
            type="button"
            icon="pi pi-calculator"
            @click="toggle"
            aria-haspopup="true"
            aria-controls="overlay_menu"
            severity="secondary"
            text />
        <Menu ref="menu" id="overlay_menu" :model="items" :popup="true" />

        <Drawer
            v-model:visible="visibleDrawer"
            header="계산기"
            position="bottom"
            style="height: auto"
            modal>
            <RecoveryCalculator
                v-if="visibleDrawer === 'recovery'"
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
            <ReinvestmentCalculator
                v-if="visibleDrawer === 'reinvestment'"
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
            <DividendYieldCalculator
                v-if="visibleDrawer === 'yield'"
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
        </Drawer>
    </div>
</template>
