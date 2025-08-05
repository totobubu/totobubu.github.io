<script setup>
    import { computed } from 'vue';
    import Card from 'primevue/card';
    import ToggleButton from 'primevue/togglebutton';
    import SelectButton from 'primevue/selectbutton';
    import PrimeVueChart from 'primevue/chart';
    import ProgressSpinner from 'primevue/progressspinner';
    import Dropdown from 'primevue/dropdown';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useStockData } from '@/composables/useStockData.js';
    const { tickerInfo } = useStockData();

    const props = defineProps({
        hasDividendChartMode: Boolean,
        chartData: Object,
        chartOptions: Object,
        chartContainerWidth: String,
        timeRangeOptions: Array,
        isPriceChartMode: Boolean,
        selectedTimeRange: String,
    });

    const emit = defineEmits([
        'update:isPriceChartMode',
        'update:selectedTimeRange',
    ]);

    const { deviceType, isDesktop, isMobile } = useBreakpoint();

    const buttonSize = computed(() => {
        return isMobile.value ? 'small' : null;
    });

    const localIsPriceChartMode = computed({
        get: () => props.isPriceChartMode,
        set: (value) => emit('update:isPriceChartMode', value),
    });

    const localSelectedTimeRange = computed({
        get: () => props.selectedTimeRange,
        set: (value) => emit('update:selectedTimeRange', value),
    });

    const dropdownTimeRangeOptions = computed(() => {
        return props.timeRangeOptions.map((option) => ({
            name: option,
            code: option,
        }));
    });

    const getGroupSeverity = (group) => {
        switch (group) {
            case 'A':
                return 'danger';
            case 'B':
                return 'warning';
            case 'C':
                return 'success';
            case 'D':
                return 'info';
            case '월':
                return 'mon';
            case '화':
                return 'tue';
            case '수':
                return 'wed';
            case '목':
                return 'thu';
            case '금':
                return 'fri';
            default:
                return 'secondary';
        }
    };
</script>

<template>
    <Card class="toto-chart">
        <template #header v-if="deviceType !== 'desktop'">
            <p class="text-center mb-2">
                {{ tickerInfo.longName }}
            </p>
        </template>
        <template #content>
            <div class="toto-chart-header mb-4">
                <div class="flex gap-2">
                    <div v-if="hasDividendChartMode">
                        <ToggleButton
                            v-model="localIsPriceChartMode"
                            onLabel="주가"
                            offLabel="배당"
                            onIcon="pi pi-chart-line"
                            offIcon="pi pi-chart-bar"
                            :size="buttonSize"
                        />
                    </div>
                    <div v-else></div>

                    <SelectButton
                        v-if="isDesktop"
                        v-model="localSelectedTimeRange"
                        :options="timeRangeOptions"
                        aria-labelledby="basic"
                    />

                    <Dropdown
                        v-else
                        v-model="localSelectedTimeRange"
                        :options="dropdownTimeRangeOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="기간 선택"
                        :size="buttonSize"
                    />
                </div>
                <div class="flex gap-2" v-if="tickerInfo">
                    <Tag severity="secondary">{{ tickerInfo.frequency }}</Tag>
                    <Tag
                        :severity="getGroupSeverity(tickerInfo.group)"
                        v-if="tickerInfo.group"
                        >{{ tickerInfo.group }}</Tag
                    >
                </div>
            </div>
            <div class="chart-wrapper">
                <div
                    class="chart-container"
                    :style="{ minWidth: chartContainerWidth }"
                >
                    <div
                        class="card"
                        id="p-chart"
                        v-if="chartData && chartOptions"
                    >
                        <PrimeVueChart
                            ref="chartRef"
                            type="bar"
                            :data="chartData"
                            :options="chartOptions"
                        />
                    </div>
                    <div v-else class="flex justify-center items-center h-full">
                        <ProgressSpinner />
                    </div>
                </div>
            </div>
        </template>
    </Card>
</template>
