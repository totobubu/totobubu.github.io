<!-- src\components\backtester\BacktesterControls.vue -->
<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useRoute } from 'vue-router';
    import MeterGroup from 'primevue/metergroup';
    import Button from 'primevue/button';
    import Divider from 'primevue/divider';
    import { joinURL } from 'ufo';
    import PortfolioInput from './controls/PortfolioInput.vue';
    import DateAndInvestment from './controls/DateAndInvestment.vue';

    const props = defineProps({ isLoading: Boolean });
    const emit = defineEmits(['run']);

    const route = useRoute();
    const allSymbols = ref([]);
    const navDataMap = ref(new Map());

    const portfolio = ref([
        { symbol: '', value: 100, color: '#ef4444', underlying: null },
        { symbol: '', value: 0, color: '#f59e0b', underlying: null },
        { symbol: '', value: 0, color: '#84cc16', underlying: null },
        { symbol: '', value: 0, color: '#3b82f6', underlying: null },
    ]);

    const totalValue = computed(() =>
        portfolio.value.reduce((sum, item) => sum + (item.value || 0), 0)
    );

    const shuffleArray = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    onMounted(async () => {
        try {
            const navUrl = joinURL(import.meta.env.BASE_URL, 'nav.json');
            const navResponse = await fetch(navUrl);
            const navData = await navResponse.json();
            allSymbols.value = navData.nav.map((item) => item.symbol);
            navDataMap.value = new Map(
                navData.nav.map((item) => [item.symbol, item])
            );

            const querySymbol = route.query.symbol?.toUpperCase();

            if (querySymbol && allSymbols.value.includes(querySymbol)) {
                portfolio.value[0].symbol = querySymbol;
            } else {
                const shuffled = shuffleArray([...allSymbols.value]);
                portfolio.value[0].symbol = shuffled.find((s) => s) || '';
            }
        } catch (e) {
            console.error('Error on mount:', e);
        }
    });

    const updateUnderlying = (item) => {
        const navInfo = navDataMap.value.get(item.symbol?.toUpperCase());
        item.underlying = navInfo?.underlying || null;
    };

    watch(
        portfolio,
        (newPortfolio) => {
            newPortfolio.forEach((item) => {
                if (item.symbol) {
                    updateUnderlying(item);
                }
            });
        },
        { deep: true }
    );

    const balanceWeights = () => {
        const activeItems = portfolio.value.filter((p) => p.symbol);
        if (activeItems.length === 0) {
            portfolio.value.forEach((item) => (item.value = 0));
            if (portfolio.value.length > 0) portfolio.value[0].value = 100;
            return;
        }
        const equalWeight = Math.floor(100 / activeItems.length);
        let remainder = 100 % activeItems.length;

        portfolio.value.forEach((item) => {
            if (item.symbol) {
                item.value = equalWeight;
                if (remainder > 0) {
                    item.value++;
                    remainder--;
                }
            } else {
                item.value = 0;
            }
        });
    };

    const addItem = (index) => {
        if (!portfolio.value[index].symbol) {
            const shuffled = shuffleArray([...allSymbols.value]);
            const existingSymbols = portfolio.value.map((p) => p.symbol);
            const newSymbol = shuffled.find(
                (s) => s && !existingSymbols.includes(s)
            );
            portfolio.value[index].symbol = newSymbol || '';
            // When adding a new item, re-balance weights
            balanceWeights();
        }
    };

    const removeItem = (index) => {
        portfolio.value[index].symbol = '';
        portfolio.value[index].value = 0;
        // When removing an item, re-balance weights
        balanceWeights();
    };

    const adjustFirstWeight = () => {
        if (portfolio.value.length > 0 && portfolio.value[0].symbol) {
            const otherSum = portfolio.value
                .slice(1)
                .reduce((sum, item) => sum + (item.value || 0), 0);
            // Ensure the sum of other items doesn't exceed 99 to leave 1% for the first item
            const cappedOtherSum = Math.min(otherSum, 99);

            // If the sum was capped, we need to adjust the item that was just changed
            if (otherSum > 99) {
                // This is a complex UX problem. For now, we'll just cap the sum and let the first item have its minimum.
                // The user will see the total is not 100% and must adjust manually. A better way is handled by the :max prop.
            }

            portfolio.value[0].value = 100 - cappedOtherSum;
        }
    };

    // This function calculates the max value for a slider at a given index (1, 2, or 3)
    const getMaxValueForSlider = (itemIndex) => {
        if (itemIndex === 0) return 100; // Not used, but for safety
        // Sum of all OTHER secondary items (not the current one, not the first one)
        const otherSecondarySum = portfolio.value.reduce((sum, item, index) => {
            if (index > 0 && index !== itemIndex) {
                sum += item.value || 0;
            }
            return sum;
        }, 0);
        // Max value is 99 (to leave 1% for item 1) minus the sum of other sliders
        return 99 - otherSecondarySum;
    };

    watch(
        () => portfolio.value.map((p) => p.value).slice(1),
        adjustFirstWeight,
        { deep: true }
    );

    watch(
        () => portfolio.value.map((p) => p.symbol),
        (newSymbols, oldSymbols) => {
            const newActiveCount = newSymbols.filter(Boolean).length;
            const oldActiveCount = oldSymbols.filter(Boolean).length;
            if (newActiveCount !== oldActiveCount) {
                balanceWeights();
            }
        },
        { deep: true }
    );

    const handleRun = (dateAndInvestmentOptions) => {
        const validPortfolio = portfolio.value.filter(
            (p) => p.symbol && p.value > 0
        );
        if (validPortfolio.length === 0) return;

        const totalWeight = validPortfolio.reduce(
            (sum, item) => sum + item.value,
            0
        );
        if (Math.round(totalWeight) !== 100) {
            alert('비중의 총 합계가 100%가 되어야 합니다.');
            return;
        }

        emit('run', {
            ...dateAndInvestmentOptions,
            portfolio: validPortfolio.map((p) => ({
                ...p,
                symbol: p.symbol.toUpperCase(),
            })),
        });
    };
</script>

<template>
    <div class="p-4 border-round surface-card">
        <MeterGroup :value="portfolio.filter((p) => p.value > 0)" class="mb-4">
            <template #label>
                <PortfolioInput
                    v-model="portfolio"
                    :all-symbols="allSymbols"
                    :get-max-value="getMaxValueForSlider"
                    @addItem="addItem"
                    @removeItem="removeItem" />
            </template>
            <template #meter="slotProps">
                <span
                    :class="slotProps.class"
                    :style="{
                        background: slotProps.value.color,
                        width: slotProps.size,
                    }" />
            </template>
        </MeterGroup>

        <div
            class="flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <span class="text-surface-500"
                >총 합계:
                <span
                    :class="{
                        'text-red-500 font-bold':
                            Math.round(totalValue) !== 100,
                    }"
                    >{{ totalValue }}%</span
                ></span
            >
            <Button
                label="비중 균등 분배"
                @click="balanceWeights"
                severity="secondary"
                text />
        </div>

        <Divider />

        <DateAndInvestment
            :is-loading="isLoading"
            :portfolio="portfolio"
            @run-backtest="handleRun" />
    </div>
</template>
