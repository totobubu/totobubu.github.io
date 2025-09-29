<!-- src\components\backtester\BacktesterControls.vue -->
<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useRoute } from 'vue-router';
    import MeterGroup from 'primevue/metergroup';
    import Button from 'primevue/button';
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
    ]);

    // --- [핵심 수정] ---
    const displayPortfolio = computed(() => {
        const items = [...portfolio.value];
        const colors = ['#ef4444', '#f59e0b', '#84cc16', '#3b82f6'];

        // 실제 아이템에 색상 할당
        items.forEach((item, index) => {
            item.color = colors[index];
        });

        // 실제 아이템 수가 4개 미만일 때만, 다음 '+' 버튼을 위한 placeholder 하나만 추가
        if (items.length < 4) {
            items.push({ symbol: '', value: 0, color: colors[items.length] });
        }

        // 최대 4개의 카드 레이아웃 유지를 위해 빈 객체 추가 (렌더링은 안 됨)
        while (items.length < 4) {
            items.push({ symbol: null, value: 0 }); // symbol을 null로 하여 구분
        }

        return items;
    });

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
            adjustFirstWeight();
        },
        { deep: true }
    );

    const balanceWeights = () => {
        const activeItems = portfolio.value.filter((p) => p.symbol);
        if (activeItems.length === 0) {
            if (portfolio.value.length > 0) portfolio.value[0].value = 100;
            return;
        }
        const equalWeight = Math.floor(100 / activeItems.length);
        let remainder = 100 % activeItems.length;

        portfolio.value.forEach((item, index) => {
            item.value = equalWeight;
            if (remainder > 0) {
                item.value++;
                remainder--;
            }
        });
    };

    const addItem = () => {
        if (portfolio.value.length >= 4) return;
        const shuffled = shuffleArray([...allSymbols.value]);
        const existingSymbols = portfolio.value.map((p) => p.symbol);
        const newSymbol = shuffled.find(
            (s) => s && !existingSymbols.includes(s)
        );

        portfolio.value.push({
            symbol: newSymbol || '',
            value: 0,
        });
        balanceWeights();
    };

    const removeItem = (index) => {
        if (index > 0 && index < portfolio.value.length) {
            portfolio.value.splice(index, 1);
            balanceWeights();
        }
    };

    const adjustFirstWeight = () => {
        if (portfolio.value.length > 0 && portfolio.value[0].symbol) {
            const otherSum = portfolio.value
                .slice(1)
                .reduce((sum, item) => sum + (item.value || 0), 0);

            const cappedOtherSum = Math.min(otherSum, 99);
            portfolio.value[0].value = 100 - cappedOtherSum;
        }
    };

    const getMaxValueForSlider = (itemIndex) => {
        if (itemIndex === 0) return 100;
        const otherSecondarySum = portfolio.value.reduce((sum, item, index) => {
            if (index > 0 && index !== itemIndex) {
                sum += item.value || 0;
            }
            return sum;
        }, 0);
        return 99 - otherSecondarySum;
    };

    const updatePortfolioItem = (index, item) => {
        if (portfolio.value[index]) {
            portfolio.value[index] = item;
        }
    };

    watch(
        () => portfolio.value.map((p) => p.value).slice(1),
        adjustFirstWeight,
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
    <div class="border-round surface-card" id="t-backtester-controls">
        <div
            class="flex justify-content-between align-items-center flex-wrap gap-2">
            <span class="p-button p-component p-button-secondary"
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
                icon="pi pi-chart-pie"
                @click="balanceWeights"
                severity="secondary" />
        </div>
        <MeterGroup :value="portfolio.filter((p) => p.value > 0)">
            <template #label>
                <PortfolioInput
                    :modelValue="displayPortfolio"
                    :all-symbols="allSymbols"
                    :get-max-value="getMaxValueForSlider"
                    @addItem="addItem"
                    @removeItem="removeItem"
                    @update:portfolioItem="updatePortfolioItem" />
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

        <DateAndInvestment
            :is-loading="isLoading"
            :portfolio="portfolio"
            @run-backtest="handleRun" />
    </div>
</template>
