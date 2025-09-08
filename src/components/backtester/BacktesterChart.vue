<script setup>
    import { computed } from 'vue';
    import Chart from 'primevue/chart';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        result: { type: Object, default: null },
        isLoading: { type: Boolean, default: false },
    });

    const chartOptions = computed(() => {
        return {
            maintainAspectRatio: false,
            aspectRatio: 1.8,
            plugins: {
                legend: { position: 'top' },
                datalabels: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: (tooltipItems) => tooltipItems[0].label,
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + '%';
                            }
                            return label;
                        },
                    },
                },
            },
            scales: {
                x: { ticks: { maxTicksLimit: 12, autoSkip: true } },
                y: {
                    ticks: { callback: (value) => value + '%' },
                    title: { display: true, text: 'Total Return (%)' },
                },
            },
            elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
        };
    });

    const summaryDataForTable = computed(() => {
        if (!props.result || !props.result.summary) return [];
        return [...props.result.summary.individual, props.result.summary.total];
    });

    const formatCurrency = (value) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value || 0);
    const formatPercent = (value) => (value || 0).toFixed(2) + '%';
</script>

<template>
    <div class="surface-card p-4 border-round">
        <div
            v-if="isLoading"
            class="flex flex-column justify-content-center align-items-center"
            style="height: 400px">
            <i class="pi pi-spin pi-spinner" style="font-size: 3rem"></i>
            <p class="mt-3 text-lg">
                과거 데이터를 기반으로 시뮬레이션 중입니다...
            </p>
        </div>
        <div v-else-if="result && result.chartData">
            <div class="grid">
                <div class="col-12" style="height: 400px">
                    <Chart
                        type="line"
                        :data="result.chartData"
                        :options="chartOptions" />
                </div>

                <div class="col-12 mt-4">
                    <h3 class="text-xl font-semibold mb-2">
                        백테스팅 결과 요약
                    </h3>
                    <DataTable
                        :value="summaryDataForTable"
                        class="p-datatable-sm">
                        <Column field="symbol" header="종목"></Column>
                        <Column field="initialInvestment" header="초기 투자금">
                            <template #body="slotProps">{{
                                formatCurrency(slotProps.data.initialInvestment)
                            }}</template>
                        </Column>
                        <Column field="finalValue" header="최종 평가액">
                            <template #body="slotProps">{{
                                formatCurrency(slotProps.data.finalValue)
                            }}</template>
                        </Column>
                        <Column field="dividends" header="누적 배당금 (세후)">
                            <template #body="slotProps">{{
                                formatCurrency(slotProps.data.dividends)
                            }}</template>
                        </Column>
                        <Column field="totalAsset" header="총 자산">
                            <template #body="slotProps">{{
                                formatCurrency(slotProps.data.totalAsset)
                            }}</template>
                        </Column>
                        <Column field="returnPercent" header="총 수익률">
                            <template #body="slotProps">
                                <span
                                    :class="
                                        slotProps.data.returnPercent >= 0
                                            ? 'text-green-500'
                                            : 'text-red-500'
                                    ">
                                    {{
                                        formatPercent(
                                            slotProps.data.returnPercent
                                        )
                                    }}
                                </span>
                            </template>
                        </Column>
                    </DataTable>
                    <div
                        v-if="result.summary"
                        class="text-right mt-2 text-sm text-surface-500">
                        * S&P 500 총 수익률:
                        <span
                            :class="
                                result.summary.sp500ReturnPercent >= 0
                                    ? 'text-green-500'
                                    : 'text-red-500'
                            ">
                            {{
                                formatPercent(result.summary.sp500ReturnPercent)
                            }}
                        </span>
                    </div>
                </div>

                <div
                    v-if="
                        result.cashDividends && result.cashDividends.length > 0
                    "
                    class="col-12 mt-4">
                    <h3 class="text-xl font-semibold mb-2">
                        누적 현금 배당금 상세 내역
                    </h3>
                    <DataTable
                        :value="result.cashDividends"
                        :rows="5"
                        paginator
                        responsiveLayout="scroll"
                        class="p-datatable-sm">
                        <Column field="date" header="지급일" sortable></Column>
                        <Column field="ticker" header="종목" sortable></Column>
                        <Column field="amount" header="배당금 (USD)">
                            <template #body="slotProps">{{
                                formatCurrency(slotProps.data.amount)
                            }}</template>
                        </Column>
                    </DataTable>
                </div>
            </div>
        </div>
        <div
            v-else
            class="flex flex-column justify-content-center align-items-center"
            style="height: 400px">
            <p class="text-surface-500">
                종목을 선택하고 설정을 완료한 후 백테스팅을 실행해주세요.
            </p>
        </div>
    </div>
</template>
