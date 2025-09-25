<script setup>
    // ... DataTable, Column import
    const props = defineProps({ result: Object });
    // ... formatCurrency
    const individualResultsArray = computed(() => {
        if (!props.result || !props.result.individualResults) return [];
        return Object.entries(props.result.individualResults);
    });
</script>
<template>
    <div v-if="individualResultsArray.length > 0" class="col-12 mt-4">
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
    <div v-if="result.cashDividends?.length > 0" class="col-12 mt-4">
        <h4>배당금 수령 내역</h4>
        <DataTable
            :value="result.cashDividends"
            paginator
            :rows="5"
            class="p-datatable-sm"
            sortField="date"
            :sortOrder="-1">
            <Column field="date" header="지급일" sortable></Column>
            <Column field="ticker" header="종목" sortable></Column>
            <Column field="amount" header="세후 배당금 (USD)" sortable>
                <template #body="slotProps">{{
                    formatCurrency(slotProps.data.amount)
                }}</template>
            </Column>
        </DataTable>
    </div>
</template>
