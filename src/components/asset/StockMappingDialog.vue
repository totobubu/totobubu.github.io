<!-- src/components/asset/StockMappingDialog.vue -->
<template>
    <Dialog
        v-model:visible="isVisible"
        modal
        header="종목명 매핑"
        :style="{ width: '900px', maxHeight: '90vh' }"
        :closable="!isProcessing">
        <div class="flex flex-column gap-4">
            <Message severity="info">
                <div class="flex flex-column gap-2">
                    <strong>종목명을 시스템 티커와 매핑해주세요</strong>
                    <p class="m-0">
                        토스증권의 종목명을 우리 시스템의 티커와 연결합니다.
                    </p>
                </div>
            </Message>

            <!-- 1. 수동 매핑이 필요한 종목 (검색 결과가 없거나 여러 개인 경우) -->
            <div v-if="manualMappingStocks.length > 0">
                <h3 class="text-lg font-bold mb-3">
                    수동 매핑 필요 ({{ manualMappingStocks.length }})
                </h3>
                <div
                    class="flex flex-column gap-3"
                    style="max-height: 40vh; overflow-y: auto">
                    <Card
                        v-for="stock in manualMappingStocks"
                        :key="stock.stock_name"
                        class="shadow-1">
                        <template #content>
                            <div class="flex flex-column gap-3">
                                <div
                                    class="flex justify-content-between align-items-start">
                                    <div>
                                        <h4 class="m-0 mb-2">
                                            {{ stock.stock_name }}
                                        </h4>
                                        <div
                                            class="text-sm text-color-secondary">
                                            <div v-if="stock.ticker">
                                                ISIN: {{ stock.ticker }}
                                            </div>
                                            <div>
                                                거래 횟수: {{ stock.count }}회
                                            </div>
                                        </div>
                                    </div>
                                    <Tag
                                        v-if="stock.mappedTicker"
                                        value="매핑 완료"
                                        severity="success"
                                        icon="pi pi-check" />
                                </div>

                                <!-- 매핑 폼 -->
                                <div
                                    v-if="!stock.mappedTicker"
                                    class="flex gap-2">
                                    <InputGroup>
                                        <InputGroupAddon>
                                            <i class="pi pi-search"></i>
                                        </InputGroupAddon>
                                        <InputText
                                            v-model="stock.searchQuery"
                                            placeholder="시스템 티커 검색 (예: AAPL, TSLA)"
                                            class="w-full"
                                            @input="debouncedSearch(stock)" />
                                        <InputGroupAddon>
                                            <Button
                                                icon="pi pi-check"
                                                label="매핑"
                                                :disabled="
                                                    !stock.selectedTicker
                                                "
                                                @click="mapStock(stock)" />
                                        </InputGroupAddon>
                                    </InputGroup>
                                </div>

                                <!-- 검색 결과 -->
                                <div
                                    v-if="
                                        stock.searchResults &&
                                        stock.searchResults.length > 0
                                    "
                                    class="flex flex-column gap-2">
                                    <div class="text-sm font-semibold">
                                        검색 결과:
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Chip
                                            v-for="result in stock.searchResults.slice(
                                                0,
                                                5
                                            )"
                                            :key="result.symbol"
                                            :label="`${result.symbol} - ${result.name}`"
                                            @click="selectTicker(stock, result)"
                                            class="cursor-pointer"
                                            :class="{
                                                'p-chip-primary':
                                                    stock.selectedTicker ===
                                                    result.symbol,
                                            }" />
                                    </div>
                                </div>

                                <!-- 기존 매핑 정보 표시 -->
                                <div
                                    v-if="stock.mappedTicker"
                                    class="surface-100 p-3 border-round">
                                    <div
                                        class="flex justify-content-between align-items-center">
                                        <div>
                                            <div class="font-semibold">
                                                {{ stock.mappedTicker }}
                                            </div>
                                            <div
                                                class="text-sm text-color-secondary">
                                                {{ stock.mappedInfo?.name }}
                                            </div>
                                        </div>
                                        <Button
                                            icon="pi pi-times"
                                            text
                                            rounded
                                            severity="danger"
                                            @click="unmapStock(stock)" />
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>
            </div>

            <!-- 2. 자동 매핑된 종목 (확실한 매핑) -->
            <div v-if="autoMatchedStocks.length > 0" class="mt-4">
                <h3 class="text-lg font-bold mb-3">
                    자동 매핑됨 ({{ autoMatchedStocks.length }})
                </h3>
                <DataTable
                    :value="autoMatchedStocks"
                    stripedRows
                    class="p-datatable-sm shadow-1"
                    scrollable
                    scrollHeight="300px">
                    <Column field="ticker" header="ISIN"></Column>
                    <Column field="selectedTicker" header="티커"></Column>
                    <Column field="stock_name" header="종목명"></Column>
                    <Column field="count" header="거래횟수">
                        <template #body="slotProps">
                            {{ slotProps.data.count }}회
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div v-if="isLoading" class="flex flex-column gap-3">
                <Skeleton height="10rem" class="w-full" />
                <Skeleton height="10rem" class="w-full" />
            </div>
        </div>

        <template #footer>
            <div class="flex justify-content-between">
                <Button
                    label="나중에 하기"
                    severity="secondary"
                    @click="skipMapping"
                    :disabled="isProcessing" />
                <Button
                    label="완료"
                    @click="completeMapping"
                    :loading="isProcessing" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
    import { ref, computed, watch } from 'vue';
    import Dialog from 'primevue/dialog';
    import Button from 'primevue/button';
    import Card from 'primevue/card';
    import InputText from 'primevue/inputtext';
    import Message from 'primevue/message';
    import Tag from 'primevue/tag';
    import Chip from 'primevue/chip';
    import Skeleton from 'primevue/skeleton';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import { searchSymbol } from '@/composables/useStockMapping';
    import {
        getStockMapping,
        saveStockMapping,
        deleteStockMapping,
    } from '@/composables/useStockMapping';
    import { user } from '@/store/auth';

    const props = defineProps({
        visible: {
            type: Boolean,
            default: false,
        },
        transactions: {
            type: Array,
            required: true,
        },
        brokerage: {
            type: String,
            required: true,
        },
    });

    const emit = defineEmits(['update:visible', 'mapping-complete']);

    const isVisible = computed({
        get: () => props.visible,
        set: (value) => emit('update:visible', value),
    });

    const isProcessing = ref(false);

    // 매핑되지 않은 종목 추출 및 구조화
    const unmappedStocks = ref([]);

    // 수동 매핑이 필요한 종목
    const manualMappingStocks = computed(() => {
        return unmappedStocks.value.filter((s) => !s.isAutoMatched);
    });

    // 자동 매핑된 종목
    const autoMatchedStocks = computed(() => {
        return unmappedStocks.value.filter((s) => s.isAutoMatched);
    });

    // 디바운스 유틸리티
    const debounce = (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    };

    const isLoading = ref(false);

    // 거래내역에서 고유 종목 추출
    const extractUniqueStocks = async () => {
        isLoading.value = true;
        const stockMap = new Map();

        // 종목별로 그룹화
        props.transactions.forEach((t) => {
            const key = t.stock_name;
            if (!stockMap.has(key)) {
                stockMap.set(key, {
                    stock_name: t.stock_name,
                    ticker: t.ticker, // ISIN
                    count: 0,
                    searchQuery: '',
                    searchResults: [],
                    selectedTicker: null,
                    mappedTicker: null,
                    mappedInfo: null,
                    isAutoMatched: false, // 자동 매핑 여부
                });
            }
            stockMap.get(key).count++;
        });

        // 배열로 변환
        const stocks = Array.from(stockMap.values());

        // 기존 매핑 로드 및 ISIN 자동 검색
        for (const stock of stocks) {
            // 1. 기존 매핑 확인
            const mapping = await getStockMapping(
                props.brokerage,
                stock.stock_name
            );
            if (mapping) {
                stock.mappedTicker = mapping.systemTicker;
                stock.mappedInfo = mapping.stockInfo;
                // 이미 매핑된 경우 수동 리스트에 표시 (수정 가능하도록) 또는 자동 리스트로 보낼 수도 있음
                // 요구사항: "확실한 매핑일 경우 하단에 나열" -> 이미 매핑된 것도 포함?
                // 일단 이미 매핑된 것은 수동 리스트에서 '매핑 완료'로 표시하는 기존 로직 유지
            } else if (stock.ticker) {
                // 2. 매핑이 없고 ISIN이 있으면 자동 검색 시도
                try {
                    const results = await searchSymbol(stock.ticker);
                    if (results && results.length > 0) {
                        stock.searchResults = results;

                        // 결과가 1개면 자동 선택 및 자동 매핑 리스트로 이동
                        if (results.length === 1) {
                            selectTicker(stock, results[0]);
                            stock.isAutoMatched = true;
                        } else {
                            stock.searchQuery = stock.ticker; // 검색창에 ISIN 표시
                        }
                    } else {
                        // 검색 결과가 없으면 검색창 비워두기 (사용자가 직접 입력)
                        stock.searchQuery = '';
                    }
                } catch (e) {
                    console.warn('ISIN 자동 검색 실패:', e);
                    stock.searchQuery = '';
                }
            }
        }

        unmappedStocks.value = stocks;
        isLoading.value = false;
    };

    // 티커 검색 (디바운스 적용)
    const onSearchTicker = async (stock) => {
        if (!stock.searchQuery || stock.searchQuery.length < 2) {
            stock.searchResults = [];
            return;
        }

        try {
            const results = await searchSymbol(stock.searchQuery);
            stock.searchResults = results;
        } catch (error) {
            console.error('티커 검색 실패:', error);
            stock.searchResults = [];
        }
    };

    const debouncedSearch = debounce((stock) => onSearchTicker(stock), 500);

    // 티커 선택
    const selectTicker = (stock, result) => {
        stock.selectedTicker = result.symbol;
        stock.mappedInfo = {
            name: result.name,
            exchange: result.exchange,
        };
    };

    // 종목 매핑 (수동)
    const mapStock = async (stock) => {
        if (!stock.selectedTicker) return;

        if (!user.value?.uid) {
            console.error('로그인이 필요합니다.');
            return;
        }

        try {
            await saveStockMapping(
                props.brokerage,
                stock.stock_name,
                {
                    brokerageTicker: stock.ticker, // ISIN
                    systemTicker: stock.selectedTicker,
                    stockInfo: stock.mappedInfo,
                },
                user.value.uid
            );

            stock.mappedTicker = stock.selectedTicker;
            stock.searchQuery = '';
            stock.searchResults = [];
            stock.selectedTicker = null;
        } catch (error) {
            console.error('매핑 저장 실패:', error);
        }
    };

    // 매핑 해제
    const unmapStock = async (stock) => {
        try {
            await deleteStockMapping(props.brokerage, stock.stock_name);
            stock.mappedTicker = null;
            stock.mappedInfo = null;
        } catch (error) {
            console.error('매핑 해제 실패:', error);
        }
    };

    // 매핑 완료
    const completeMapping = async () => {
        isProcessing.value = true;

        // 1. 자동 매핑된 항목들 일괄 저장
        const autoSavePromises = autoMatchedStocks.value.map((stock) => {
            // 이미 저장된(mappedTicker가 있는) 경우는 제외
            if (stock.mappedTicker) return Promise.resolve();

            if (!user.value?.uid) return Promise.resolve();

            return saveStockMapping(
                props.brokerage,
                stock.stock_name,
                {
                    brokerageTicker: stock.ticker,
                    systemTicker: stock.selectedTicker,
                    stockInfo: stock.mappedInfo,
                },
                user.value.uid
            )
                .then(() => {
                    stock.mappedTicker = stock.selectedTicker;
                })
                .catch((err) => {
                    console.error(
                        `자동 매핑 저장 실패 (${stock.stock_name}):`,
                        err
                    );
                    // 권한 오류 등으로 저장이 실패하더라도, 현재 세션에서는 자산을 등록할 수 있도록 처리
                    stock.mappedTicker = stock.selectedTicker;
                });
        });

        await Promise.all(autoSavePromises);

        // 2. 결과 방출
        const mappingMap = new Map();
        unmappedStocks.value.forEach((stock) => {
            // 수동 매핑 완료된 것 + 자동 매핑된 것 모두 포함
            if (
                stock.mappedTicker ||
                (stock.isAutoMatched && stock.selectedTicker)
            ) {
                mappingMap.set(stock.stock_name, {
                    systemTicker: stock.mappedTicker || stock.selectedTicker,
                    info: stock.mappedInfo,
                });
            }
        });

        isProcessing.value = false;
        emit('mapping-complete', mappingMap);
        closeDialog();
    };

    // 나중에 하기
    const skipMapping = () => {
        closeDialog();
    };

    // 다이얼로그 닫기
    const closeDialog = () => {
        isVisible.value = false;
    };

    // visible 변경 시 데이터 로드
    watch(
        () => props.visible,
        (newVal) => {
            if (newVal) {
                extractUniqueStocks();
            }
        }
    );
</script>
