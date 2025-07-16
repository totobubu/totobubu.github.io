<!-- stock/src/components/StockChartCard.vue -->
<script setup>
import Card from 'primevue/card';
import ToggleButton from 'primevue/togglebutton';
import SelectButton from 'primevue/selectbutton';
import PrimeVueChart from 'primevue/chart';
import ProgressSpinner from 'primevue/progressspinner';

// 부모로부터 받을 데이터와 옵션을 props로 정의
const props = defineProps({
    frequency: String,
    chartData: Object,
    chartOptions: Object,
    timeRangeOptions: Array,
    isPriceChartMode: Boolean,
    selectedTimeRange: String,
});

// 부모에게 변경 사항을 알리기 위한 emit 정의
const emit = defineEmits(['update:isPriceChartMode', 'update:selectedTimeRange']);

// v-model을 자식 컴포넌트에서 안전하게 사용하기 위해 computed 속성 사용
const localIsPriceChartMode = computed({
    get: () => props.isPriceChartMode,
    set: (value) => emit('update:isPriceChartMode', value)
});

const localSelectedTimeRange = computed({
    get: () => props.selectedTimeRange,
    set: (value) => emit('update:selectedTimeRange', value)
});
</script>

<template>
    <Card>
        <template #content>
            <div class="flex justify-between items-center w-full gap-2 mb-4">
                <div v-if="frequency === 'Weekly'">
                    <ToggleButton v-model="localIsPriceChartMode" onLabel="주가" offLabel="배당" onIcon="pi pi-chart-line" offIcon="pi pi-chart-bar" />
                </div>
                <div v-else></div>
                <SelectButton v-model="localSelectedTimeRange" :options="timeRangeOptions" aria-labelledby="basic" :allowEmpty="true" />
            </div>
            <div class="chart-container">
                <div class="card" id="p-chart" v-if="chartData && chartOptions">
                    <PrimeVueChart type="bar" :data="chartData" :options="chartOptions" :canvas-props="{'id': 'p-chart-instance'}" />
                </div>
                <div v-else class="flex justify-center items-center h-48">
                    <ProgressSpinner />
                </div>
            </div>
        </template>
    </Card>
</template>
