<!-- stock\src\components\StockHistoryPanel.vue -->
<script setup>
    import { computed } from 'vue';

    // PrimeVue 컴포넌트 import
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        history: Array,
        updateTime: String,
        isDesktop: Boolean,
        currency: {
            // [신규] currency prop 정의
            type: String,
            default: 'USD',
        },
    });

    const currencySymbol = computed(() =>
        props.currency === 'KRW' ? '₩' : '$'
    );

    const formattedHistory = computed(() => {
        if (!props.history) return [];
        // 테이블에 표시하기 전에 통화 기호를 올바르게 적용
        return props.history.map((item) => {
            const newItem = { ...item };
            for (const key in newItem) {
                // 금액과 관련된 필드인지 확인 ( heuristic )
                if (
                    [
                        '배당금',
                        '전일종가',
                        '당일시가',
                        '당일종가',
                        '익일종가',
                    ].includes(key)
                ) {
                    if (
                        typeof newItem[key] === 'string' &&
                        (newItem[key].startsWith('$') ||
                            newItem[key].startsWith('₩'))
                    ) {
                        const numberValue = parseFloat(
                            newItem[key].replace(/[$,₩,]/g, '')
                        );
                        if (!isNaN(numberValue)) {
                            if (props.currency === 'KRW') {
                                newItem[key] =
                                    `${currencySymbol.value}${Math.round(numberValue).toLocaleString()}`;
                            } else {
                                newItem[key] =
                                    `${currencySymbol.value}${numberValue.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
            return newItem;
        });
    });

    const filteredHistory = computed(() => {
        if (!props.history) return [];
        return props.history.filter((item) => Object.keys(item).length > 1);
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
                sortable: true,
                ...config,
                frozen: config.frozen && isMobile,
            };
        });
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
                :sortable="col.sortable"
                :frozen="col.frozen"
                :class="col.class"
                :style="col.style"
                :width="col.width">
            </Column>
        </DataTable>
    </div>
</template>
