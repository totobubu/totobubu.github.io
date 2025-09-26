<!-- src\components\backtester\BacktesterResultDetails.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import SelectButton from 'primevue/selectbutton'; // SelectButton import 추가

    const props = defineProps({
        result: {
            type: Object,
            default: () => ({}),
        },
    });

    // --- [신규] 필터링 로직 추가 ---
    const selectedTicker = ref('전체'); // 초기값은 '전체'

    const filterOptions = computed(() => {
        if (!props.result || !props.result.symbols) return [];
        const options = ['전체', ...props.result.symbols];
        // 비교 대상이 있고 'None'이 아니면 옵션에 추가
        if (
            props.result.comparisonSymbol &&
            props.result.comparisonSymbol !== 'None'
        ) {
            options.push(props.result.comparisonSymbol);
        }
        return options;
    });
    // ------------------------------------

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

        // --- [수정] 필터링 로직 적용 ---
        if (selectedTicker.value === '전체') {
            return allDividends;
        }
        return allDividends.filter(
            (item) => item.ticker === selectedTicker.value
        );
    });
</script>

<template>
    <div v-if="combinedDividendHistory" class="col-12 mt-4">
        <div
            class="flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h4>배당금 수령 내역</h4>
            <!-- [신규] SelectButton 필터 추가 -->
            <SelectButton
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
            scrollHeight="400px">
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
    /* SelectButton 사이즈 조절을 위한 스타일 */
    :deep(.p-selectbutton .p-button) {
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
    }
</style>
