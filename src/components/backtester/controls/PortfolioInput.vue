<!-- src\components\backtester\controls\PortfolioInput.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import Card from 'primevue/card';
    import InputText from 'primevue/inputtext';
    import Button from 'primevue/button';
    import Slider from 'primevue/slider';
    import AutoComplete from 'primevue/autocomplete';

    const props = defineProps({
        modelValue: Array,
        allSymbols: Array,
    });
    const emit = defineEmits(['update:modelValue', 'addItem', 'removeItem']);

    const filteredSymbols = ref([]);

    const portfolio = computed({
        get: () => props.modelValue,
        set: (value) => emit('update:modelValue', value),
    });

    const searchSymbol = (event) => {
        if (!props.allSymbols) return;
        setTimeout(() => {
            if (!event.query.trim().length) {
                filteredSymbols.value = props.allSymbols.slice(0, 10);
            } else {
                filteredSymbols.value = props.allSymbols.filter((symbol) => {
                    return symbol
                        .toLowerCase()
                        .startsWith(event.query.toLowerCase());
                });
            }
        }, 250);
    };

    const addItem = (index) => emit('addItem', index);
    const removeItem = (index) => emit('removeItem', index);
</script>

<template>
    <div class="grid">
        <div
            v-for="(item, index) in portfolio"
            :key="index"
            class="col-12 md:col-6 lg:col-3">
            <Card class="border-1 surface-border shadow-none h-full">
                <template #content>
                    <div
                        v-if="index !== 0 && !item.symbol"
                        class="flex align-items-center justify-content-center h-full"
                        style="min-height: 100px">
                        <Button
                            icon="pi pi-plus"
                            rounded
                            text
                            @click="addItem(index)" />
                    </div>
                    <div v-else class="flex flex-column gap-3">
                        <div
                            class="flex align-items-center justify-content-between">
                            <AutoComplete
                                v-model="item.symbol"
                                :suggestions="filteredSymbols"
                                @complete="searchSymbol"
                                :placeholder="`종목 ${index + 1}`"
                                class="p-inputtext-sm w-full" />
                            <Button
                                v-if="index !== 0"
                                icon="pi pi-times"
                                text
                                rounded
                                severity="secondary"
                                @click="removeItem(index)" />
                        </div>
                        <div
                            class="flex align-items-center justify-content-between">
                            <Slider
                                v-model="item.value"
                                class="flex-1 mr-4"
                                :disabled="index === 0"
                                :max="
                                    100 -
                                    portfolio
                                        .slice(0, index)
                                        .filter((p, i) => i !== 0 && p.symbol)
                                        .reduce((a, b) => a + (b.value || 0), 0)
                                " />
                            <span class="font-bold text-lg w-4rem text-right"
                                >{{ item.value || 0 }}%</span
                            >
                        </div>
                        <div
                            v-if="item.initialShares > 0"
                            class="text-xs text-surface-500 mt-2 text-center">
                            초기 수량: {{ item.initialShares.toFixed(2) }}주
                        </div>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>
