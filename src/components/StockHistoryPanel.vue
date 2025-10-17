<!-- stock\src\components\StockHistoryPanel.vue -->
<script setup>
    import { computed } from 'vue';
    import { formatCurrency, formatPercent } from '@/utils/formatters.js';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        history: Array, // 배당금이 있는 backtestData 항목들
        isDesktop: Boolean, // isDesktop prop 추가
        currency: String,
    });

    const formattedHistory = computed(() => {
        if (!props.history) return [];
        // 최신순으로 정렬하여 표시
        return [...props.history]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((item) => {
                const finalAmount =
                    item.amountFixed !== undefined && item.amountFixed !== null
                        ? item.amountFixed
                        : item.amount;

                const displayItem = {
                    배당락: new Date(item.date)
                        .toLocaleDateString('ko-KR', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                        })
                        .replace(/\./g, '. ')
                        .slice(0, -1),
                    배당금: formatCurrency(finalAmount, props.currency),
                    배당률: item.yield ? formatPercent(item.yield) : 'N/A',
                    당일시가: formatCurrency(item.open, props.currency),
                    당일종가: formatCurrency(item.close, props.currency),
                };

                if (
                    item.amountFixed !== undefined &&
                    item.amountFixed !== null
                ) {
                    displayItem._isFixed = true; // 수동 입력 값 표시 (예: CSS 스타일링용)
                }

                return displayItem;
            });
    });

    // [수정] 표시할 컬럼 목록을 데이터에 맞게 정리
    const columns = [
        { field: '배당락', header: '배당락', sortable: true },
        { field: '배당금', header: '배당금', sortable: true },
        { field: '배당률', header: '배당률', sortable: true },
        { field: '당일시가', header: '당일시가', sortable: false },
        { field: '당일종가', header: '당일종가', sortable: false },
    ];
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
