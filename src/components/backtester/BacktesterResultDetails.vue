<!-- src\components\backtester\BacktesterResultDetails.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import SelectButton from 'primevue/selectbutton';

    const props = defineProps({
        result: {
            type: Object,
            default: () => ({}),
        },
    });

    const selectedTicker = ref('전체');

    // --- [수정] 필터 옵션 생성 로직 변경 ---
    const filterOptions = computed(() => {
        // 배당 내역 데이터가 없으면 필터를 표시하지 않음
        if (!props.result || !props.result.cashDividends) return [];

        // Set을 사용하여 배당 내역에 있는 모든 고유 티커를 추출
        const tickersWithDividends = new Set(
            props.result.cashDividends.map((d) => d.ticker)
        );

        // 고유 티커 목록을 배열로 변환하고 정렬
        const sortedTickers = Array.from(tickersWithDividends).sort();

        // '전체' 옵션을 맨 앞에 추가
        return ['전체', ...sortedTickers];
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

        props.result.cashDividends.forEach((item) => {
            const key = `${item.date}-${item.ticker}`;
            combinedMap.set(key, {
                date: item.date,
                ticker: item.ticker,
                perShare: item.perShare,
                cash: {
                    shares: item.shares,
                    preTaxAmount: item.preTaxAmount,
                    postTaxAmount: item.amount,
                },
                drip: null,
            });
        });

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
                combinedMap.set(key, {
                    date: item.date,
                    ticker: item.ticker,
                    perShare: item.perShare,
                    cash: null,
                    drip: dripData,
                });
            }
        });

        const allDividends = Array.from(combinedMap.values());

        if (selectedTicker.value === '전체') {
            return allDividends;
        }
        return allDividends.filter(
            (item) => item.ticker === selectedTicker.value
        );
    });
</script>

<template>
    <div
        v-if="combinedDividendHistory && combinedDividendHistory.length > 0"
        class="col-12">
        <div
            class="flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h4>배당금 수령 내역</h4>
            <!-- [수정] 필터 옵션이 1개 초과일 때만 (즉, '전체' 외에 다른 종목이 있을 때) 버튼을 표시 -->
            <SelectButton
                v-if="filterOptions.length > 1"
                v-model="selectedTicker"
                :options="filterOptions"
                aria-labelledby="basic"
                class="p-button-sm" />
        </div>

        <DataTable
            :value="combinedDividendHistory"
            class="p-datatable-sm"
            sortField="date"
            :sortOrder="-1"
            scrollable
            scrollHeight="50vh">
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

<style scoped>
    :deep(.p-selectbutton .p-button) {
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
    }
</style>
