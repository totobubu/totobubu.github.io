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

    const combinedDividendHistory = computed(() => {
        if (
            !props.result ||
            !props.result.cashDividends ||
            !props.result.dripDividends
        ) {
            return [];
        }

        const combinedMap = new Map();

        // 1. 현금 배당(재투자 X) 데이터를 먼저 채웁니다.
        props.result.cashDividends.forEach((item) => {
            const key = `${item.date}-${item.ticker}`;
            combinedMap.set(key, {
                date: item.date,
                ticker: item.ticker,
                perShare: item.perShare,
                cash: {
                    // 재투자 X
                    shares: item.shares,
                    preTaxAmount: item.preTaxAmount,
                    postTaxAmount: item.amount,
                },
                drip: null, // DRIP 데이터는 아직 없음
            });
        });

        // 2. DRIP 배당(재투자 O) 데이터를 추가/병합합니다.
        props.result.dripDividends.forEach((item) => {
            const key = `${item.date}-${item.ticker}`;
            const existing = combinedMap.get(key);
            const dripData = {
                shares: item.shares,
                preTaxAmount: item.preTaxAmount,
                postTaxAmount: item.amount,
            };

            if (existing) {
                existing.drip = dripData;
            } else {
                // 현금 배당 내역에 없는 경우 (이론적으로는 발생하지 않음)
                combinedMap.set(key, {
                    date: item.date,
                    ticker: item.ticker,
                    perShare: item.perShare,
                    cash: null,
                    drip: dripData,
                });
            }
        });

        return Array.from(combinedMap.values());
    });
</script>

<template>
    <div
        v-if="combinedDividendHistory && combinedDividendHistory.length > 0"
        class="col-12 mt-4">
        <h4>배당금 수령 내역</h4>
        <DataTable
            :value="combinedDividendHistory"
            paginator
            :rows="10"
            class="p-datatable-sm"
            sortField="date"
            :sortOrder="-1">
            <Column field="date" header="지급일" sortable></Column>
            <Column field="ticker" header="종목" sortable></Column>
            <Column header="주당 배당금" sortable field="perShare">
                <template #body="{ data }">
                    {{ formatCurrency(data.perShare, 4) }}
                </template>
            </Column>
            <Column header="재투자 X (현금)">
                <template #body="{ data }">
                    <div v-if="data.cash">
                        <span>{{ data.cash.shares.toFixed(2) }}주 = </span>
                        <strong class="text-green-400"
                            >세전
                            {{ formatCurrency(data.cash.preTaxAmount) }}</strong
                        >
                        <span class="text-sm text-surface-500">
                            | 세후
                            {{ formatCurrency(data.cash.postTaxAmount) }}</span
                        >
                    </div>
                    <span v-else>-</span>
                </template>
            </Column>
            <Column header="재투자 O (DRIP)">
                <template #body="{ data }">
                    <div v-if="data.drip">
                        <span>{{ data.drip.shares.toFixed(2) }}주 = </span>
                        <strong class="text-green-400"
                            >세전
                            {{ formatCurrency(data.drip.preTaxAmount) }}</strong
                        >
                        <span class="text-sm text-surface-500">
                            | 세후
                            {{ formatCurrency(data.drip.postTaxAmount) }}</span
                        >
                    </div>
                    <span v-else>-</span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>
