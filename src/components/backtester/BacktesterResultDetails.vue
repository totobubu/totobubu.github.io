<script setup>
    import { computed } from 'vue'; // [핵심] computed를 import 합니다.
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        result: {
            type: Object,
            default: () => ({}),
        },
    });

    const formatCurrency = (val, fractionDigits = 2) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(val || 0);

    const individualResultsArray = computed(() => {
        if (!props.result || !props.result.individualResults) return [];
        return Object.entries(props.result.individualResults);
    });
</script>

<template>
    <div v-if="individualResultsArray.length > 0" class="grid">
        <div class="col-12 mt-4">
            <h4>종목별 초기 매수 수량</h4>
            <DataTable :value="individualResultsArray" class="p-datatable-sm">
                <Column field="[0]" header="종목"></Column>
                <Column field="[1].initialShares" header="초기 수량 (주)">
                    <template #body="slotProps">{{
                        (slotProps.data[1].initialShares || 0).toFixed(4)
                    }}</template>
                </Column>
            </DataTable>
        </div>
        <div
            v-if="result.cashDividends && result.cashDividends.length > 0"
            class="col-12 mt-4">
            <h4>배당금 수령 내역 (재투자 X 기준)</h4>
            <DataTable
                :value="result.cashDividends"
                paginator
                :rows="10"
                class="p-datatable-sm"
                sortField="date"
                :sortOrder="-1">
                <Column field="date" header="지급일" sortable></Column>
                <Column field="ticker" header="종목" sortable></Column>
                <Column field="amount" header="배당금 (USD)">
                    <template #body="{ data }">
                        {{ formatCurrency(data.shares, 2) }}주 *
                        {{ formatCurrency(data.perShare, 4) }} =
                        <strong>{{ formatCurrency(data.preTaxAmount) }}</strong>
                        <span v-if="data.preTaxAmount !== data.amount">
                            (세후: {{ formatCurrency(data.amount) }})</span
                        >
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
