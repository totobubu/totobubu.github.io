<!-- src/components/asset/AccountTransactionDialog.vue -->
<template>
    <Dialog
        v-model:visible="isVisible"
        modal
        :header="title"
        :style="{ width: '900px', maxHeight: '90vh' }"
        :closable="true">
        <div class="flex flex-column gap-4">
            <div v-if="isLoading" class="flex justify-content-center p-4">
                <ProgressSpinner />
            </div>

            <div v-else-if="transactions.length === 0" class="text-center p-4">
                <p class="text-color-secondary">거래 내역이 없습니다.</p>
            </div>

            <div v-else class="flex flex-column gap-3">
                <!-- Info message -->
                <Message severity="info" :closable="false">
                    <small
                        >기본적으로 최근 3개월 데이터만 로드됩니다. 더 많은
                        데이터를 보려면 기간 필터를 조정하세요.</small
                    >
                </Message>
                <!-- 유형 필터 -->
                <div class="flex align-items-center gap-2">
                    <label>유형 필터:</label>
                    <div class="flex gap-2">
                        <Button
                            label="전체"
                            :outlined="selectedTypeFilter !== null"
                            size="small"
                            @click="selectedTypeFilter = null" />
                        <Button
                            v-for="type in uniqueTypes"
                            :key="type"
                            :label="type"
                            :outlined="selectedTypeFilter !== type"
                            size="small"
                            @click="selectedTypeFilter = type" />
                    </div>
                </div>

                <!-- 기간 필터 -->
                <div class="flex align-items-center gap-2">
                    <label>기간 필터:</label>
                    <div class="flex gap-2">
                        <Button
                            label="3개월"
                            :outlined="selectedPeriod !== 3"
                            size="small"
                            @click="selectedPeriod = 3" />
                        <Button
                            label="6개월"
                            :outlined="selectedPeriod !== 6"
                            size="small"
                            @click="selectedPeriod = 6" />
                        <Button
                            label="1년"
                            :outlined="selectedPeriod !== 12"
                            size="small"
                            @click="selectedPeriod = 12" />
                        <Button
                            label="2년"
                            :outlined="selectedPeriod !== 24"
                            size="small"
                            @click="selectedPeriod = 24" />
                        <Button
                            label="3년"
                            :outlined="selectedPeriod !== 36"
                            size="small"
                            @click="selectedPeriod = 36" />
                        <Button
                            label="5년"
                            :outlined="selectedPeriod !== 60"
                            size="small"
                            @click="selectedPeriod = 60" />
                        <Button
                            label="전체"
                            :outlined="selectedPeriod !== null"
                            size="small"
                            @click="selectedPeriod = null" />
                    </div>
                </div>

                <!-- 거래내역 테이블 -->
                <DataTable
                    :value="filteredTransactions"
                    stripedRows
                    class="p-datatable-sm"
                    sortField="date"
                    :sortOrder="-1">
                    <Column
                        field="date"
                        header="날짜"
                        sortable
                        style="width: 120px">
                        <template #body="slotProps">
                            {{ formatDate(slotProps.data.date) }}
                        </template>
                    </Column>
                    <Column
                        v-if="mode === 'account'"
                        field="assetName"
                        header="종목"
                        style="min-width: 150px">
                        <template #body="slotProps">
                            <div class="flex flex-column">
                                <span class="font-bold">{{
                                    getAssetDisplayName(slotProps.data)
                                }}</span>
                            </div>
                        </template>
                    </Column>
                    <Column field="type" header="유형" style="width: 100px">
                        <template #body="slotProps">
                            <Tag
                                :value="
                                    getTransactionTypeLabel(
                                        slotProps.data.type,
                                        slotProps.data.rawType
                                    )
                                "
                                :severity="
                                    getTransactionTypeSeverity(
                                        slotProps.data.type
                                    )
                                "
                                size="small" />
                        </template>
                    </Column>
                    <Column field="quantity" header="수량" style="width: 120px">
                        <template #body="slotProps">
                            {{ formatNumber(slotProps.data.quantity) }}
                        </template>
                    </Column>
                    <Column field="price" header="단가" style="width: 130px">
                        <template #body="slotProps">
                            {{ getPrice(slotProps.data) }}
                        </template>
                    </Column>
                    <Column field="amount" header="금액" style="width: 150px">
                        <template #body="slotProps">
                            <span
                                :class="
                                    getAmountColorClass(
                                        slotProps.data.type,
                                        slotProps.data.amount
                                    )
                                ">
                                {{ getAmount(slotProps.data) }}
                            </span>
                        </template>
                    </Column>

                    <template #empty>
                        <div class="text-center p-4">
                            <p class="text-color-secondary">
                                필터 조건에 맞는 거래 내역이 없습니다.
                            </p>
                        </div>
                    </template>
                </DataTable>
            </div>
        </div>
    </Dialog>
</template>

<script setup>
    import { ref, computed } from 'vue';
    import Dialog from 'primevue/dialog';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Tag from 'primevue/tag';
    import Button from 'primevue/button';
    import Message from 'primevue/message';
    import ProgressSpinner from 'primevue/progressspinner';
    import { getTransactionTypeLabel } from '@/utils/transactionTypeMapper';

    const props = defineProps({
        visible: {
            type: Boolean,
            default: false,
        },
        title: {
            type: String,
            default: '거래 내역',
        },
        transactions: {
            type: Array,
            default: () => [],
        },
        mode: {
            type: String,
            default: 'account', // 'account' or 'asset'
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

    // 유형 필터
    const selectedTypeFilter = ref(null);

    // 기간 필터 (개월 단위)
    const selectedPeriod = ref(3); // 기본 3개월

    // 유니크한 거래 유형 목록
    const uniqueTypes = computed(() => {
        const types = new Set(
            props.transactions.map((t) => t.type).filter(Boolean)
        );
        return Array.from(types).sort();
    });

    // 필터링된 거래내역
    const filteredTransactions = computed(() => {
        let filtered = props.transactions;

        // 유형 필터
        if (selectedTypeFilter.value) {
            filtered = filtered.filter(
                (t) => t.type === selectedTypeFilter.value
            );
        }

        // 기간 필터
        if (selectedPeriod.value !== null) {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - selectedPeriod.value);

            filtered = filtered.filter((t) => {
                if (!t.date) return true;

                let transactionDate;
                // Firestore Timestamp 처리
                if (t.date.toDate) {
                    transactionDate = t.date.toDate();
                }
                // YYYYMMDD 형식
                else if (typeof t.date === 'string' && t.date.length === 8) {
                    const year = parseInt(t.date.substring(0, 4));
                    const month = parseInt(t.date.substring(4, 6)) - 1;
                    const day = parseInt(t.date.substring(6, 8));
                    transactionDate = new Date(year, month, day);
                }
                // Date 객체
                else if (t.date instanceof Date) {
                    transactionDate = t.date;
                } else {
                    return true; // 날짜 파싱 실패 시 포함
                }

                return transactionDate >= cutoffDate;
            });
        }

        return filtered;
    });

    const formatDate = (date) => {
        if (!date) return '-';

        // Firestore Timestamp 처리
        if (date.toDate) {
            return date.toDate().toLocaleDateString('ko-KR');
        }

        // YYYYMMDD 형식
        if (typeof date === 'string' && date.length === 8) {
            return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        }

        // Date 객체
        if (date instanceof Date) {
            return date.toLocaleDateString('ko-KR');
        }

        return date;
    };

    const formatNumber = (value) => {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('ko-KR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        }).format(value);
    };

    const formatCurrency = (value, currency) => {
        if (value === undefined || value === null) return '-';

        // 통화 코드 유효성 검사 및 기본값 설정
        let validCurrency = 'KRW';
        if (currency) {
            // 일반적인 통화 코드만 허용
            const validCurrencies = [
                'KRW',
                'USD',
                'EUR',
                'JPY',
                'CNY',
                'GBP',
                'AUD',
                'CAD',
                'CHF',
                'HKD',
                'SGD',
            ];
            validCurrency = validCurrencies.includes(currency.toUpperCase())
                ? currency.toUpperCase()
                : 'KRW';
        }

        try {
            return new Intl.NumberFormat('ko-KR', {
                style: 'currency',
                currency: validCurrency,
                minimumFractionDigits:
                    validCurrency === 'KRW' || validCurrency === 'JPY' ? 0 : 2,
                maximumFractionDigits:
                    validCurrency === 'KRW' || validCurrency === 'JPY' ? 0 : 2,
            }).format(value);
        } catch (error) {
            // 폴백: 통화 기호 없이 숫자만 표시
            return new Intl.NumberFormat('ko-KR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }).format(value);
        }
    };

    // 거래 단가 표시 (통화별로 적절한 필드 선택)
    const getPrice = (transaction) => {
        if (!transaction) return '-';

        // USD 거래인 경우
        if (
            transaction.currency === 'USD' &&
            transaction.priceUSD !== undefined
        ) {
            return formatCurrency(transaction.priceUSD, 'USD');
        }

        // 기본적으로 KRW 또는 price 필드 사용
        if (transaction.price !== undefined && transaction.price !== null) {
            return formatCurrency(
                transaction.price,
                transaction.currency || 'KRW'
            );
        }

        return '-';
    };

    // 거래 금액 표시 (통화별로 적절한 필드 선택)
    const getAmount = (transaction) => {
        if (!transaction) return '-';

        // USD 거래인 경우
        if (
            transaction.currency === 'USD' &&
            transaction.amountUSD !== undefined
        ) {
            return formatCurrency(transaction.amountUSD, 'USD');
        }

        // 기본적으로 KRW 또는 amount 필드 사용
        if (transaction.amount !== undefined && transaction.amount !== null) {
            return formatCurrency(
                transaction.amount,
                transaction.currency || 'KRW'
            );
        }

        return '-';
    };

    const getTransactionTypeSeverity = (type) => {
        switch (type) {
            case '매수':
            case '입금':
                return 'success';
            case '매도':
            case '출금':
                return 'danger';
            case '배당':
            case '이자':
                return 'info';
            default:
                return 'secondary';
        }
    };

    const getAmountColorClass = (type, amount) => {
        if (type === 'buy' || type === 'deposit') {
            return 'text-green-600';
        } else if (type === 'sell' || type === 'withdrawal') {
            return 'text-red-600';
        }
        return '';
    };

    // 자산 표시명 (해외주식은 심볼만)
    const getAssetDisplayName = (transaction) => {
        if (!transaction) return '-';

        // 해외주식인 경우 symbol만 표시
        if (transaction.assetSymbol && transaction.currency !== 'KRW') {
            return transaction.assetSymbol;
        }

        // 국내주식이나 기타는 이름 표시
        return transaction.assetName || transaction.assetSymbol || '-';
    };
</script>
