<!-- stock\src\components\StockChartCard.vue -->
<script setup>
    import { computed } from 'vue';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { getGroupSeverity } from '@/utils/uiHelpers.js';
    import Card from 'primevue/card';
    import SelectButton from 'primevue/selectbutton';
    import Dropdown from 'primevue/dropdown';
    import Tag from 'primevue/tag';

    const props = defineProps({
        tickerInfo: Object,
        viewOptions: Array,
        timeRangeOptions: Array,
        currentView: String,
        selectedTimeRange: String,
    });

    const emit = defineEmits([
        'update:currentView',
        'update:selectedTimeRange',
    ]);
    const { isDesktop, isMobile } = useBreakpoint();
    const buttonSize = computed(() => (isMobile.value ? 'small' : null));

    const localCurrentView = computed({
        get: () => props.currentView,
        set: (value) => emit('update:currentView', value),
    });
    const localSelectedTimeRange = computed({
        get: () => props.selectedTimeRange,
        set: (value) =>
            emit(
                'update:selectedTimeRange',
                typeof value === 'object' ? value.value : value
            ),
    });
    const dropdownTimeRangeOptions = computed(() =>
        props.timeRangeOptions?.map((opt) => ({
            name: opt.label,
            code: opt.value,
        }))
    );
</script>

<template>
    <Card class="toto-chart">
        <template #content>
            <div class="toto-chart-header mb-4">
                <div class="flex gap-2">
                    <!-- [핵심 수정] 뷰 전환 SelectButton -->
                    <SelectButton
                        v-model="localCurrentView"
                        :options="viewOptions"
                        :size="buttonSize" />

                    <SelectButton
                        v-if="isDesktop"
                        v-model="localSelectedTimeRange"
                        :options="timeRangeOptions"
                        optionLabel="label"
                        optionValue="value" />
                    <Dropdown
                        v-else
                        v-model="localSelectedTimeRange"
                        :options="dropdownTimeRangeOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="기간"
                        :size="buttonSize" />
                </div>
                <div class="flex gap-2" v-if="tickerInfo">
                    <Tag v-if="tickerInfo.frequency" severity="secondary">{{
                        tickerInfo.frequency
                    }}</Tag>
                    <Tag
                        v-if="tickerInfo.group"
                        :severity="getGroupSeverity(tickerInfo.group)"
                        >{{ tickerInfo.group }}</Tag
                    >
                </div>
            </div>
        </template>
    </Card>
</template>
