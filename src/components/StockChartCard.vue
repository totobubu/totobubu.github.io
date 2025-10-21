<!-- stock\src\components\StockChartCard.vue -->
<script setup>
    import { computed } from 'vue';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { getGroupSeverity } from '@/utils/uiHelpers.js';
    import Card from 'primevue/card';
    import SelectButton from 'primevue/selectbutton';
    import Dropdown from 'primevue/dropdown';
    import Tag from 'primevue/tag';
    import StockCalculators from '@/components/StockCalculators.vue';

    const props = defineProps({
        tickerInfo: Object,
        dividendHistory: Array,
        userBookmark: Object,
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
                <div class="flex-grow-1 flex gap-2">
                    <SelectButton
                        v-if="viewOptions && viewOptions.length > 1"
                        v-model="localCurrentView"
                        :options="viewOptions"
                        :size="buttonSize" />
                    <template
                        v-if="
                            timeRangeOptions &&
                            timeRangeOptions.length > 0 &&
                            currentView !== '주가'
                        ">
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
                    </template>
                </div>
                <div class="flex align-items-center gap-2" v-if="tickerInfo">
                    <Tag v-if="tickerInfo.frequency" severity="secondary">{{
                        tickerInfo.frequency
                    }}</Tag>
                    <Tag
                        v-if="tickerInfo.group"
                        :severity="getGroupSeverity(tickerInfo.group)"
                        >{{ tickerInfo.group }}</Tag
                    >
                    <StockCalculators
                        v-if="dividendHistory && dividendHistory.length > 0"
                        :dividendHistory="dividendHistory"
                        :tickerInfo="tickerInfo"
                        :userBookmark="userBookmark"
                        class="hidden" />
                </div>
            </div>
        </template>
    </Card>
</template>
