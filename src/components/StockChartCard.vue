<!-- stock\src\components\StockChartCard.vue -->
<script setup>
    import { computed, defineProps, defineEmits } from 'vue';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { getGroupSeverity } from '@/utils/uiHelpers.js'; // [수정] 중앙 유틸리티 import

    // PrimeVue 컴포넌트 import
    import Card from 'primevue/card';
    import ToggleButton from 'primevue/togglebutton';
    import SelectButton from 'primevue/selectbutton';
    import PrimeVueChart from 'primevue/chart';
    import Dropdown from 'primevue/dropdown';
    import Tag from 'primevue/tag';

    // tickerInfo는 상위 컴포넌트(StockView)에서 prop으로 이미 받고 있으므로
    // useStockData를 여기서 또 호출할 필요가 없습니다.
    // import { useStockData } from '@/composables/useStockData.js';
    // const { tickerInfo } = useStockData();

    const props = defineProps({
        tickerInfo: Object, // tickerInfo를 prop으로 받습니다.
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

    const buttonSize = computed(() => (isMobile.value ? 'small' : null));

    const localIsPriceChartMode = computed({
        get: () => props.isPriceChartMode,
        set: (value) => emit('update:isPriceChartMode', value),
    });

    // Dropdown과의 호환성을 위해 set 함수를 수정합니다.
    const localSelectedTimeRange = computed({
        get: () => props.selectedTimeRange,
        set: (value) => {
            // value가 객체로 들어올 경우 (Dropdown), 실제 value 속성을 emit합니다.
            // value가 문자열로 들어올 경우 (SelectButton), 그대로 emit합니다.
            const actualValue =
                typeof value === 'object' && value !== null
                    ? value.value
                    : value;
            emit('update:selectedTimeRange', actualValue);
        },
    });

    // Dropdown 옵션 형식을 올바르게 수정합니다.
    const dropdownTimeRangeOptions = computed(() => {
        if (!props.timeRangeOptions) return [];
        // props.timeRangeOptions의 label과 value를 dropdown이 요구하는 name과 code로 매핑합니다.
        return props.timeRangeOptions.map((option) => ({
            name: option.label,
            code: option.value,
        }));
    });
</script>

<template>
    <Card class="toto-chart">
        <template #header v-if="deviceType !== 'desktop' && tickerInfo">
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
                            :size="buttonSize" />
                    </div>
                    <!-- hasDividendChartMode가 false일 때 빈 div를 둬서 레이아웃 유지를 위해 v-else 추가 -->
                    <div v-else></div>

                    <SelectButton
                        v-if="isDesktop"
                        v-model="localSelectedTimeRange"
                        :options="timeRangeOptions"
                        optionLabel="label"
                        optionValue="value"
                        aria-labelledby="range-selection" />

                    <!-- Dropdown은 v-model에 객체를 바인딩할 수 있으므로, optionValue를 제거하는 것이 더 안전합니다. -->
                    <Dropdown
                        v-else
                        v-model="localSelectedTimeRange"
                        :options="dropdownTimeRangeOptions"
                        optionLabel="name"
                        optionValue="code"
                        placeholder="기간 선택"
                        :size="buttonSize" />
                </div>
                <div class="flex gap-2" v-if="tickerInfo">
                    <Tag v-if="tickerInfo.frequency" severity="secondary">{{
                        tickerInfo.frequency
                    }}</Tag>
                    <Tag
                        v-if="tickerInfo.group"
                        :severity="getGroupSeverity(tickerInfo.group)"
                        >{{ tickerInfo.group }}
                    </Tag>
                </div>
            </div>
            <div class="chart-wrapper">
                <div
                    class="chart-container"
                    :style="{ minWidth: chartContainerWidth }">
                    <div
                        v-if="chartData && chartOptions"
                        class="card"
                        id="p-chart">
                        <PrimeVueChart
                            type="bar"
                            :data="chartData"
                            :options="chartOptions" />
                    </div>
                    <div
                        v-else
                        class="flex justify-center items-center h-full dark:text-surface-500">
                        <p>차트 데이터가 없습니다.</p>
                    </div>
                </div>
            </div>
        </template>
    </Card>
</template>
