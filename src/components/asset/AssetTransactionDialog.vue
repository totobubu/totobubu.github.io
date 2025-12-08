<!-- src/components/asset/AssetTransactionDialog.vue -->
<template>
    <Drawer v-model:visible="isVisible" :header="title" position="full">
        <div v-if="isLoading" class="flex justify-content-center p-4">
            <ProgressSpinner />
        </div>

        <div
            v-else-if="displayTransactions.length === 0"
            class="text-center p-4">
            <p class="text-color-secondary">거래 내역이 없습니다.</p>
        </div>

        <div v-else class="asset-transaction-container">
            <div class="p-3 bg-blue-100">
                <strong>디버그:</strong> 총 {{ displayTransactions.length }}개 데이터
                <br />
                첫 번째 행: {{ displayTransactions[0] }}
            </div>
            <DataTable
                :value="displayTransactions"
                class="asset-transaction-table"
                :scrollable="true"
                scrollHeight="calc(100vh - 200px)"
                scrollDirection="both"
                stripedRows>
                <!-- 날짜 (Frozen) -->
                <Column
                    field="날짜"
                    header="날짜"
                    :frozen="true"
                    :style="{ minWidth: '120px', width: '120px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['날짜'] }}
                        </div>
                    </template>
                </Column>

                <!-- 평단 -->
                <Column
                    field="평단"
                    header="평단"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['평단'] }}
                        </div>
                    </template>
                </Column>

                <!-- 보유량 -->
                <Column
                    field="보유량"
                    header="보유량"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['보유량'] }}
                        </div>
                    </template>
                </Column>

                <!-- 거래(수량) -->
                <Column
                    field="거래(수량)"
                    header="거래(수량)"
                    :style="{ minWidth: '110px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['거래(수량)'] }}
                        </div>
                    </template>
                </Column>

                <!-- 거래(달러) -->
                <Column
                    field="거래(달러)"
                    header="거래(달러)"
                    :style="{ minWidth: '110px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['거래(달러)'] }}
                        </div>
                    </template>
                </Column>

                <!-- 거래(원화) -->
                <Column
                    field="거래(원화)"
                    header="거래(원화)"
                    :style="{ minWidth: '110px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['거래(원화)'] }}
                        </div>
                    </template>
                </Column>

                <!-- 배당락 -->
                <Column
                    field="배당락"
                    header="배당락"
                    :style="{ minWidth: '160px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['배당락'] }}
                        </div>
                    </template>
                </Column>

                <!-- 배당기준 -->
                <Column
                    field="배당기준"
                    header="배당기준"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['배당기준'] }}
                        </div>
                    </template>
                </Column>

                <!-- 세후배당금($) -->
                <Column
                    field="세후배당금($)"
                    header="세후배당금($)"
                    :style="{ minWidth: '130px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['세후배당금($)'] }}
                        </div>
                    </template>
                </Column>

                <!-- 외화과표 -->
                <Column
                    field="외화과표"
                    header="외화과표"
                    :style="{ minWidth: '110px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['외화과표'] }}
                        </div>
                    </template>
                </Column>

                <!-- 원화과표 -->
                <Column
                    field="원화과표"
                    header="원화과표"
                    :style="{ minWidth: '130px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['원화과표'] }}
                        </div>
                    </template>
                </Column>

                <!-- 세후배당금(원화) -->
                <Column
                    field="세후배당금(원화)"
                    header="세후배당금(원화)"
                    :style="{ minWidth: '150px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['세후배당금(원화)'] }}
                        </div>
                    </template>
                </Column>

                <!-- 환율 -->
                <Column
                    field="환율"
                    header="환율"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['환율'] }}
                        </div>
                    </template>
                </Column>

                <!-- 지급기준 -->
                <Column
                    field="지급기준"
                    header="지급기준"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['지급기준'] }}
                        </div>
                    </template>
                </Column>

                <!-- 원금회수율 -->
                <Column
                    field="원금회수율"
                    header="원금회수율"
                    :style="{ minWidth: '110px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['원금회수율'] }}
                        </div>
                    </template>
                </Column>

                <!-- 누적배당 -->
                <Column
                    field="누적배당"
                    header="누적배당"
                    :style="{ minWidth: '110px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['누적배당'] }}
                        </div>
                    </template>
                </Column>

                <!-- 누적TR -->
                <Column
                    field="누적TR"
                    header="누적TR"
                    :style="{ minWidth: '110px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['누적TR'] }}
                        </div>
                    </template>
                </Column>

                <!-- 당일종가 -->
                <Column
                    field="당일종가"
                    header="당일종가"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['당일종가'] }}
                        </div>
                    </template>
                </Column>

                <!-- 당일 평단 -->
                <Column
                    field="당일 평단"
                    header="당일 평단"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['당일 평단'] }}
                        </div>
                    </template>
                </Column>

                <!-- 당일평가액 -->
                <Column
                    field="당일평가액"
                    header="당일평가액"
                    :style="{ minWidth: '120px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['당일평가액'] }}
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </Drawer>
</template>

<script setup>
    import { ref, computed } from 'vue';
    import Drawer from 'primevue/drawer';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import ProgressSpinner from 'primevue/progressspinner';
    import extractedData from './extracted_transactions.json';

    const props = defineProps({
        visible: {
            type: Boolean,
            default: false,
        },
        title: {
            type: String,
            default: '자산별 거래 내역',
        },
        transactions: {
            type: Array,
            default: () => [],
        },
        isLoading: {
            type: Boolean,
            default: false,
        },
    });

    const emit = defineEmits(['update:visible']);

    const isVisible = computed({
        get: () => props.visible,
        set: (value) => emit('update:visible', value),
    });

    // Google Sheets에서 추출한 원본 데이터 (직접 import)
    const sampleData = ref(extractedData);
    console.log('✅ Loaded sample data:', sampleData.value.length, 'rows');
    console.log('✅ Sample data first row:', sampleData.value[0]);
    console.log('✅ Sample data keys:', sampleData.value[0] ? Object.keys(sampleData.value[0]) : 'No data');

    // UI 개발을 위해 무조건 샘플 데이터 사용
    const displayTransactions = computed(() => {
        console.log('🔍 Props transactions:', props.transactions?.length || 0);
        console.log('🔍 Sample data:', sampleData.value.length);
        console.log('📊 강제로 샘플 데이터 사용 (UI 개발 모드)');

        // UI 개발 중이므로 무조건 샘플 데이터 사용
        return sampleData.value;
    });

    // 요약 행 판별 (첫 번째 행: "2028년")
    const isSummaryRow = (data) => {
        return data['날짜'] && data['날짜'].includes('년');
    };

    // 배당 있는 행 판별 (배당락 컬럼에 값이 있으면)
    const hasDividend = (data) => {
        return data['배당락'] && data['배당락'].trim() !== '';
    };
</script>

<style lang="scss" scoped>
    .asset-transaction-container {
        height: calc(100vh - 80px);
        padding: 0;

        :deep(.asset-transaction-table) {
            font-size: 12px;

            .p-datatable-wrapper {
                border: 1px solid #e0e0e0;
            }

            .p-datatable-thead > tr > th {
                background: #f3f3f3;
                color: #000;
                font-weight: 600;
                padding: 8px 12px;
                border: 1px solid #e0e0e0;
                text-align: center;
                white-space: nowrap;
            }

            .p-datatable-tbody > tr > td {
                padding: 6px 12px;
                border: 1px solid #e0e0e0;
                white-space: nowrap;

                > div {
                    &.summary-row {
                        background-color: #f8f9fa;
                        font-weight: 600;
                        padding: 4px 8px;
                        border-radius: 4px;
                    }

                    &.dividend-row {
                        background-color: #fff3cd;
                        padding: 4px 8px;
                        border-radius: 4px;
                    }
                }
            }

            // Frozen 컬럼 스타일
            .p-frozen-column {
                background: #fff;
                font-weight: 500;
            }

            // Striped rows
            .p-datatable-tbody > tr:nth-child(even) {
                background-color: #fafafa;
            }
        }
    }
</style>
