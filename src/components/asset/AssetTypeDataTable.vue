<!-- src/components/asset/AssetTypeDataTable.vue -->
<template>
    <div class="flex flex-column gap-4">
        <DataTable
            :value="assets"
            stripedRows
            class="p-datatable-sm shadow-1"
            rowGroupMode="subheader"
            groupRowsBy="groupName"
            sortMode="single"
            sortField="groupName"
            :sortOrder="1">
            <template #groupheader="slotProps">
                <div
                    class="flex align-items-center gap-2 font-bold text-lg p-3 surface-100">
                    <i :class="getGroupIcon(slotProps.data.groupKey)"></i>
                    <span>{{ slotProps.data.groupName }}</span>
                    <Tag
                        :value="getGroupSummary(slotProps.data.groupKey)"
                        severity="info"
                        class="ml-2" />
                </div>
            </template>

            <Column field="name" header="종목명" style="min-width: 200px">
                <template #body="slotProps">
                    <div class="flex align-items-center gap-2">
                        <div class="flex flex-column">
                            <span class="font-bold">{{
                                slotProps.data.name
                            }}</span>
                            <span class="text-sm text-color-secondary">{{
                                slotProps.data.symbol
                            }}</span>
                        </div>
                    </div>
                </template>
            </Column>

            <Column field="profitRate" header="총 수익률" sortable>
                <template #body="slotProps">
                    <span
                        :class="getProfitColorClass(slotProps.data.profitRate)">
                        {{ formatPercent(slotProps.data.profitRate) }}
                    </span>
                </template>
            </Column>

            <Column field="profitAmount" header="총 수익금" sortable>
                <template #body="slotProps">
                    <span
                        :class="
                            getProfitColorClass(slotProps.data.profitAmount)
                        ">
                        {{
                            formatCurrency(
                                slotProps.data.profitAmount,
                                slotProps.data.currency
                            )
                        }}
                    </span>
                </template>
            </Column>

            <Column field="avgPrice" header="평단가">
                <template #body="slotProps">
                    {{
                        formatCurrency(
                            slotProps.data.avgPrice,
                            slotProps.data.currency
                        )
                    }}
                </template>
            </Column>

            <Column field="currentPrice" header="현재가">
                <template #body="slotProps">
                    {{
                        formatCurrency(
                            slotProps.data.currentPrice,
                            slotProps.data.currency
                        )
                    }}
                </template>
            </Column>

            <Column field="amount" header="보유 수량">
                <template #body="slotProps">
                    {{ formatNumber(slotProps.data.amount) }}
                </template>
            </Column>

            <Column field="valuation" header="평가금" sortable>
                <template #body="slotProps">
                    {{
                        formatCurrency(
                            slotProps.data.valuation,
                            slotProps.data.currency
                        )
                    }}
                </template>
            </Column>

            <Column field="principal" header="원금">
                <template #body="slotProps">
                    {{
                        formatCurrency(
                            slotProps.data.principal,
                            slotProps.data.currency
                        )
                    }}
                </template>
            </Column>

            <Column header="내역" style="width: 80px">
                <template #body="slotProps">
                    <Button
                        icon="pi pi-list"
                        text
                        rounded
                        severity="secondary"
                        @click="openHistory(slotProps.data)"
                        v-tooltip="'거래 내역'" />
                </template>
            </Column>
        </DataTable>

        <TransactionHistoryDialog
            v-if="selectedAsset"
            v-model:visible="showHistoryDialog"
            :memberId="selectedAsset.memberId"
            :brokerageId="selectedAsset.brokerageId"
            :accountId="selectedAsset.accountId"
            :assetId="selectedAsset.id" />
    </div>
</template>

<script setup>
    import { ref, computed } from 'vue';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Button from 'primevue/button';
    import Tag from 'primevue/tag';
    import TransactionHistoryDialog from '@/components/asset/TransactionHistoryDialog.vue';

    const props = defineProps({
        assets: {
            type: Array,
            required: true,
            default: () => [],
        },
    });

    const showHistoryDialog = ref(false);
    const selectedAsset = ref(null);

    const openHistory = (asset) => {
        selectedAsset.value = asset;
        showHistoryDialog.value = true;
    };

    const getGroupIcon = (groupKey) => {
        const icons = {
            krw: 'pi pi-money-bill',
            foreign: 'pi pi-dollar',
            domesticStock: 'pi pi-chart-line',
            overseasStock: 'pi pi-globe',
            coin: 'pi pi-bitcoin',
        };
        return icons[groupKey] || 'pi pi-circle';
    };

    const getGroupSummary = (groupKey) => {
        const groupAssets = props.assets.filter((a) => a.groupKey === groupKey);
        const totalValuation = groupAssets.reduce(
            (sum, a) => sum + (a.valuation || 0),
            0
        );

        // 통화가 섞여있을 수 있으므로 단순 합계는 위험하지만, 일단은 대표 통화(KRW/USD)로 가정하거나 표시 안함
        // 여기서는 개수만 표시
        return `총 ${groupAssets.length}개 종목`;
    };

    const formatNumber = (value) => {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('ko-KR').format(value);
    };

    const formatCurrency = (value, currency) => {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: currency || 'KRW',
        }).format(value);
    };

    const formatPercent = (value) => {
        if (value === undefined || value === null) return '-';
        return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
    };

    const getProfitColorClass = (value) => {
        if (!value) return '';
        return value > 0 ? 'text-red-500' : value < 0 ? 'text-blue-500' : '';
    };
</script>
