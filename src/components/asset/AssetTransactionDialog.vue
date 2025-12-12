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
            <!-- 필터 영역 -->
            <div class="filter-section p-3 bg-gray-50 border-bottom-1">
                <div class="flex gap-3 align-items-center">
                    <!-- 년도 필터 -->
                    <div class="flex flex-column">
                        <label for="year-filter" class="text-sm mb-1"
                            >년도</label
                        >
                        <Calendar
                            v-model="selectedYear"
                            view="year"
                            dateFormat="yy"
                            placeholder="년도 선택"
                            :showIcon="true"
                            style="width: 150px" />
                    </div>

                    <!-- 거래타입 필터 -->
                    <div class="flex flex-column">
                        <label for="type-filter" class="text-sm mb-1"
                            >거래타입</label
                        >
                        <Select
                            v-model="selectedTransactionType"
                            :options="transactionTypes"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="타입 선택"
                            style="width: 200px" />
                    </div>

                    <!-- 필터 초기화 버튼 -->
                    <Button
                        label="필터 초기화"
                        icon="pi pi-filter-slash"
                        size="small"
                        text
                        @click="resetFilters"
                        class="mt-4" />

                    <!-- 결과 표시 -->
                    <div class="ml-auto mt-4 text-sm text-color-secondary">
                        총 {{ filteredTransactions.length }}개 /
                        {{ displayTransactions.length }}개
                    </div>
                </div>
            </div>

            <DataTable
                :value="filteredTransactions"
                class="asset-transaction-table"
                :scrollable="true"
                scrollHeight="calc(100vh - 260px)"
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
                            {{ formatDate(slotProps.data['날짜']) }}
                        </div>
                    </template>
                </Column>

                <!-- 평단 -->
                <Column
                    v-if="shouldShowColumn('평단')"
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
                    v-if="shouldShowColumn('보유량')"
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
                    v-if="shouldShowColumn('거래(수량)')"
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
                    v-if="shouldShowColumn('거래(달러)')"
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
                    v-if="shouldShowColumn('거래(원화)')"
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

                <!-- 배당락일 -->
                <Column
                    v-if="shouldShowColumn('배당락일')"
                    field="배당락일"
                    header="배당락일"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['배당락일'] }}
                        </div>
                    </template>
                </Column>

                <!-- 배당지급일 -->
                <Column
                    v-if="shouldShowColumn('배당지급일')"
                    field="배당지급일"
                    header="배당지급일"
                    :style="{ minWidth: '100px' }">
                    <template #body="slotProps">
                        <div
                            :class="{
                                'summary-row': isSummaryRow(slotProps.data),
                                'dividend-row': hasDividend(slotProps.data),
                            }">
                            {{ slotProps.data['배당지급일'] }}
                        </div>
                    </template>
                </Column>

                <!-- 배당기준 -->
                <Column
                    v-if="shouldShowColumn('배당기준')"
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
                    v-if="shouldShowColumn('세후배당금($)')"
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
                    v-if="shouldShowColumn('외화과표')"
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
                    v-if="shouldShowColumn('원화과표')"
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
                    v-if="shouldShowColumn('세후배당금(원화)')"
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
                    v-if="shouldShowColumn('환율')"
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
                    v-if="shouldShowColumn('지급기준')"
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
                    v-if="shouldShowColumn('원금회수율')"
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
                    v-if="shouldShowColumn('누적배당')"
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
                    v-if="shouldShowColumn('누적TR')"
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
    import Calendar from 'primevue/calendar';
    import Select from 'primevue/select';
    import Button from 'primevue/button';
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

    // UI 개발을 위해 무조건 샘플 데이터 사용
    const displayTransactions = computed(() => {
        // UI 개발 중이므로 무조건 샘플 데이터 사용
        return sampleData.value;
    });

    // 필터 상태
    const selectedYear = ref(null);
    const selectedTransactionType = ref('all');

    // 거래타입 옵션
    const transactionTypes = ref([
        { label: '전체', value: 'all' },
        { label: '거래', value: 'trade' },
        { label: '배당', value: 'dividend' },
    ]);

    // 날짜 포맷팅 함수 (구글 시트 깨진 데이터 처리 포함)
    const formatDate = (value) => {
        if (!value) return '';
        const valStr = String(value).trim();
        if (valStr.includes('년')) return valStr; // Summary row (e.g., "2028년")

        // 1. 이미 포맷된 문자열 ("YY. MM. DD.") 확인
        // 정규식: 두 자리 숫자 + 점 + 공백 + 한두 자리 숫자 + 점 + 공백 + 한두 자리 숫자 + 점
        if (/^\d{2}\.\s\d{1,2}\.\s\d{1,2}\.$/.test(valStr)) {
            return valStr;
        }

        // 2. 엑셀 시리얼 넘버 (숫자 형태)
        // 1900-01-01 기준 (약 45000 등의 숫자)
        const serial = parseFloat(value);
        if (!isNaN(serial) && serial > 20000) {
            // 20000일은 대략 1954년. 그 이상이면 날짜 시리얼로 간주
            const excelBaseDate = new Date(1899, 11, 30); // 1899-12-30
            const date = new Date(
                excelBaseDate.getTime() + serial * 24 * 60 * 60 * 1000
            );
            return formatJsDate(date);
        }

        // 3. Date 파싱 시도 (ISO string, etc)
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return formatJsDate(date);
        }

        // 4. 처리 불가는 원본 반환
        return valStr;
    };

    // JS Date 객체를 "YY. M. D." 형식으로 변환
    const formatJsDate = (date) => {
        const year = date.getFullYear().toString().slice(2); // 2028 -> 28
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year}. ${month}. ${day}.`;
    };

    // 필터링된 데이터
    const filteredTransactions = computed(() => {
        let filtered = [...displayTransactions.value];

        // 년도 필터
        if (selectedYear.value) {
            const yearStr = selectedYear.value.getFullYear().toString(); // "2028"
            const shortYear = yearStr.slice(2); // "28"

            filtered = filtered.filter((row) => {
                // 날짜 정규화 후 비교
                const dateStr = formatDate(row['날짜']);

                // "28. 12. 29." 또는 "2028년" 형식 확인
                return (
                    dateStr &&
                    (dateStr.startsWith(shortYear + '.') ||
                        dateStr.includes(yearStr) ||
                        dateStr.includes('20' + shortYear))
                );
            });
        }

        // 거래타입 필터
        if (selectedTransactionType.value === 'trade') {
            // 거래만 (배당락 ~ 누적 TR 컬럼 숨김, 거래 데이터가 있는 행만)
            filtered = filtered.filter(
                (row) =>
                    row['거래(수량)'] || row['거래(달러)'] || row['거래(원화)']
            );
        } else if (selectedTransactionType.value === 'dividend') {
            // 배당만 (배당락일 또는 배당지급일 컬럼에 값이 있는 행만)
            filtered = filtered.filter(
                (row) => row['배당락일'] || row['배당지급일']
            );
        }

        return filtered;
    });

    // 필터 초기화
    const resetFilters = () => {
        selectedYear.value = null;
        selectedTransactionType.value = 'all';
    };

    // 요약 행 판별 (첫 번째 행: "2028년")
    const isSummaryRow = (data) => {
        const dateStr = formatDate(data['날짜']);
        return dateStr && dateStr.includes('년');
    };

    // 배당 있는 행 판별 (배당락일 또는 배당지급일 컬럼에 값이 있으면)
    const hasDividend = (data) => {
        return (
            (data['배당락일'] && data['배당락일'].trim() !== '') ||
            (data['배당지급일'] && data['배당지급일'].trim() !== '')
        );
    };

    // 거래타입에 따라 컬럼 표시 여부 결정
    const shouldShowColumn = (columnName) => {
        if (selectedTransactionType.value === 'trade') {
            // 거래: 배당락일 ~ 누적 TR 숨김
            const hiddenCols = [
                '배당락일',
                '배당지급일',
                '배당기준',
                '세후배당금($)',
                '외화과표',
                '원화과표',
                '세후배당금(원화)',
                '환율',
                '지급기준',
                '원금회수율',
                '누적배당',
                '누적TR',
            ];
            return !hiddenCols.includes(columnName);
        } else if (selectedTransactionType.value === 'dividend') {
            // 배당: 평단 ~ 거래(원화) 숨김
            const hiddenCols = [
                '평단',
                '보유량',
                '거래(수량)',
                '거래(달러)',
                '거래(원화)',
            ];
            return !hiddenCols.includes(columnName);
        }
        return true; // 전체는 모든 컬럼 표시
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
