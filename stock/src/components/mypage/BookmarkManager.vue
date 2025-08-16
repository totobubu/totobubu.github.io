<script setup>
import { ref, onMounted, computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import { useFilterState } from '@/composables/useFilterState';
import { joinURL } from 'ufo';

// 1. 새로운 전역 상태인 myBookmarks를 가져옵니다.
const { myBookmarks } = useFilterState();

const isLoading = ref(true);
const allStockInfo = ref(new Map()); // 전체 종목 정보를 Map으로 관리

const editingRows = ref([]);

// 2. DataTable에 표시할 최종 데이터 (북마크 정보 + 전체 종목 정보)
const bookmarkedStocks = computed(() => {
    return Object.entries(myBookmarks.value).map(([symbol, userData]) => {
        const stockInfo = allStockInfo.value.get(symbol);
        return {
            symbol,
            longName: stockInfo?.longName || symbol,
            ...userData // avgPrice, quantity 등
        };
    });
});

onMounted(async () => {
    // 전체 종목 정보를 불러와 Map에 저장
    const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
    const response = await fetch(url);
    const allStockData = (await response.json()).nav;
    allStockInfo.value = new Map(allStockData.map(stock => [stock.symbol, stock]));
    isLoading.value = false;
});

// 3. 인라인 편집이 완료되었을 때 호출되는 함수
const onRowEditSave = (event) => {
    let { newData } = event;
    const symbol = newData.symbol;

    if (myBookmarks.value[symbol]) {
        myBookmarks.value[symbol] = {
            avgPrice: newData.avgPrice || 0,
            quantity: newData.quantity || 0,
            accumulatedDividend: newData.accumulatedDividend || 0,
            targetAsset: newData.targetAsset || 0,
        };
    }
};

// 4. 북마크 삭제 함수
const deleteBookmark = (symbol) => {
    if (myBookmarks.value[symbol]) {
        delete myBookmarks.value[symbol];
        // Vue 3에서는 객체의 속성을 삭제해도 반응성이 유지됩니다.
    }
};

</script>

<template>
    <div id="t-bookmark">
        <p class="mb-4 text-surface-500 dark:text-surface-400">
            북마크된 종목의 정보를 관리합니다. 각 항목을 클릭하여 값을 수정한 후 Enter 키를 누르거나 체크 아이콘을 클릭하여 저장하세요.
        </p>
        <DataTable 
            :value="bookmarkedStocks" 
            editMode="row" 
            dataKey="symbol"
            v-model:editingRows="editingRows"
            @row-edit-save="onRowEditSave"
            class="p-datatable-sm"
        >
            <Column field="longName" header="종목명"></Column>
            
            <Column field="avgPrice" header="평단가">
                <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" mode="decimal" :minFractionDigits="2" />
                </template>
            </Column>

            <Column field="quantity" header="수량">
                 <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" />
                </template>
            </Column>

            <Column field="accumulatedDividend" header="누적배당금">
                 <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" mode="decimal" :minFractionDigits="2" />
                </template>
            </Column>

            <Column field="targetAsset" header="목표 자산">
                 <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" />
                </template>
            </Column>

             <Column :rowEditor="true" style="width: 10%; min-width: 8rem" bodyStyle="text-align:center"></Column>
            
            <Column bodyStyle="text-align:center">
                 <template #body="slotProps">
                    <Button icon="pi pi-trash" severity="danger" text @click="deleteBookmark(slotProps.data.symbol)" />
                </template>
            </Column>
        </DataTable>
    </div>
</template>