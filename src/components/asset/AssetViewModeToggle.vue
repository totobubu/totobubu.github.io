<!-- src/components/asset/AssetViewModeToggle.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import ToggleButton from 'primevue/togglebutton';

    const props = defineProps({
        mode: {
            type: String,
            default: 'account', // 'account' or 'stock'
        },
    });

    const emit = defineEmits(['update:mode']);

    const options = ref([
        { label: '증권사 및 계좌 기준', value: 'account' },
        { label: '주식 종목 기준', value: 'stock' },
    ]);

    const selectedOption = computed({
        get: () => props.mode,
        set: (value) => emit('update:mode', value),
    });
</script>

<template>
    <div
        class="flex align-items-center gap-3 mb-4 p-3 bg-surface-50 border-round">
        <label class="font-semibold text-sm">View 모드:</label>
        <div class="flex gap-2">
            <button
                v-for="option in options"
                :key="option.value"
                @click="selectedOption = option.value"
                :class="[
                    'px-4 py-2 border-round transition-all',
                    selectedOption === option.value ? 'font-semibold' : '',
                ]"
                style="border: 2px solid #e0e0e0">
                {{ option.label }}
            </button>
        </div>
    </div>
</template>
