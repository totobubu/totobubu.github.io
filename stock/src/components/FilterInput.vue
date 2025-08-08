<script setup>
    import { computed } from 'vue';
    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    const { isMobile, isDesktop } = useBreakpoint();

    const props = defineProps({
        modelValue: String,
        title: {
            type: String,
            required: true,
        },
        filterType: {
            type: String,
            default: 'global', // 'global' or 'calendar'
            validator: (value) => ['global', 'calendar'].includes(value),
        },
    });

    const emit = defineEmits(['update:modelValue']);

    const inputValue = computed({
        get: () => props.modelValue,
        set: (value) => emit('update:modelValue', value),
    });

    const iconClass = computed(() => {
        return props.filterType === 'calendar'
            ? 'pi pi-filter-fill'
            : 'pi pi-search';
    });

    const responsiveSize = computed(() => {
        if (isMobile.value) {
            return 'small';
            // } else if (isDesktop.value) {
            //     return "large";
        } else {
            return null;
        }
    });

    const clearInput = () => {
        emit('update:modelValue', null);
    };
</script>

<template>
    <div class="flex-auto flex items-center gap-2">
        <InputText
            v-model="inputValue"
            placeholder="검색"
            :size="responsiveSize"
            class="flex-1" />
        <Button
            v-if="modelValue"
            icon="pi pi-times"
            severity="secondary"
            @click="clearInput"
            aria-label="Clear Filter">
        </Button>
        <Button
            v-else
            :icon="iconClass"
            disabled
            :title="title"
            severity="secondary">
        </Button>
    </div>
</template>
