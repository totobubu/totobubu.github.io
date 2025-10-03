<script setup>
    import { computed } from 'vue';
    import { formatCurrency } from '@/utils/numberFormat.js';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        history: Array,
        currency: String,
        updateTime: String,
        isDesktop: Boolean,
    });

    const filteredHistory = computed(() => {
        if (!props.history) return [];
        return props.history.filter((item) => Object.keys(item).length > 1);
    });

    const formatValue = (value) => {
        if (String(value).includes('%')) return value;
        const num = parseFloat(String(value).replace(/[$,₩]/g, ''));
        if (isNaN(num)) return value;
        return formatCurrency(num, props.currency);
    };
</script>

<template>
    <div class="toto-history">
        <DataTable
            :value="filteredHistory"
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
                field="배당락"
                header="배당락"
                sortable
                frozen
                style="min-width: 110px"></Column>
            <Column field="배당금" header="배당금" sortable>
                <template #body="{ data }">
                    {{ formatValue(data['배당금']) }}
                </template>
            </Column>
            <Column field="배당률" header="배당률" sortable>
                <template #body="{ data }">
                    <span class="font-bold text-green-500">{{
                        data['배당률']
                    }}</span>
                </template>
            </Column>
            <Column field="전일종가" header="전일종가">
                <template #body="{ data }">
                    {{ formatValue(data['전일종가']) }}
                </template>
            </Column>
            <Column field="당일시가" header="당일시가">
                <template #body="{ data }">
                    {{ formatValue(data['당일시가']) }}
                </template>
            </Column>
            <Column field="당일종가" header="당일종가">
                <template #body="{ data }">
                    {{ formatValue(data['당일종가']) }}
                </template>
            </Column>
            <Column field="익일종가" header="익일종가">
                <template #body="{ data }">
                    {{ formatValue(data['익일종가']) }}
                </template>
            </Column>
        </DataTable>
    </div>
</template>
