<!-- stock\src\components\StockHistoryPanel.vue -->
<script setup>
    import { computed } from 'vue';
    import { formatCurrency, formatPercent } from '@/utils/formatters.js'; // formatPercent 추가
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
                newItem['배당률'] = formatPercent(newItem['배당률'] / 100); // 배당률은 100을 곱해야 함
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
        <DataTable
            :value="formattedHistory"
            stripedRows
            :rows="10"
            paginator
            :paginatorTemplate="
                isDesktop
                    ? 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink'
                    : 'PrevPageLink CurrentPageReport NextPageLink'
            "
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            scrollable>
            <Column
                v-for="col in columns"
                :key="col.field"
                :field="col.field"
                :header="col.header"
                :sortable="col.sortable" />
        </DataTable>
    </div>
</template>
