<!-- src\components\backtester\BacktesterResultDetails.vue -->
<script setup>
    import { computed } from 'vue';
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

    const dividendHistoryWithDrip = computed(() => {
        if (!props.result || !props.result.cashDividends) return [];

        const dripPayouts = props.result.individualResults
            ? Object.values(props.result.individualResults).flatMap(
                  (res) => res.dividendPayouts
              )
            : [];

        const combined = [...props.result.cashDividends];

        dripPayouts.forEach((drip) => {
            const existing = combined.find(
                (cash) => cash.date === drip.date && cash.ticker === drip.ticker
            );
            if (existing) {
                existing.dripAmount = drip.amount;
            }
        });

        return combined;
    });
</script>

<template>
    <div
        v-if="result.cashDividends && result.cashDividends.length > 0"
        class="col-12 mt-4">
        <h4>배당금 수령 내역</h4>
        <DataTable
            :value="dividendHistoryWithDrip"
            paginator
            :rows="10"
            class="p-datatable-sm"
            sortField="date"
            :sortOrder="-1">
            <Column field="date" header="지급일" sortable></Column>
            <Column field="ticker" header="종목" sortable></Column>
            <Column header="현금 배당금 (재투자 X)">
                <template #body="{ data }">
                    {{ (data.shares || 0).toFixed(2) }}주 *
                    {{ formatCurrency(data.perShare, 4) }} =
                    <strong>{{ formatCurrency(data.preTaxAmount) }}</strong>
                    <span v-if="data.preTaxAmount !== data.amount">
                        (세후: {{ formatCurrency(data.amount) }})</span
                    >
                </template>
            </Column>
            <Column header="재투자 배당금 (DRIP)">
                <template #body="{ data }">
                    <span v-if="data.dripAmount">{{
                        formatCurrency(data.dripAmount)
                    }}</span>
                    <span v-else>-</span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>
