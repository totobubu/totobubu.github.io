<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import { useRoute } from 'vue-router';
    import MeterGroup from 'primevue/metergroup';
    import Button from 'primevue/button';
    import Calendar from 'primevue/calendar';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import SelectButton from 'primevue/selectbutton';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import Divider from 'primevue/divider';
    import InputText from 'primevue/inputtext'; // InputText import
    import { joinURL } from 'ufo';
    import { useExchangeRates } from '@/composables/useExchangeRates';
    import PortfolioInput from './controls/PortfolioInput.vue';

    defineProps({ isLoading: Boolean });
    const emit = defineEmits(['run']);

    const route = useRoute();
    const allSymbols = ref([]);
    const { findRateForDate } = useExchangeRates();

    const portfolio = ref([
        { symbol: '', value: 100, color: '#ef4444' },
        { symbol: '', value: 0, color: '#f59e0b' },
        { symbol: '', value: 0, color: '#84cc16' },
        { symbol: '', value: 0, color: '#3b82f6' },
    ]);

    const startDate = ref(
        new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    );
    const endDate = ref(new Date());
    const investmentKRW = ref(10000000);
    const investmentUSD = ref(0);
    const commission = ref(0.1);
    const comparison = ref('SPY');
    const customComparison = ref('');
    const exchangeRate = ref(null);
    const periodOptions = ref(['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y']);
    const selectedPeriod = ref('1Y');
    const applyTax = ref(true);
    const taxOptions = ref([
        { label: '세후', value: true },
        { label: '세전', value: false },
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

            const querySymbol = route.query.symbol?.toUpperCase();

            if (querySymbol && allSymbols.value.includes(querySymbol)) {
                portfolio.value[0].symbol = querySymbol;
            } else {
                const shuffled = shuffleArray([...allSymbols.value]);
                portfolio.value[0].symbol = shuffled.find((s) => s) || '';
            }
            await fetchExchangeRateForDate(startDate.value);
        } catch (e) {
            console.error('Error on mount:', e);
        }
    });

    const fetchExchangeRateForDate = async (date) => {
        const rate = await findRateForDate(date);
        if (rate) {
            exchangeRate.value = rate;
        } else {
            exchangeRate.value = 1380;
        }
        updateUSD();
    };

    const updateDates = (period) => {
        selectedPeriod.value = period;
        const newEndDate = new Date();
        let newStartDate = new Date();
        const value = parseInt(period);
        const unit = period.slice(-1);
        if (unit === 'M') {
            newStartDate.setMonth(newEndDate.getMonth() - value);
        } else if (unit === 'Y') {
            newStartDate.setFullYear(newEndDate.getFullYear() - value);
        }
        startDate.value = newStartDate;
        endDate.value = newEndDate;
    };

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
                (s) => !existingSymbols.includes(s)
            );
            portfolio.value[index].symbol = newSymbol || '종목 추가';
        }
    };

    const removeItem = (index) => {
        portfolio.value[index].symbol = '';
        portfolio.value[index].value = 0;
    };

    const adjustFirstWeight = () => {
        if (portfolio.value.length > 0 && portfolio.value[0].symbol) {
            const otherSum = portfolio.value
                .slice(1)
                .reduce((sum, item) => sum + (item.value || 0), 0);
            portfolio.value[0].value = Math.max(0, 100 - otherSum);
        }
    };

    watch(
        () => portfolio.value.map((p) => p.value).slice(1),
        adjustFirstWeight,
        { deep: true }
    );
    watch(
        () => portfolio.value.map((p) => p.symbol),
        (newSymbols, oldSymbols) => {
            const newActiveCount = newSymbols.filter((s) => s).length;
            const oldActiveCount = oldSymbols.filter((s) => s).length;
            if (newActiveCount !== oldActiveCount) {
                balanceWeights();
            }
        },
        { deep: true }
    );

    watch(startDate, (newDate) => fetchExchangeRateForDate(newDate));

    const updateKRW = () => {
        if (document.activeElement?.id === 'investmentUSD')
            investmentKRW.value = investmentUSD.value * exchangeRate.value;
    };
    const updateUSD = () => {
        if (document.activeElement?.id !== 'investmentUSD')
            investmentUSD.value = investmentKRW.value / exchangeRate.value;
    };

    const handleRunClick = () => {
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
            portfolio: validPortfolio.map((p) => ({
                ...p,
                symbol: p.symbol.toUpperCase(),
            })),
            startDate: startDate.value,
            endDate: endDate.value,
            initialInvestmentKRW: investmentKRW.value,
            commission: commission.value,
            applyTax: applyTax.value,
            comparisonSymbol:
                comparison.value === 'Other'
                    ? customComparison.value.toUpperCase()
                    : comparison.value,
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

        <div class="grid formgrid p-fluid align-items-end gap-y-4 mt-4">
            <div class="field col-12">
                <label>빠른 기간 선택</label>
                <SelectButton
                    v-model="selectedPeriod"
                    :options="periodOptions"
                    @update:modelValue="updateDates"
                    aria-labelledby="period-selection" />
            </div>
            <div class="field col-6 md:col-3">
                <label for="startDate">시작일</label>
                <Calendar
                    v-model="startDate"
                    id="startDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-6 md:col-3">
                <label for="endDate">종료일</label>
                <Calendar
                    v-model="endDate"
                    id="endDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-12 md:col-6">
                <label for="investmentKRW">투자원금 (시작일 환율 기준)</label>
                <InputGroup>
                    <InputGroupAddon>KRW</InputGroupAddon>
                    <InputNumber
                        v-model="investmentKRW"
                        inputId="investmentKRW"
                        mode="decimal"
                        @input="updateUSD" />
                    <InputGroupAddon>USD</InputGroupAddon>
                    <InputNumber
                        v-model="investmentUSD"
                        inputId="investmentUSD"
                        mode="currency"
                        currency="USD"
                        locale="en-US"
                        @input="updateKRW" />
                </InputGroup>
            </div>
            <div class="field col-12 md:col-6">
                <label class="mb-2">비교 대상</label>
                <div class="flex flex-wrap gap-3">
                    <div class="flex align-items-center">
                        <RadioButton
                            v-model="comparison"
                            inputId="compNone"
                            name="comparison"
                            value="None" /><label for="compNone" class="ml-2"
                            >없음</label
                        >
                    </div>
                    <div class="flex align-items-center">
                        <RadioButton
                            v-model="comparison"
                            inputId="compSPY"
                            name="comparison"
                            value="SPY" /><label for="compSPY" class="ml-2"
                            >S&P 500 (SPY)</label
                        >
                    </div>
                    <div class="flex align-items-center">
                        <RadioButton
                            v-model="comparison"
                            inputId="compQQQ"
                            name="comparison"
                            value="QQQ" /><label for="compQQQ" class="ml-2"
                            >Nasdaq 100 (QQQ)</label
                        >
                    </div>
                    <div class="flex align-items-center">
                        <RadioButton
                            v-model="comparison"
                            inputId="compDIA"
                            name="comparison"
                            value="DIA" /><label for="compDIA" class="ml-2"
                            >Dow 30 (DIA)</label
                        >
                    </div>
                    <!-- [핵심] 누락되었던 UI 복원 -->
                    <div class="flex align-items-center">
                        <RadioButton
                            v-model="comparison"
                            inputId="compOther"
                            name="comparison"
                            value="Other" />
                        <InputText
                            v-model="customComparison"
                            class="ml-2 p-inputtext-sm"
                            style="width: 80px"
                            :disabled="comparison !== 'Other'"
                            placeholder="직접 입력" />
                    </div>
                </div>
            </div>
            <div class="field col-6 md:col-3">
                <label for="commission">거래 수수료 (%)</label>
                <InputNumber
                    v-model="commission"
                    inputId="commission"
                    :minFractionDigits="2"
                    suffix=" %" />
            </div>
            <div class="field col-6 md:col-3">
                <label>세금</label>
                <SelectButton
                    v-model="applyTax"
                    :options="taxOptions"
                    optionLabel="label"
                    optionValue="value" />
            </div>
            <div class="field col-12 md:col-3 flex align-items-end">
                <Button
                    label="백테스팅 실행"
                    icon="pi pi-chart-line"
                    @click="handleRunClick"
                    :loading="isLoading"
                    class="w-full" />
            </div>
        </div>
    </div>
</template>
