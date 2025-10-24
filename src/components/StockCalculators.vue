<!-- Components/StockCaculators.vue -->
<script setup>
    import { ref } from 'vue';
    import Button from 'primevue/button';
    import Drawer from 'primevue/drawer';
    import SelectButton from 'primevue/selectbutton'; // SelectButton import
    import ProgressSpinner from 'primevue/progressspinner'; // 로딩 스피너 import
    import StockCalculatorsUnified from './calculators/StockCalculatorsUnified.vue';

    defineProps({
        dividendHistory: Array,
        tickerInfo: Object,
        userBookmark: Object,
    });

    const isDrawerVisible = ref(false);

    // --- [핵심 수정] 계산기 선택 상태를 부모로 이동 ---
    const activeCalculator = ref('recovery');
    const calculatorOptions = ref([
        { label: '원금 회수', value: 'recovery' },
        { label: '목표 달성', value: 'reinvestment' },
        { label: '예상 배당', value: 'yield' },
    ]);

    const headerInfo = ref({
        currentPrice: 0,
        exchangeRate: 0,
        isUSD: true,
        currency: 'USD',
        currencyLocale: 'en-US',
    });

    const handleHeaderInfoUpdate = (info) => {
        headerInfo.value = info;
    };
</script>

<template>
    <div id="t-calculator-button">
        <Button
            icon="pi pi-calculator"
            @click="isDrawerVisible = true"
            severity="secondary"
            text
            aria-label="Calculators" />

        <Drawer
            id="t-stock-calculator"
            v-model:visible="isDrawerVisible"
            position="bottom"
            style="height: auto"
            modal>
            <template #header>
                <SelectButton
                    v-model="activeCalculator"
                    :options="calculatorOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full" />
                <!-- [수정] 데이터가 있을 때만 헤더 정보 표시 -->
                <div
                    v-if="headerInfo.currentPrice > 0"
                    class="flex align-items-center justify-content-end gap-2 text-sm">
                    <Tag v-if="!headerInfo.isUSD" severity="contrast">
                        환율 :
                        {{ headerInfo.exchangeRate?.toLocaleString('ko-KR') }}원
                    </Tag>
                    <Tag severity="contrast">
                        현재 주가 :
                        {{
                            headerInfo.currentPrice?.toLocaleString(
                                headerInfo.currencyLocale,
                                {
                                    style: 'currency',
                                    currency: headerInfo.currency,
                                }
                            )
                        }}
                    </Tag>
                </div>
            </template>
            <!-- [핵심 수정] 데이터가 준비되었을 때만 계산기 컴포넌트를 렌더링 -->
            <div
                v-if="
                    isDrawerVisible &&
                    dividendHistory &&
                    dividendHistory.length > 0
                ">
                <StockCalculatorsUnified
                    :active-calculator="activeCalculator"
                    :dividendHistory="dividendHistory"
                    :tickerInfo="tickerInfo"
                    :userBookmark="userBookmark" />
            </div>
            <!-- 데이터가 없을 경우 로딩 인디케이터 표시 -->
            <div v-else class="flex justify-content-center align-items-center" style="min-height: 300px;">
                <ProgressSpinner />
            </div>
        </Drawer>
    </div>
</template>
