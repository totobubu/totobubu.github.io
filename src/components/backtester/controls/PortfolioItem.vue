<!-- src\components\backtester\controls\PortfolioItem.vue -->
<script setup>
    import { computed, ref } from 'vue';
    import Card from 'primevue/card';
    import AutoComplete from 'primevue/autocomplete';
    import Button from 'primevue/button';
    import Slider from 'primevue/slider';
    import InputNumber from 'primevue/inputnumber';
    import InputGroup from 'primevue/inputgroup';

    const props = defineProps({
        modelValue: Object,
        index: Number,
        maxValue: { type: Number, default: 100 },
    });

    const emit = defineEmits(['update:modelValue', 'addItem', 'removeItem']);

    const suggestions = ref([]);

    // --- [핵심 수정 1] ---
    // AutoComplete의 v-model이 이제 객체가 아닌 문자열(symbol)을 직접 다루게 됩니다.
    // 따라서 item computed는 더 이상 필요하지 않습니다.
    const itemSymbol = computed({
        get: () => props.modelValue.symbol,
        set: (value) => {
            // value가 객체로 들어오면 symbol을, 문자열이면 대문자로 변환하여 업데이트
            const newSymbol =
                typeof value === 'object' && value !== null
                    ? value.symbol
                    : (value || '').toUpperCase();
            emit('update:modelValue', {
                ...props.modelValue,
                symbol: newSymbol,
            });
        },
    });

    const itemValue = computed({
        get: () => props.modelValue.value,
        set: (newValue) => {
            emit('update:modelValue', { ...props.modelValue, value: newValue });
        },
    });
    // --- // ---

    const isFirstItem = computed(() => props.index === 0);

    const handleRemove = () => emit('removeItem', props.index);
    const handleAdd = () => emit('addItem');

    const searchSymbols = async (event) => {
        if (!event.query.trim()) {
            suggestions.value = [];
            return;
        }
        try {
            const response = await fetch(
                `/api/searchSymbol?query=${event.query}`
            );
            if (response.ok) {
                suggestions.value = await response.json();
            } else {
                suggestions.value = [];
            }
        } catch (error) {
            console.error('Symbol search failed:', error);
            suggestions.value = [];
        }
    };
</script>

<template>
    <Card class="border-1 surface-border shadow-none h-full">
        <template #content>
            <div
                id="t-backtester-portfolio-item-empty"
                v-if="!isFirstItem && !props.modelValue.symbol"
                class="flex align-items-center justify-content-center h-full">
                <Button icon="pi pi-plus" text @click="handleAdd" />
            </div>

            <div v-else id="t-backtester-portfolio-item">
                <InputGroup class="p-2">
                    <InputGroupAddon v-if="isFirstItem">
                        <Button
                            icon="pi pi-check"
                            severity="secondary"
                            disabled />
                    </InputGroupAddon>

                    <!-- [핵심 수정 2] v-model 수정 및 optionLabel 추가 -->
                    <AutoComplete
                        v-model="itemSymbol"
                        :suggestions="suggestions"
                        @complete="searchSymbols"
                        optionLabel="symbol"
                        placeholder="종목 검색"
                        class="p-inputtext-sm w-full"
                        :delay="300">
                        <template #option="slotProps">
                            <div
                                class="flex justify-between items-center w-full">
                                <div>
                                    <span class="font-bold">{{
                                        slotProps.option.symbol
                                    }}</span>
                                    <div class="text-xs text-surface-500">
                                        {{ slotProps.option.name }}
                                    </div>
                                </div>
                                <Tag
                                    :value="slotProps.option.market"
                                    severity="secondary"
                                    class="text-xs"></Tag>
                            </div>
                        </template>
                    </AutoComplete>

                    <InputGroupAddon v-if="!isFirstItem">
                        <Button
                            icon="pi pi-times"
                            severity="secondary"
                            @click="handleRemove" />
                    </InputGroupAddon>
                </InputGroup>

                <InputGroup class="text-center" v-if="isFirstItem">
                    <span class="w-full">기본종목 자동계산</span>
                </InputGroup>
                <InputGroup v-else>
                    <Slider
                        v-model="itemValue"
                        class="flex-1"
                        :max="maxValue" />
                </InputGroup>

                <InputGroup class="">
                    <span
                        v-if="isFirstItem"
                        class="p-inputnumber p-component p-inputwrapper p-inputwrapper-filled p-inputtext-sm w-full">
                        <span
                            class="p-inputtext p-component p-filled p-inputnumber-input text-center">
                            {{ itemValue || 0 }}%
                        </span>
                    </span>
                    <InputNumber
                        v-else
                        v-model="itemValue"
                        class="p-inputtext-sm w-full"
                        suffix=" %"
                        min="1"
                        :max="maxValue"
                        :allowEmpty="false" />
                </InputGroup>

                <div
                    v-if="props.modelValue.initialShares > 0"
                    class="text-xs text-surface-500 mt-2 text-center">
                    초기 수량: {{ props.modelValue.initialShares.toFixed(2) }}주
                </div>
            </div>
        </template>
    </Card>
</template>

<style scoped>
    :deep(.p-inputnumber-input) {
        text-align: right;
        width: 100%;
    }
</style>
