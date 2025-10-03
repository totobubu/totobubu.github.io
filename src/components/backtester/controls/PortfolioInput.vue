<script setup>
    import PortfolioItem from './PortfolioItem.vue';

    defineProps({
        modelValue: Array,
        getMaxValue: Function,
    });
    const emit = defineEmits(['addItem', 'removeItem', 'update:portfolioItem']);
</script>

<template>
    <div class="grid" id="t-backtester-portfolio">
        <div
            v-for="(item, index) in modelValue"
            :key="index"
            class="col-6 md:col-3">
            <PortfolioItem
                v-if="item.symbol !== null"
                :modelValue="item"
                @update:modelValue="
                    (newItem) => emit('update:portfolioItem', index, newItem)
                "
                :index="index"
                :max-value="getMaxValue(index)"
                @addItem="emit('addItem')"
                @removeItem="emit('removeItem', index)" />
        </div>
    </div>
</template>
