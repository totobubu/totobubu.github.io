<!-- stock\src\components\StockHistoryPanel.vue -->
<script setup>
    import { computed } from 'vue';
    import { formatCurrency, formatPercent } from '@/utils/formatters.js';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        history: Array, // 이제 순수 숫자 데이터가 담긴 배열
        isDesktop: Boolean,
        currency: String,
    });

    const formattedHistory = computed(() => {
        if (!props.history) return [];
        return props.history.map((item) => ({
            배당락: new Date(item.date)
                .toLocaleDateString('ko-KR', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                })
                .replace(/\./g, '. ')
                .slice(0, -1),
            배당금: formatCurrency(item.amount, props.currency),
            배당률: item.yield ? formatPercent(item.yield) : 'N/A', // yield는 scraper_dividend.py에서 계산됨
            전일종가: formatCurrency(item.prevClose, props.currency),
            당일시가: formatCurrency(item.open, props.currency),
            당일종가: formatCurrency(item.close, props.currency),
            익일종가: formatCurrency(item.nextClose, props.currency),
        }));
    });

    const columns = computed(() => {
        [
            { field: '배당락', header: '배당락', sortable: true },
            { field: '배당금', header: '배당금', sortable: true },
            { field: '배당률', header: '배당률', sortable: true },
            { field: '당일시가', header: '당일시가', sortable: false },
            { field: '당일종가', header: '당일종가', sortable: false },
        ];
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
            scrollable
            :frozenValue="isDesktop ? null : formattedHistory.slice(0, 2)">
            <Column
                v-for="col in columns"
                :key="col.field"
                :field="col.field"
                :header="col.header"
                :sortable="col.sortable"
                :frozen="
                    isDesktop
                        ? false
                        : col.field === '배당락' || col.field === '배당금'
                " />
        </DataTable>
    </div>
</template>
