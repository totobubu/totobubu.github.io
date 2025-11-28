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
                                    slotProps.data.assetName
                                }}</span>
                                <span
                                    v-if="slotProps.data.assetSymbol"
                                    class="text-sm text-color-secondary">
                                    {{ slotProps.data.assetSymbol }}
                                </span>
                            </div>
                        </template>
                    </Column>
                    <Column field="type" header="유형" style="width: 100px">
                        <template #body="slotProps">
                            <Tag
                                :value="slotProps.data.type"
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
                    <Column
                        v-if="
                            mode === 'account' &&
                            transactions.some((t) => t.brokerage)
                        "
                        field="brokerage"
                        header="증권사"
                        style="width: 120px">
                        <template #body="slotProps">
                            {{ slotProps.data.brokerage }}
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
    import ProgressSpinner from 'primevue/progressspinner';

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

    // 유니크한 거래 유형 목록
    const uniqueTypes = computed(() => {
        const types = new Set(
            props.transactions.map((t) => t.type).filter(Boolean)
        );
        return Array.from(types).sort();
    });

    // 필터링된 거래내역
    const filteredTransactions = computed(() => {
        if (!selectedTypeFilter.value) {
            return props.transactions;
        }
        return props.transactions.filter(
            (t) => t.type === selectedTypeFilter.value
        );
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
        if (type === '매수' || type === '입금') {
            return 'text-green-600';
        } else if (type === '매도' || type === '출금') {
            return 'text-red-600';
        }
        return '';
    };
</script>
