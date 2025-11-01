<!-- src/components/asset/StockMappingDialog.vue -->
<template>
    <Dialog
        v-model:visible="isVisible"
        modal
        header="종목명 매핑"
        :style="{ width: '900px', maxHeight: '80vh' }"
        :closable="!isProcessing"
    >
        <div class="flex flex-column gap-3">
            <Message severity="info">
                <div class="flex flex-column gap-2">
                    <strong>종목명을 시스템 티커와 매핑해주세요</strong>
                    <p class="m-0">
                        토스증권의 종목명을 우리 시스템의 티커와 연결합니다.
                        한 번 매핑된 정보는 다른 사용자도 활용할 수 있습니다.
                    </p>
                </div>
            </Message>

            <!-- 진행 상황 -->
            <div class="surface-100 p-3 border-round">
                <div class="flex justify-content-between align-items-center">
                    <span class="font-semibold">진행 상황</span>
                    <Tag
                        :value="`${mappedCount} / ${unmappedStocks.length}`"
                        :severity="mappedCount === unmappedStocks.length ? 'success' : 'warning'"
                    />
                </div>
                <ProgressBar
                    :value="progressPercentage"
                    :showValue="false"
                    class="mt-2"
                />
            </div>

            <!-- 미매핑 종목 리스트 -->
            <div class="flex flex-column gap-3" style="max-height: 50vh; overflow-y: auto;">
                <Card
                    v-for="stock in unmappedStocks"
                    :key="stock.stock_name"
                    class="shadow-1"
                >
                    <template #content>
                        <div class="flex flex-column gap-3">
                            <!-- 종목 정보 -->
                            <div class="flex justify-content-between align-items-start">
                                <div>
                                    <h4 class="m-0 mb-2">{{ stock.stock_name }}</h4>
                                    <div class="text-sm text-color-secondary">
                                        <div v-if="stock.ticker">토스 티커: {{ stock.ticker }}</div>
                                        <div>거래 횟수: {{ stock.count }}회</div>
                                    </div>
                                </div>
                                <Tag
                                    v-if="stock.mappedTicker"
                                    value="매핑 완료"
                                    severity="success"
                                    icon="pi pi-check"
                                />
                            </div>

                            <!-- 매핑 폼 -->
                            <div v-if="!stock.mappedTicker" class="flex gap-2">
                                <span class="p-input-icon-left flex-1">
                                    <i class="pi pi-search" />
                                    <InputText
                                        v-model="stock.searchQuery"
                                        placeholder="시스템 티커 검색 (예: AAPL, TSLA)"
                                        class="w-full"
                                        @input="onSearchTicker(stock)"
                                    />
                                </span>
                                <Button
                                    icon="pi pi-check"
                                    label="매핑"
                                    :disabled="!stock.selectedTicker"
                                    @click="mapStock(stock)"
                                />
                            </div>

                            <!-- 검색 결과 -->
                            <div
                                v-if="stock.searchResults && stock.searchResults.length > 0"
                                class="flex flex-column gap-2"
                            >
                                <div class="text-sm font-semibold">검색 결과:</div>
                                <div class="flex flex-wrap gap-2">
                                    <Chip
                                        v-for="result in stock.searchResults.slice(0, 5)"
                                        :key="result.symbol"
                                        :label="`${result.symbol} - ${result.name}`"
                                        @click="selectTicker(stock, result)"
                                        class="cursor-pointer"
                                        :class="{
                                            'p-chip-primary': stock.selectedTicker === result.symbol,
                                        }"
                                    />
                                </div>
                            </div>

                            <!-- 기존 매핑 정보 표시 -->
                            <div v-if="stock.mappedTicker" class="surface-100 p-3 border-round">
                                <div class="flex justify-content-between align-items-center">
                                    <div>
                                        <div class="font-semibold">{{ stock.mappedTicker }}</div>
                                        <div class="text-sm text-color-secondary">
                                            {{ stock.mappedInfo?.name }}
                                        </div>
                                    </div>
                                    <Button
                                        icon="pi pi-times"
                                        text
                                        rounded
                                        severity="danger"
                                        @click="unmapStock(stock)"
                                    />
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>

                <div v-if="unmappedStocks.length === 0" class="text-center py-5">
                    <i class="pi pi-check-circle text-6xl text-green-500"></i>
                    <p class="text-xl font-semibold mt-3">모든 종목이 매핑되었습니다!</p>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-content-between">
                <Button
                    label="나중에 하기"
                    severity="secondary"
                    @click="skipMapping"
                    :disabled="isProcessing"
                />
                <Button
                    label="완료"
                    @click="completeMapping"
                    :disabled="mappedCount < unmappedStocks.length || isProcessing"
                    :loading="isProcessing"
                />
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
import ProgressBar from 'primevue/progressbar';
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

// 매핑된 종목 수
const mappedCount = computed(() => {
    return unmappedStocks.value.filter((s) => s.mappedTicker).length;
});

// 진행률
const progressPercentage = computed(() => {
    if (unmappedStocks.value.length === 0) return 100;
    return (mappedCount.value / unmappedStocks.value.length) * 100;
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
            });
        }
        stockMap.get(key).count++;
    });

    // 배열로 변환
    const stocks = Array.from(stockMap.values());

    // 기존 매핑 정보 로드
    for (const stock of stocks) {
        const mapping = await getStockMapping(props.brokerage, stock.stock_name);
        if (mapping) {
            stock.mappedTicker = mapping.systemTicker;
            stock.mappedInfo = mapping.stockInfo;
        }
    }

    unmappedStocks.value = stocks;
};

// 티커 검색
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

// 티커 선택
const selectTicker = (stock, result) => {
    stock.selectedTicker = result.symbol;
    stock.mappedInfo = {
        name: result.name,
        exchange: result.exchange,
    };
};

// 종목 매핑
const mapStock = async (stock) => {
    if (!stock.selectedTicker) return;

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
const completeMapping = () => {
    // 매핑 정보를 거래내역에 적용
    const mappingMap = new Map();
    unmappedStocks.value.forEach((stock) => {
        if (stock.mappedTicker) {
            mappingMap.set(stock.stock_name, {
                systemTicker: stock.mappedTicker,
                info: stock.mappedInfo,
            });
        }
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

<style scoped>
.p-chip-primary {
    background-color: var(--primary-color);
    color: white;
}

.cursor-pointer {
    cursor: pointer;
}
</style>

