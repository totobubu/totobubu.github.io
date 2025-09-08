<script setup>
    import { ref, onMounted } from 'vue';
    import { joinURL } from 'ufo';
    import Toast from 'primevue/toast';
    import Button from 'primevue/button';
    import BacktesterControls from './BacktesterControls.vue';
    import BacktesterOrgChart from './BacktesterOrgChart.vue';
    import BacktesterChart from './BacktesterChart.vue';
    import { usePortfolioBacktester } from '@/composables/usePortfolioBacktester';

    const allAvailableStocks = ref([]);
    const backtestResult = ref(null);
    const isLoading = ref(false);

    const { runBacktest, calculateBacktest, validateAndRun } =
        usePortfolioBacktester(isLoading, backtestResult, allAvailableStocks);

    const portfolioTree = ref({
        key: 'root',
        children: [{ key: 'add-stock', type: 'add-button' }],
    });

    const backtestOptions = ref({
        startDate: new Date(
            new Date().setFullYear(new Date().getFullYear() - 1)
        ),
        endDate: new Date(new Date().setDate(new Date().getDate() - 1)),
        initialInvestment: 10000000,
        exchangeRate: 1350,
        commission: 0.1,
        reinvestmentStrategy: '셀프 재투자',
        reinvestmentTarget: null,
    });

    onMounted(async () => {
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const response = await fetch(url);
        const allStockData = (await response.json()).nav;
        allAvailableStocks.value = allStockData
            .filter((stock) => !stock.upcoming)
            .map((stock) => ({
                symbol: stock.symbol,
                longName: `${stock.symbol} - ${stock.company || '개별 주식'}`,
                ipoDate: stock.ipoDate,
            }))
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    });

    const handleRunBacktest = () => {
        const selectedStocksData = portfolioTree.value.children.filter(
            (c) => c.type === 'stock'
        );
        validateAndRun(backtestOptions.value, selectedStocksData);
    };
</script>

<template>
    <div class="portfolio-backtester">
        <Toast />

        <BacktesterControls v-model:options="backtestOptions" class="mb-4" />

        <BacktesterOrgChart
            v-model:value="portfolioTree"
            :available-stocks="allAvailableStocks"
            class="mb-4" />

        <div class="flex justify-content-end mb-4">
            <Button
                label="백테스팅 실행"
                icon="pi pi-play"
                @click="handleRunBacktest"
                :loading="isLoading" />
        </div>

        <BacktesterChart :result="backtestResult" :is-loading="isLoading" />
    </div>
</template>
