<!-- src\components\backtester\controls\PortfolioItem.vue -->
<script setup>
    import { computed } from 'vue';
    import Card from 'primevue/card';
    import InputText from 'primevue/inputtext';
    import Button from 'primevue/button';
    import Slider from 'primevue/slider';
    import AutoComplete from 'primevue/autocomplete';
    import InputNumber from 'primevue/inputnumber';
    import InputGroup from 'primevue/inputgroup';

    const props = defineProps({
        modelValue: Object, // v-model for the portfolio item
        index: Number,
        allSymbols: Array,
        filteredSymbols: Array,
        maxValue: {
            type: Number,
            default: 100,
        },
    });

    const emit = defineEmits([
        'update:modelValue',
        'addItem',
        'removeItem',
        'search',
    ]);

    const item = computed({
        get: () => props.modelValue,
        set: (value) => emit('update:modelValue', value),
    });

    const isFirstItem = computed(() => props.index === 0);

    const handleRemove = () => emit('removeItem', props.index);
    const handleAdd = () => emit('addItem', props.index);
    const handleSearch = (event) => emit('search', event);
</script>

<template>
    <Card class="border-1 surface-border shadow-none h-full">
        <template #content>
            <!-- Case for Empty Placeholder Card -->
            <div
                v-if="!isFirstItem && !item.symbol"
                class="flex align-items-center justify-content-center h-full"
                style="min-height: 100px">
                <Button icon="pi pi-plus" rounded text @click="handleAdd" />
            </div>

            <!-- Case for Active Card (with symbol) -->
            <div v-else class="flex flex-column gap-3">
                <div class="flex align-items-center justify-content-between">
                    <AutoComplete
                        v-model="item.symbol"
                        :suggestions="filteredSymbols"
                        @complete="handleSearch"
                        :placeholder="`종목 ${index + 1}`"
                        class="p-inputtext-sm w-full" />
                    <Button
                        v-if="!isFirstItem"
                        icon="pi pi-times"
                        text
                        rounded
                        severity="secondary"
                        @click="handleRemove" />
                </div>

                <!-- UI for the FIRST portfolio item -->
                <div
                    v-if="isFirstItem"
                    class="flex align-items-center justify-content-end h-2rem">
                    <span class="font-bold text-lg w-4rem text-right"
                        >{{ item.value || 0 }}%</span
                    >
                </div>

                <!-- UI for OTHER portfolio items (2, 3, 4) -->
                <div
                    v-else
                    class="flex align-items-center justify-content-between">
                    <Slider
                        v-model="item.value"
                        class="flex-1 mr-4"
                        :max="maxValue" />
                    <InputGroup class="w-8rem">
                        <InputNumber
                            v-model="item.value"
                            class="p-inputtext-sm"
                            :max="maxValue"
                            :allowEmpty="false" />
                        <span class="p-inputgroup-addon">%</span>
                    </InputGroup>
                </div>

                <div
                    v-if="item.initialShares > 0"
                    class="text-xs text-surface-500 mt-2 text-center">
                    초기 수량: {{ item.initialShares.toFixed(2) }}주
                </div>
            </div>
        </template>
    </Card>
</template>

<style scoped>
    /* Ensure InputNumber's input is right-aligned */
    :deep(.p-inputnumber-input) {
        text-align: right;
        width: 100%; /* Adjust width if needed */
    }
</style>
