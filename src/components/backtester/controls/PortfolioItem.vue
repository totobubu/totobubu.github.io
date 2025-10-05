<!-- REFACTORED: src/components/backtester/controls/PortfolioItem.vue -->

<script setup>
    import { computed, ref, watch } from 'vue';
    import Card from 'primevue/card';
    import AutoComplete from 'primevue/autocomplete';
    import Button from 'primevue/button';
    import Slider from 'primevue/slider';
    import InputNumber from 'primevue/inputnumber';
    import InputGroup from 'primevue/inputgroup';
    import Skeleton from 'primevue/skeleton';
    import SelectButton from 'primevue/selectbutton'; // SelectButton import

    const props = defineProps({
        modelValue: Object,
        index: Number,
        maxValue: { type: Number, default: 100 },
        navDataMap: Map,
    });

    const emit = defineEmits(['update:modelValue', 'addItem', 'removeItem']);
    const suggestions = ref([]);
    const isLoading = ref(false);

    // --- [핵심 추가 1] 국가 선택 상태 및 옵션 ---
    const selectedCountry = ref('US'); // 기본값 미국
    const countryOptions = ref([
        { value: 'US', icon: '🇺🇸' },
        { value: 'KR', icon: '🇰🇷' },
    ]);
    // --- // ---

    const displayValue = computed({
        get() {
            if (!props.modelValue || !props.modelValue.symbol) return '';
            if (
                props.navDataMap &&
                props.navDataMap.has(props.modelValue.symbol)
            ) {
                const navInfo = props.navDataMap.get(props.modelValue.symbol);
                return (
                    navInfo?.koName ||
                    navInfo?.longName ||
                    props.modelValue.symbol
                );
            }

            return props.modelValue.symbol;
        },
        set(value) {
            const newSymbol =
                typeof value === 'object' && value !== null
                    ? value.symbol
                    : (value || '').toUpperCase();
            const cleanSymbol = newSymbol.replace(/\.(KS|KQ)$/, '');
            emit('update:modelValue', {
                ...props.modelValue,
                symbol: cleanSymbol,
            });
        },
    });

    const itemValue = computed({
        get: () => props.modelValue?.value || 0,
        set: (newValue) => {
            if (props.modelValue) {
                emit('update:modelValue', {
                    ...props.modelValue,
                    value: newValue,
                });
            }
        },
    });

    watch(selectedCountry, () => {
        // 국가 선택이 바뀌면 입력된 종목을 초기화
        emit('update:modelValue', { ...props.modelValue, symbol: '' });
        // 추천 목록도 초기화
        suggestions.value = [];
    });

    const isFirstItem = computed(() => props.index === 0);
    const handleRemove = () => emit('removeItem');
    const handleAdd = () => emit('addItem');

    // --- [핵심 수정 2] API 호출 시 국가 정보 추가 ---
    const searchSymbols = async (event) => {
        if (!event.query.trim()) {
            suggestions.value = [];
            return;
        }
        isLoading.value = true;
        try {
            // API 호출 URL에 country 쿼리 파라미터를 추가
            const response = await fetch(
                `/api/searchSymbol?query=${event.query}&country=${selectedCountry.value}`
            );
            suggestions.value = response.ok ? await response.json() : [];
        } catch (error) {
            console.error('Symbol search failed:', error);
            suggestions.value = [];
        } finally {
            isLoading.value = false;
        }
    };
</script>

<template>
    <Card class="border-1 surface-border shadow-none h-full">
        <template #content>
            <div
                id="t-backtester-portfolio-item-empty"
                v-if="!isFirstItem && (!modelValue || !modelValue.symbol)"
                class="flex align-items-center justify-content-center h-full">
                <Button icon="pi pi-plus" text @click="handleAdd" />
            </div>

            <div v-else-if="modelValue" id="t-backtester-portfolio-item">
                <!-- [핵심 추가 3] 국가 선택 UI -->
                <div class="p-2 pb-0">
                    <SelectButton
                        v-model="selectedCountry"
                        :options="countryOptions"
                        optionValue="value"
                        dataKey="value"
                        aria-labelledby="country-select">
                        <template #option="slotProps">
                            <span>{{ slotProps.option.icon }}</span>
                        </template>
                    </SelectButton>
                </div>
                <!-- // --- // -->

                <InputGroup class="p-2">
                    <InputGroupAddon v-if="isFirstItem">
                        <Button
                            icon="pi pi-check"
                            severity="secondary"
                            disabled />
                    </InputGroupAddon>

                    <AutoComplete
                        v-model="displayValue"
                        :suggestions="suggestions"
                        @complete="searchSymbols"
                        optionLabel="symbol"
                        placeholder="종목 검색"
                        class="p-inputtext-sm w-full"
                        :delay="300"
                        :loading="isLoading">
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

                        <template #loader>
                            <div class="flex flex-col gap-2 p-2">
                                <Skeleton width="100%" height="2.5rem" />
                                <Skeleton width="100%" height="2.5rem" />
                            </div>
                        </template>

                        <template #empty v-if="!isLoading">
                            <span>No results found</span>
                        </template>
                    </AutoComplete>

                    <InputGroupAddon v-if="!isFirstItem">
                        <Button
                            icon="pi pi-times"
                            severity="secondary"
                            @click="handleRemove" />
                    </InputGroupAddon>
                </InputGroup>

                <!-- ... (나머지 template 코드는 이전과 동일) ... -->
                <InputGroup class="text-center" v-if="isFirstItem">
                    <span class="w-full">기본종목 자동계산</span>
                </InputGroup>
                <InputGroup v-else>
                    <Slider
                        v-model="itemValue"
                        class="flex-1"
                        :max="maxValue" />
                </InputGroup>

                <InputGroup>
                    <span
                        v-if="isFirstItem"
                        class="p-inputnumber p-component p-inputwrapper p-inputwrapper-filled p-inputtext-sm w-full">
                        <span
                            class="p-inputtext p-component p-filled p-inputnumber-input text-center">
                            {{ itemValue }}%
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
                    v-if="modelValue.initialShares > 0"
                    class="text-xs text-surface-500 mt-2 text-center">
                    초기 수량: {{ modelValue.initialShares.toFixed(2) }}주
                </div>
            </div>
        </template>
    </Card>
</template>

<style scoped>
    :deep(.p-selectbutton .p-button) {
        padding: 0.5rem 0.75rem;
        flex-grow: 1;
    }
    :deep(.p-inputnumber-input) {
        text-align: right;
        width: 100%;
    }
</style>
