<script setup>
    import { ref, computed, watch } from 'vue';
    import { usePortfolioBacktester } from '@/composables/usePortfolioBacktester';
    import Toast from 'primevue/toast';
    import BacktesterControls from './BacktesterControls.vue';
    import BacktesterChart from './BacktesterChart.vue';
    import Dialog from 'primevue/dialog';
    import Button from 'primevue/button';

    const {
        allAvailableStocks,
        selectedSymbols,
        backtestResult,
        isLoading,
        dialog,
        validateAndRun,
    } = usePortfolioBacktester();

    // [핵심 수정] 시작일과 종료일을 하나의 ref 배열로 관리
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    const dateRange = ref([oneYearAgo, today]);

    const filteredAvailableStocks = computed(() => {
        // [수정] dateRange 배열의 첫 번째 요소(시작일)를 기준으로 필터링
        const [start] = dateRange.value;
        if (!start) return allAvailableStocks.value;

        return allAvailableStocks.value.filter(
            (stock) => !stock.ipoDate || new Date(stock.ipoDate) <= start
        );
    });

    watch(dateRange, () => {
        const validSymbols = new Set(
            filteredAvailableStocks.value.map((s) => s.symbol)
        );
        selectedSymbols.value = selectedSymbols.value.filter((symbol) =>
            validSymbols.has(symbol)
        );
    });
</script>

<template>
    <div class="portfolio-backtester">
        <Toast />
        <BacktesterControls
            :available-stocks="filteredAvailableStocks"
            v-model:selected-symbols="selectedSymbols"
            v-model:date-range="dateRange"
            @run="validateAndRun" />
        <div class="mt-4">
            <BacktesterChart :result="backtestResult" :is-loading="isLoading" />
        </div>
        <Dialog
            v-model:visible="dialog.visible"
            modal
            header="백테스팅 시작일 확인"
            :style="{ width: '30rem' }">
            <p>{{ dialog.message }}</p>
            <div class="flex justify-content-end gap-2 mt-4">
                <Button
                    v-for="option in dialog.options"
                    :key="option.value"
                    :label="option.label"
                    @click="
                        dialog.onConfirm(option.value);
                        dialog.visible = false;
                    "></Button>
            </div>
        </Dialog>
    </div>
</template>
