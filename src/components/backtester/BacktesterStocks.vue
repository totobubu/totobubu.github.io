<script setup>
    import Dropdown from 'primevue/dropdown';
    import InputNumber from 'primevue/inputnumber';
    import Button from 'primevue/button';

    const stocks = defineModel('stocks');
    const props = defineProps({
        availableStocks: { type: Array, default: () => [] },
    });

    const addStock = () => {
        if (!stocks.value) {
            stocks.value = [];
        }
        stocks.value.push({
            key: `stock-${Date.now()}`,
            symbol: null,
            quantity: null,
            avgPrice: null,
        });
    };
    const removeStock = (index) => {
        stocks.value.splice(index, 1);
    };
</script>
<template>
    <div class="surface-card p-4 border-round">
        <h3 class="font-bold mt-0 mb-4">1. 투자 종목 설정</h3>
        <div class="flex flex-column gap-3">
            <div
                v-for="(stock, index) in stocks"
                :key="stock.key"
                class="grid formgrid p-fluid align-items-center">
                <div class="field col-4 mb-0">
                    <Dropdown
                        v-model="stock.symbol"
                        :options="availableStocks"
                        optionLabel="longName"
                        optionValue="symbol"
                        placeholder="종목 선택"
                        filter />
                </div>
                <div class="field col-3 mb-0">
                    <InputNumber
                        v-model="stock.quantity"
                        placeholder="보유량" />
                </div>
                <div class="field col-3 mb-0">
                    <InputNumber
                        v-model="stock.avgPrice"
                        placeholder="평단가"
                        mode="currency"
                        currency="USD" />
                </div>
                <div class="col-2">
                    <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        @click="removeStock(index)" />
                </div>
            </div>
            <Button
                label="종목 추가"
                icon="pi pi-plus"
                @click="addStock"
                outlined />
        </div>
    </div>
</template>
