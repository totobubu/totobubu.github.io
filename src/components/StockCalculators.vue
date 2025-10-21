<!-- Components/StockCaculators.vue -->
<script setup>
    import { ref } from 'vue';
    import Button from 'primevue/button';
    import Drawer from 'primevue/drawer';
    import StockCalculatorsUnified from './calculators/StockCalculatorsUnified.vue';

    defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const isDrawerVisible = ref(false);
</script>

<template>
    <div id="t-calculator-button">
        <Button
            type="button"
            icon="pi pi-calculator"
            @click="isDrawerVisible = true"
            severity="secondary"
            text />

        <Drawer
            v-model:visible="isDrawerVisible"
            header="계산기"
            position="bottom"
            style="height: auto"
            modal>
            <StockCalculatorsUnified
                :dividendHistory="dividendHistory"
                :tickerInfo="tickerInfo"
                :userBookmark="userBookmark" />
        </Drawer>
    </div>
</template>
