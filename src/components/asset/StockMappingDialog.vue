<!-- src/components/asset/StockMappingDialog.vue -->
<template>
    <Dialog
        v-model:visible="isVisible"
        modal
        header="종목명 매핑"
        :style="{ width: '900px', maxHeight: '80vh' }"
        :closable="!isProcessing">
        <div class="flex flex-column gap-3">
            <Message severity="info">
                <div class="flex flex-column gap-2">
                    <strong>종목명을 시스템 티커와 매핑해주세요</strong>
                    <p class="m-0">
                        토스증권의 종목명을 우리 시스템의 티커와 연결합니다. 한
                        번 매핑된 정보는 다른 사용자도 활용할 수 있습니다.
                    </p>
                </div>
            </Message>

            <!-- 진행 상황 -->
            <div class="surface-100 p-3 border-round">
                <div class="flex justify-content-between align-items-center">
                    <span class="font-semibold">진행 상황</span>
                    <Tag
                        :value="`${mappedCount} / ${unmappedStocks.length}`"
                        :severity="
                            mappedCount === unmappedStocks.length
                                ? 'success'
                                : 'warning'
                        " />
                </div>
                <div class="progress-skeleton mt-2">
                    <Skeleton
                        height="0.75rem"
                        width="100%"
                        class="progress-track" />
                    <div
                        class="progress-indicator"
                        :style="{
                            width: `${Math.max(progressPercentage, 0)}%`,
                        }"></div>
                </div>
            </div>

            <!-- 미매핑 종목 리스트 -->
            <div
                class="flex flex-column gap-3"
                style="max-height: 50vh; overflow-y: auto">
                <Card
                    v-for="stock in unmappedStocks"
                    :key="stock.stock_name"
                    class="shadow-1">
                    <template #content>
                        <div class="flex flex-column gap-3">
                            <!-- 종목 정보 -->
                            <div
                                class="flex justify-content-between align-items-start gap-3">
                                <div class="flex flex-column gap-1">
                                    <h4 class="m-0 mb-2">
                                        {{ stock.stock_name }}
                                    </h4>
                                    <div class="text-sm text-color-secondary">
                                        <div v-if="stock.ticker">
                                            토스 티커: {{ stock.ticker }}
                                        </div>
                                        <div>
                                            거래 횟수: {{ stock.count }}회
                                        </div>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <Tag
                                        v-if="stock.mappedTicker"
                                        value="매핑 완료"
                                        severity="success"
                                        icon="pi pi-check" />
                                    <Tag
                                        v-else-if="stock.isPending"
                                        value="보류됨"
                                        severity="warning"
                                        icon="pi pi-clock" />
                                </div>
                            </div>

                            <!-- 매핑 폼 -->
                            <div
                                v-if="!stock.mappedTicker"
                                class="flex flex-column gap-2">
                                <div class="flex gap-2">
                                    <span class="p-input-icon-left flex-1">
                                        <i class="pi pi-search" />
                                        <InputText
                                            v-model="stock.searchQuery"
                                            placeholder="티커를 입력하거나 비워둔 채 검색하세요"
                                            class="w-full"
                                            :disabled="stock.isProcessing" />
                                    </span>
                                    <Button
                                        icon="pi pi-check"
                                        :label="stock.selectedTicker ? '저장' : '매핑하기'"
                                        :loading="stock.isProcessing && !stock.isPending"
                                        :disabled="stock.isProcessing"
                                        @click="handleMappingAction(stock)" />
                                    <Button
                                        label="나중에 하기"
                                        severity="secondary"
                                        :disabled="stock.isProcessing || stock.isPending"
                                        @click="deferStock(stock)" />
                                </div>
                                <Message
                                    v-if="stock.statusMessage"
                                    severity="warn"
                                    :closable="false">
                                    {{ stock.statusMessage }}
                                </Message>
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

                <div
                    v-if="unmappedStocks.length === 0"
                    class="text-center py-5">
                    <i class="pi pi-check-circle text-6xl text-green-500"></i>
                    <p class="text-xl font-semibold mt-3">
                        모든 종목이 매핑되었습니다!
                    </p>
                </div>
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
                    :disabled="
                        mappedCount < unmappedStocks.length || isProcessing
                    "
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
    import {
        searchSymbol,
        getStockMapping,
        saveStockMapping,
        deleteStockMapping,
        savePendingStockMapping,
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

    // 처리된 종목 수 (매핑 또는 보류)
    const processedCount = computed(() => {
        return unmappedStocks.value.filter(
            (s) => s.mappedTicker || s.isPending
        ).length;
    });

    const mappedCount = computed(() => {
        return unmappedStocks.value.filter((s) => s.mappedTicker).length;
    });

    // 진행률
    const progressPercentage = computed(() => {
        if (unmappedStocks.value.length === 0) return 100;
        return (processedCount.value / unmappedStocks.value.length) * 100;
    });

    // 거래내역에서 고유 종목 추출
    const extractUniqueStocks = async () => {
        const stockMap = new Map();

        // 종목별로 그룹화
        props.transactions.forEach((t) => {
            const key = t.stock_name;
            if (!stockMap.has(key)) {
                stockMap.set(key, {
                    stock_name: t.stock_name,
                    ticker: t.ticker,
                    count: 0,
                    searchQuery: '',
                    searchResults: [],
                    selectedTicker: null,
                    mappedTicker: null,
                    mappedInfo: null,
                    isPending: false,
                    statusMessage: '',
                    isProcessing: false,
                });
            }
            stockMap.get(key).count++;
        });

        // 배열로 변환
        const stocks = Array.from(stockMap.values());

        // 기존 매핑 정보 로드
        for (const stock of stocks) {
            const mapping = await getStockMapping(
                props.brokerage,
                stock.stock_name
            );
            if (mapping) {
                stock.mappedTicker = mapping.systemTicker;
                stock.mappedInfo = mapping.stockInfo;
            }
        }

        unmappedStocks.value = stocks;
    };

    // 티커 검색
    const searchTickerSuggestions = async (stock) => {
        const query =
            (stock.searchQuery && stock.searchQuery.trim()) ||
            stock.stock_name;

        if (!query) {
            stock.statusMessage = '검색할 키워드를 입력해주세요.';
            return;
        }

        stock.isProcessing = true;
        stock.statusMessage = '';

        try {
            const results = await searchSymbol(query);
            stock.searchResults = results;

            if (!results || results.length === 0) {
                stock.statusMessage =
                    '일치하는 시스템 티커를 찾지 못했습니다. 필요하면 나중에 하기를 눌러 관리자 검토 목록에 추가하세요.';
            } else {
                stock.statusMessage =
                    '검색 결과에서 티커를 선택한 뒤 매핑하기 버튼을 다시 눌러 저장하세요.';
                if (results.length === 1) {
                    selectTicker(stock, results[0]);
                }
            }
        } catch (error) {
            console.error('티커 검색 실패:', error);
            stock.statusMessage = '검색 중 오류가 발생했습니다. 다시 시도해주세요.';
            stock.searchResults = [];
        } finally {
            stock.isProcessing = false;
        }
    };

    // 티커 선택
    const selectTicker = (stock, result) => {
        stock.selectedTicker = result.symbol;
        stock.mappedInfo = {
            name: result.name,
            exchange: result.exchange,
        };
        stock.statusMessage = '선택된 티커를 저장하려면 매핑하기 버튼을 눌러주세요.';
    };

    // 매핑 저장
    const persistMapping = async (stock) => {
        stock.isProcessing = true;
        stock.statusMessage = '';

        try {
            await saveStockMapping(
                props.brokerage,
                stock.stock_name,
                {
                    brokerageTicker: stock.ticker,
                    systemTicker: stock.selectedTicker,
                    stockInfo: stock.mappedInfo,
                },
                user.value?.uid
            );

            stock.mappedTicker = stock.selectedTicker;
            stock.searchQuery = '';
            stock.searchResults = [];
            stock.selectedTicker = null;
            stock.isPending = false;
            stock.statusMessage = '매핑이 저장되었습니다.';
        } catch (error) {
            console.error('매핑 저장 실패:', error);
            stock.statusMessage =
                '매핑 저장에 실패했습니다. 잠시 후 다시 시도해주세요.';
        } finally {
            stock.isProcessing = false;
        }
    };

    const handleMappingAction = async (stock) => {
        if (stock.isProcessing) return;

        if (stock.selectedTicker) {
            await persistMapping(stock);
        } else {
            await searchTickerSuggestions(stock);
        }
    };

    const deferStock = async (stock) => {
        if (stock.isProcessing || stock.isPending) return;

        stock.isProcessing = true;
        stock.statusMessage = '';

        try {
            await savePendingStockMapping(
                props.brokerage,
                stock.stock_name,
                {
                    brokerageTicker: stock.ticker,
                    query: stock.searchQuery || stock.stock_name,
                    reason: 'user_deferred',
                    status: 'waiting',
                },
                user.value?.uid
            );

            stock.isPending = true;
            stock.searchResults = [];
            stock.selectedTicker = null;
            stock.statusMessage =
                '보류 목록에 추가되었습니다. 원본 정보로 거래내역이 등록됩니다.';
        } catch (error) {
            console.error('보류 처리 실패:', error);
            stock.statusMessage = '보류 처리에 실패했습니다. 다시 시도해주세요.';
        } finally {
            stock.isProcessing = false;
        }
    };

    // 매핑 해제
    const unmapStock = async (stock) => {
        try {
            await deleteStockMapping(props.brokerage, stock.stock_name);
            stock.mappedTicker = null;
            stock.mappedInfo = null;
            stock.isPending = false;
            stock.statusMessage = '';
        } catch (error) {
            console.error('매핑 해제 실패:', error);
        }
    };

    // 매핑 완료
    const completeMapping = () => {
        // 매핑 정보를 거래내역에 적용
        const mappingMap = new Map();
        unmappedStocks.value.forEach((stock) => {
            mappingMap.set(stock.stock_name, {
                status: stock.mappedTicker ? 'mapped' : 'pending',
                systemTicker: stock.mappedTicker || null,
                info: stock.mappedInfo,
                originalTicker: stock.ticker,
                originalName: stock.stock_name,
            });
        });

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
