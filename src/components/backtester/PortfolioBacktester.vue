<script setup>
    import { ref, reactive, onMounted, computed, watch } from 'vue';
    import { joinURL } from 'ufo';
    import Toast from 'primevue/toast';
    import Button from 'primevue/button';
    import BacktesterControls from './BacktesterControls.vue';
    import BacktesterStocks from './BacktesterStocks.vue';
    import BacktesterReinvestment from './BacktesterReinvestment.vue';
    import BacktesterChart from './BacktesterChart.vue';
    import { usePortfolioBacktester } from '@/composables/usePortfolioBacktester';

    const allAvailableStocks = ref([]);
    const backtestResult = ref(null);
    const isLoading = ref(false);

    const backtestConfig = reactive({
        startDate: new Date(
            new Date().setFullYear(new Date().getFullYear() - 1)
        ),
        endDate: new Date(new Date().setDate(new Date().getDate() - 1)),
        exchangeRate: 1350,
        commission: 0.1,
        stocks: [],
        reinvestmentRules: [
            { key: `reinvest-${Date.now()}`, targetSymbol: 'CASH', ratio: 100 },
        ],
    });

    const { validateAndRun } = usePortfolioBacktester(
        isLoading,
        backtestResult,
        allAvailableStocks
    );

    const totalInvestmentUSD = computed(() => {
        return backtestConfig.stocks.reduce((sum, stock) => {
            return sum + (stock.quantity || 0) * (stock.avgPrice || 0);
        }, 0);
    });

    watch(
        () => backtestConfig.startDate,
        (newDate) => {
            if (newDate) {
                console.log(
                    `${newDate.toISOString().split('T')[0]}의 환율 API 호출...`
                );
                backtestConfig.exchangeRate =
                    1350 + Math.floor(Math.random() * 50) - 25;
            }
        },
        { immediate: true }
    );

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
        validateAndRun(backtestConfig);
    };
</script>

<template>
    <div class="portfolio-backtester">
        <Toast />

        <div class="grid">
            <div class="col-12 lg:col-5 xl:col-4">
                <div class="flex flex-column gap-4">
                    <BacktesterControls
                        v-model:startDate="backtestConfig.startDate"
                        v-model:endDate="backtestConfig.endDate"
                        v-model:exchangeRate="backtestConfig.exchangeRate"
                        v-model:commission="backtestConfig.commission"
                        :totalInvestmentUSD="totalInvestmentUSD" />
                    <BacktesterStocks
                        v-model:stocks="backtestConfig.stocks"
                        :available-stocks="allAvailableStocks" />
                    <BacktesterReinvestment
                        v-model:rules="backtestConfig.reinvestmentRules"
                        :available-stocks="allAvailableStocks" />
                </div>
            </div>

            <div class="col-12 lg:col-7 xl:col-8">
                <div class="flex justify-content-end mb-4">
                    <Button
                        label="백테스팅 실행"
                        icon="pi pi-play"
                        @click="handleRunBacktest"
                        :loading="isLoading" />
                </div>
                <BacktesterChart
                    :result="backtestResult"
                    :is-loading="isLoading" />
            </div>
        </div>
    </div>
</template>
