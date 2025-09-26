<!-- src\components\backtester\controls\PortfolioInput.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import PortfolioItem from './PortfolioItem.vue';

    const props = defineProps({
        modelValue: Array,
        allSymbols: Array,
        getMaxValue: Function, // Function passed from parent
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
                filteredSymbols.value = []; // Show nothing on empty query
            } else {
                const queryLower = event.query.toLowerCase();
                filteredSymbols.value = props.allSymbols.filter((symbol) => {
                    return symbol.toLowerCase().startsWith(queryLower);
                });
            }
        }, 250);
    };

    const addItem = (index) => emit('addItem', index);
    const removeItem = (index) => emit('removeItem', index);
    const updateItem = (index, newItem) => {
        const newPortfolio = [...portfolio.value];
        newPortfolio[index] = newItem;
        emit('update:modelValue', newPortfolio);
    };
</script>

<template>
    <div class="grid" id="t-backtester-portfolio">
        <div
            v-for="(item, index) in portfolio"
            :key="index"
            class="col-6 md:col-3">
            <PortfolioItem
                :modelValue="item"
                @update:modelValue="(newItem) => updateItem(index, newItem)"
                :index="index"
                :all-symbols="allSymbols"
                :filtered-symbols="filteredSymbols"
                :max-value="getMaxValue(index)"
                @search="searchSymbol"
                @addItem="addItem"
                @removeItem="removeItem" />
        </div>
    </div>
</template>
