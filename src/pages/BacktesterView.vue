<script setup>
    import { ref, watch } from 'vue';
    import { useHead } from '@vueuse/head';
    import BacktesterControls from '@/components/backtester/BacktesterControls.vue';
    import BacktesterResults from '@/components/backtester/BacktesterResults.vue';
    import { runBacktest } from '@/services/backtestEngine.js';
    import { useToast } from 'primevue/usetoast';
    import { joinURL } from 'ufo';
    import Toast from 'primevue/toast';
    import Message from 'primevue/message';

    useHead({ title: '백테스팅' });

    const toast = useToast();
    const backtestResult = ref(null);
    const isLoading = ref(false);
    const adjustedDateMessage = ref('');

    const handleRun = async (options) => {
        isLoading.value = true;
        backtestResult.value = null;
        adjustedDateMessage.value = '';

        try {
            const portfolioSymbols = options.portfolio
                .map((p) => p.symbol)
                .filter(Boolean);
            if (portfolioSymbols.length === 0) {
                throw new Error('백테스팅할 종목을 입력해주세요.');
            }
            if (!options.startDate || !options.endDate) {
                throw new Error('시작일과 종료일을 모두 선택해주세요.');
            }

            const symbolsToFetch = [
                ...portfolioSymbols,
                options.comparisonSymbol,
            ].filter((s) => s && s !== 'None');
            const uniqueSymbols = [...new Set(symbolsToFetch)];

            const apiPromises = uniqueSymbols.map((symbol) =>
                fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${symbol.toLowerCase()}.json`
                    )
                )
                    .then((res) => {
                        if (!res.ok)
                            throw new Error(
                                `[${symbol}] 데이터 파일을 찾을 수 없습니다.`
                            );
                        return res.json();
                    })
                    .then((data) => {
                        if (!data.backtestData)
                            throw new Error(
                                `[${symbol}] 백테스팅 데이터가 없습니다.`
                            );
                        return {
                            symbol: symbol.toUpperCase(),
                            ...data.backtestData,
                        };
                    })
                    .catch((error) => ({
                        symbol: symbol.toUpperCase(),
                        error: error.message,
                        prices: [],
                        dividends: [],
                        splits: [],
                    }))
            );

            const tickerData = await Promise.all(apiPromises);

            const exchangeResponse = await fetch(
                joinURL(import.meta.env.BASE_URL, 'exchange-rates.json')
            );
            if (!exchangeResponse.ok)
                throw new Error('환율 데이터를 불러올 수 없습니다.');
            const exchangeRates = await exchangeResponse.json();

            const apiData = { tickerData, exchangeRates };

            let effectiveStartDate = options.startDate
                .toISOString()
                .split('T')[0];
            const ipoDates = apiData.tickerData
                .filter((d) => portfolioSymbols.includes(d.symbol))
                .map((d) =>
                    d.prices && d.prices.length > 0 ? d.prices[0].date : null
                )
                .filter(Boolean)
                .map((dateStr) => new Date(dateStr));

            if (ipoDates.length > 0) {
                const latestIpoDate = new Date(Math.max.apply(null, ipoDates));
                const userStartDate = new Date(options.startDate);
                if (userStartDate < latestIpoDate) {
                    effectiveStartDate = latestIpoDate
                        .toISOString()
                        .split('T')[0];
                    adjustedDateMessage.value = `시작일이 ${effectiveStartDate}로 자동 조정되었습니다. (선택한 모든 종목이 거래 가능한 가장 빠른 날짜)`;
                }
            }

            const holidayResponse = await fetch(
                joinURL(import.meta.env.BASE_URL, 'holidays.json')
            );
            const holidays = await holidayResponse.json();

            const result = runBacktest({
                ...options,
                startDate: effectiveStartDate,
                apiData,
                holidays,
            });

            backtestResult.value = result;
        } catch (error) {
            console.error('Backtest Run Failed:', error);
            toast.add({
                severity: 'error',
                summary: '백테스팅 오류',
                detail: error.message,
                life: 5000,
            });
            backtestResult.value = { error: error.message };
        } finally {
            isLoading.value = false;
        }
    };
</script>

<template>
    <div>
        <Toast />
        <BacktesterControls @run="handleRun" :is-loading="isLoading" />
        <Message
            v-if="adjustedDateMessage"
            severity="info"
            :closable="false"
            class="mt-4">
            {{ adjustedDateMessage }}
        </Message>
        <BacktesterResults :result="backtestResult" :is-loading="isLoading" />
    </div>
</template>
