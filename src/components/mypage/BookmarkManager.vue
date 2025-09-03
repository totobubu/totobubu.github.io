<!-- src\components\mypage\BookmarkManager.vue -->
<script setup>
    import { ref, onMounted, computed, watch } from 'vue';
    import { useFilterState } from '@/composables/useFilterState';
    import { joinURL } from 'ufo';

    // PrimeVue 컴포넌트 import
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import InputNumber from 'primevue/inputnumber';
    import Button from 'primevue/button';

    const props = defineProps({
        preSelected: {
            type: Array,
            default: () => [],
        },
    });
    const emit = defineEmits(['selection-change']);

    const selectedForBacktest = ref([]);

    watch(
        () => props.preSelected,
        (newVal) => {
            selectedForBacktest.value = newVal || [];
        },
        { immediate: true, deep: true }
    );

    watch(
        selectedForBacktest,
        (newSelection) => {
            emit('selection-change', newSelection);
        },
        { deep: true }
    );

    const { myBookmarks } = useFilterState();
    const isLoading = ref(true);
    const allStockInfo = ref(new Map());
    const editingRows = ref([]);

    const bookmarkedStocks = computed(() => {
        return Object.entries(myBookmarks.value)
            .map(([symbol, userData]) => {
                const stockInfo = allStockInfo.value.get(symbol);
                return {
                    symbol,
                    longName: stockInfo?.longName || symbol,
                    ...userData,
                };
            })
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    });

    onMounted(async () => {
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const response = await fetch(url);
        const allStockData = (await response.json()).nav;
        allStockInfo.value = new Map(
            allStockData.map((stock) => [stock.symbol, stock])
        );
        isLoading.value = false;
    });

    const onRowEditSave = (event) => {
        let { newData } = event;
        const symbol = newData.symbol;

        if (myBookmarks.value[symbol]) {
            myBookmarks.value[symbol] = {
                avgPrice: newData.avgPrice || 0,
                quantity: newData.quantity || 0,
                accumulatedDividend: newData.accumulatedDividend || 0,
                targetAsset: newData.targetAsset || 0,
            };
        }
    };

    const deleteBookmark = (symbol) => {
        if (myBookmarks.value[symbol]) {
            delete myBookmarks.value[symbol];
        }
    };

    const formatCurrency = (value, currency = 'USD') => {
        if (value === null || value === undefined || isNaN(value)) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
            }).format(0);
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(value);
    };

    const formatNumber = (value) => {
        if (value === null || value === undefined || isNaN(value)) {
            return '0';
        }
        return new Intl.NumberFormat().format(value);
    };
</script>

<template>
    <div id="t-bookmark">
        <DataTable
            :value="bookmarkedStocks"
            editMode="row"
            dataKey="symbol"
            v-model:editingRows="editingRows"
            @row-edit-save="onRowEditSave"
            v-model:selection="selectedForBacktest"
            class="p-datatable-sm">
            <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
            <Column
                field="longName"
                header="종목명"
                style="width: auto"></Column>
            <Column field="avgPrice" header="평단가" style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatCurrency(data[field], 'USD') }}
                </template>
                <template #editor="{ data, field }">
                    <InputNumber
                        v-model="data[field]"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </template>
            </Column>
            <Column field="quantity" header="수량" style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatNumber(data[field]) }} 주
                </template>
                <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" suffix=" 주" />
                </template>
            </Column>
            <Column
                field="accumulatedDividend"
                header="누적배당금"
                style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatCurrency(data[field], 'USD') }}
                </template>
                <template #editor="{ data, field }">
                    <InputNumber
                        v-model="data[field]"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </template>
            </Column>
            <Column field="targetAsset" header="목표 자산" style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatCurrency(data[field], 'USD') }}
                </template>
                <template #editor="{ data, field }">
                    <InputNumber
                        v-model="data[field]"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </template>
            </Column>
            <Column
                :rowEditor="true"
                style="width: 10%; min-width: 8rem"
                bodyStyle="text-align:center"></Column>
            <Column bodyStyle="text-align:center" style="width: 3rem">
                <template #body="slotProps">
                    <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        @click="deleteBookmark(slotProps.data.symbol)" />
                </template>
            </Column>
        </DataTable>
    </div>
</template>
