<!-- stock\src\components\StockHistoryPanel.vue -->
<script setup>
    import { computed } from 'vue';
    import { formatCurrency } from '@/utils/formatters.js';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        history: Array,
        isDesktop: Boolean,
        currency: String,
    });

    const formattedHistory = computed(() => {
        if (!props.history) return [];
        return props.history.map((item) => {
            const newItem = { ...item };
            for (const key of [
                '배당금',
                '전일종가',
                '당일시가',
                '당일종가',
                '익일종가',
            ]) {
                if (typeof newItem[key] === 'number') {
                    newItem[key] = formatCurrency(newItem[key], props.currency);
                }
            }
            if (typeof newItem['배당률'] === 'number') {
                newItem['배당률'] = `${newItem['배당률'].toFixed(2)}%`;
            }
            return newItem;
        });
    });

    const columns = computed(() => {
        if (!props.history || props.history.length === 0) return [];
        const desiredOrder = [
            '배당락',
            '배당금',
            '배당률',
            '전일종가',
            '당일시가',
            '당일종가',
            '익일종가',
        ];
        // history의 첫번째 항목에 있는 키들을 기준으로 컬럼 생성 (순서는 desiredOrder 따름)
        const keys = Object.keys(props.history[0]);
        return desiredOrder
            .filter((key) => keys.includes(key))
            .map((key) => ({
                field: key,
                header: key,
                sortable:
                    key === '배당락' || key === '배당금' || key === '배당률',
            }));
    });
</script>

<template>
    <div class="toto-history">
        <DataTable :value="formattedHistory" ...>
            <Column
                v-for="col in columns"
                :key="col.field"
                :field="col.field"
                :header="col.header"
                :sortable="col.sortable" />
        </DataTable>
    </div>
</template>
