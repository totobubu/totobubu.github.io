<!-- src/components/StockHistoryPanel.vue -->
<script setup>
    import { computed } from 'vue';
    import { formatCurrency, formatPercent } from '@/utils/formatters.js';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        history: Array,
        updateTime: String,
        isDesktop: Boolean,
    });

    const filteredHistory = computed(() => {
        if (!props.history) return [];
        return props.history.map((item) => ({
            ...item,
            배당금: formatCurrency(item.배당금, props.currency),
            배당률: formatPercent(item.배당률),
            전일종가: formatCurrency(item.전일종가, props.currency),
            당일시가: formatCurrency(item.당일시가, props.currency),
            당일종가: formatCurrency(item.당일종가, props.currency),
            익일종가: formatCurrency(item.익일종가, props.currency),
        }));
    });

    const defaultColumnProps = {
        width: '100px',
    };

    const columnConfig = {
        배당락: {
            frozen: true,
            class: 'toto-stock-history-date',
            width: '100px',
        },
        배당금: {
            frozen: true,
            class: 'toto-stock-history-amount',
            width: '100px',
        },
        배당률: {
            class: 'font-bold text-green-500',
            width: '100px',
        },
        전일종가: {
            sortable: false,
        },
        당일시가: {
            sortable: false,
        },
        당일종가: {
            sortable: false,
        },
        익일종가: {
            sortable: false,
        },
    };

    const columns = computed(() => {
        if (!filteredHistory.value || filteredHistory.value.length === 0)
            return [];

        const allKeys = new Set();
        filteredHistory.value.forEach((item) => {
            Object.keys(item).forEach((key) => allKeys.add(key));
        });

        const desiredOrder = [
            '배당락',
            '배당금',
            '배당률',
            '전일종가',
            '당일시가',
            '당일종가',
            '익일종가',
        ];
        const sortedKeys = Array.from(allKeys).sort((a, b) => {
            const indexA = desiredOrder.indexOf(a);
            const indexB = desiredOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        return sortedKeys.map((key) => {
            const config = columnConfig[key] || {};
            const isMobile = !props.isDesktop;

            return {
                ...defaultColumnProps,
                field: key,
                header: key,
                sortable: ['배당락', '배당금', '배당률'].includes(key),
            }));
    });
</script>

<template>
    <div class="toto-history">
        <DataTable :value="formattedHistory" stripedRows scrollable>
            <Column
                v-for="col in columns"
                :key="col.field"
                :field="col.field"
                :header="col.header"
                :sortable="col.sortable"
                :frozen="col.frozen"
                :class="col.class"
                :style="col.style"
                :width="col.width">
            </Column>
        </DataTable>
    </div>
</template>
