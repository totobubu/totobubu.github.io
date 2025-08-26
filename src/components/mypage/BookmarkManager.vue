<script setup>
    import { ref, onMounted, computed } from 'vue';
    import { useHead } from '@vueuse/head';

    import { useFilterState } from '@/composables/useFilterState';
    import { joinURL } from 'ufo';

    // PrimeVue 컴포넌트 import
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import InputNumber from 'primevue/inputnumber';
    import Button from 'primevue/button';

    useHead({
        title: '북마크',
    });

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
                ...userData, // avgPrice, quantity 등
            };
        });
    });

    onMounted(async () => {
        // 전체 종목 정보를 불러와 Map에 저장
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const response = await fetch(url);
        const allStockData = (await response.json()).nav;
        allStockInfo.value = new Map(
            allStockData.map((stock) => [stock.symbol, stock])
        );
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

    // --- 숫자 포맷팅 헬퍼 함수 추가 ---
    const formatCurrency = (value, currency = 'USD') => {
        if (value === null || value === undefined || isNaN(value)) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
            }).format(0);
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(value);
    };

    const formatNumber = (value) => {
        if (value === null || value === undefined || isNaN(value)) {
            return '0';
        }
        return new Intl.NumberFormat().format(value);
    };
</script>

<template>
    <div id="t-bookmark">
        <DataTable
            :value="bookmarkedStocks"
            editMode="row"
            dataKey="symbol"
            v-model:editingRows="editingRows"
            @row-edit-save="onRowEditSave"
            class="p-datatable-sm">
            <Column
                field="longName"
                header="종목명"
                style="width: 25%"></Column>

            <!-- 평단가 컬럼 -->
            <Column field="avgPrice" header="평단가" style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatCurrency(data[field], 'USD') }}
                </template>
                <template #editor="{ data, field }">
                    <InputNumber
                        v-model="data[field]"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </template>
            </Column>

            <!-- 수량 컬럼 -->
            <Column field="quantity" header="수량" style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatNumber(data[field]) }} 주
                </template>
                <template #editor="{ data, field }">
                    <InputNumber v-model="data[field]" suffix=" 주" />
                </template>
            </Column>

            <!-- 누적배당금 컬럼 -->
            <Column
                field="accumulatedDividend"
                header="누적배당금"
                style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatCurrency(data[field], 'USD') }}
                </template>
                <template #editor="{ data, field }">
                    <InputNumber
                        v-model="data[field]"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </template>
            </Column>

            <!-- 목표 자산 컬럼 -->
            <Column field="targetAsset" header="목표 자산" style="width: 15%">
                <template #body="{ data, field }">
                    {{ formatCurrency(data[field], 'USD') }}
                </template>
                <template #editor="{ data, field }">
                    <InputNumber
                        v-model="data[field]"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </template>
            </Column>

            <Column
                :rowEditor="true"
                style="width: 10%; min-width: 8rem"
                bodyStyle="text-align:center"></Column>

            <Column bodyStyle="text-align:center" style="width: 5%">
                <template #body="slotProps">
                    <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        @click="deleteBookmark(slotProps.data.symbol)" />
                </template>
            </Column>
        </DataTable>
    </div>
</template>
