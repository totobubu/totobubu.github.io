<script setup>
    import { ref, reactive, onMounted, computed, watch } from 'vue';
    import { joinURL } from 'ufo';
    import Toast from 'primevue/toast';
    import Button from 'primevue/button';
    import Card from 'primevue/card';
    import Accordion from 'primevue/accordion';
    import AccordionPanel from 'primevue/accordionpanel';
    import AccordionHeader from 'primevue/accordionheader';
    import AccordionContent from 'primevue/accordioncontent';

    import BacktesterControls from './BacktesterControls.vue';
    import BacktesterStocks from './BacktesterStocks.vue';
    import BacktesterReinvestment from './BacktesterReinvestment.vue';
    import BacktesterChart from './BacktesterChart.vue';
    import { usePortfolioBacktester } from '@/composables/usePortfolioBacktester';

    const allAvailableStocks = ref([]);
    const backtestResult = ref(null);
    const isLoading = ref(false);

    const backtestConfig = reactive({
        mode: 'backtest', // 'backtest' 또는 'forecast'
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

    // [핵심] 모드 또는 날짜 변경 시 환율 자동 업데이트
    watch(
        () => [backtestConfig.mode, backtestConfig.startDate],
        ([newMode, newStartDate]) => {
            const targetDate =
                newMode === 'backtest' ? newStartDate : new Date();
            if (targetDate) {
                const dateStr = targetDate.toISOString().split('T')[0];
                console.log(`${dateStr}의 환율을 가져오는 API 호출...`);
                // 예시: const rate = await fetchRate(targetDate);
                // backtestConfig.exchangeRate = rate;
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

    const active = ref('0');
</script>

<template>
    <div class="portfolio-backtester">
        <Toast />

        <Card>
            <template #title>
                <div class="flex justify-content-between w-full">
                    <Button
                        label="분석"
                        icon="pi pi-play"
                        size="small"
                        @click="handleRunBacktest"
                        :loading="isLoading" />
                    <div class="flex gap-2 justify-end">
                        <Button
                            @click="active = '0'"
                            label="1"
                            class="w-1rem"
                            :outlined="active !== '0'" />
                        <Button
                            @click="active = '1'"
                            label="2"
                            class="w-1rem"
                            :outlined="active !== '1'" />
                        <Button
                            @click="active = '2'"
                            label="3"
                            class="w-1rem"
                            :outlined="active !== '2'" />
                    </div>
                </div>
            </template>
            <template #content>
                <Accordion v-model:value="active">
                    <AccordionPanel value="0">
                        <AccordionHeader
                            >1. 투자 설정 {{ backtestConfig.mode }}
                            {{ backtestConfig.startDate }}
                            {{ backtestConfig.endDate }}</AccordionHeader
                        >
                        <AccordionContent>
                            <BacktesterControls
                                v-model:mode="backtestConfig.mode"
                                v-model:startDate="backtestConfig.startDate"
                                v-model:endDate="backtestConfig.endDate"
                                v-model:exchangeRate="
                                    backtestConfig.exchangeRate
                                "
                                v-model:commission="backtestConfig.commission"
                                :totalInvestmentUSD="totalInvestmentUSD" />
                        </AccordionContent>
                    </AccordionPanel>
                    <AccordionPanel value="1">
                        <AccordionHeader>2. 투자 종목</AccordionHeader>
                        <AccordionContent>
                            <BacktesterStocks
                                v-model:stocks="backtestConfig.stocks"
                                :available-stocks="allAvailableStocks" />
                        </AccordionContent>
                    </AccordionPanel>
                    <AccordionPanel value="2">
                        <AccordionHeader>3. 재투자 종목</AccordionHeader>
                        <AccordionContent>
                            <BacktesterReinvestment
                                v-model:rules="backtestConfig.reinvestmentRules"
                                :available-stocks="allAvailableStocks" />
                        </AccordionContent>
                    </AccordionPanel>
                </Accordion>
            </template>
        </Card>

        <BacktesterChart :result="backtestResult" :is-loading="isLoading" />
    </div>
</template>
