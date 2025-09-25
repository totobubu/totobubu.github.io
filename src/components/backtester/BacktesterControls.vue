<!-- src\components\backtester\BacktesterControls.vue -->
<script setup>
    import { ref, computed, watch } from 'vue';
    import Card from 'primevue/card';
    import MeterGroup from 'primevue/metergroup';
    import InputText from 'primevue/inputtext';
    import Button from 'primevue/button';
    import Slider from 'primevue/slider';
    import Calendar from 'primevue/calendar';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import SelectButton from 'primevue/selectbutton';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import Divider from 'primevue/divider';

    defineProps({ isLoading: Boolean });
    const emit = defineEmits(['run']);

    const portfolio = ref([
        { label: '종목 1', symbol: 'TSLY', value: 25, color: '#34d399' },
        { label: '종목 2', symbol: 'NVDY', value: 25, color: '#fbbf24' },
        { label: '종목 3', symbol: 'CONY', value: 25, color: '#60a5fa' },
        { label: '종목 4', symbol: 'MSTY', value: 25, color: '#c084fc' },
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
    const exchangeRate = ref(1380);

    const periodOptions = ref(['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y']);

    const totalValue = computed(() =>
        portfolio.value.reduce((sum, item) => sum + item.value, 0)
    );

    const updateDates = (period) => {
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
        if (activeItems.length === 0) return;
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

    const handleRunClick = () => {
        const validPortfolio = portfolio.value.filter(
            (p) => p.symbol && p.value > 0
        );
        if (validPortfolio.length === 0) return;

        // 비중 합계가 100이 되도록 정규화
        const totalWeight = validPortfolio.reduce(
            (sum, item) => sum + item.value,
            0
        );
        const normalizedPortfolio = validPortfolio.map((item) => ({
            ...item,
            value: (item.value / totalWeight) * 100,
        }));

        emit('run', {
            portfolio: normalizedPortfolio,
            startDate: startDate.value,
            endDate: endDate.value,
            initialInvestmentKRW: investmentKRW.value,
            commission: commission.value,
            comparisonSymbol:
                comparison.value === 'Other'
                    ? customComparison.value.toUpperCase()
                    : comparison.value,
        });
    };

    watch(investmentKRW, (newVal) => {
        if (document.activeElement?.id !== 'investmentUSD') {
            investmentUSD.value = newVal / exchangeRate.value;
        }
    });
    watch(investmentUSD, (newVal) => {
        if (document.activeElement?.id !== 'investmentKRW') {
            investmentKRW.value = newVal * exchangeRate.value;
        }
    });
</script>

<template>
    <div class="p-4 border-round surface-card">
        <MeterGroup :value="portfolio" labelPosition="start" class="mb-4">
            <template #label>
                <div class="grid">
                    <div
                        v-for="(item, index) in portfolio"
                        :key="index"
                        class="col-12 md:col-6 lg:col-3">
                        <Card
                            class="border-1 surface-border shadow-none h-full">
                            <template #content>
                                <div
                                    class="flex justify-content-between h-full flex-column">
                                    <InputText
                                        v-model="item.symbol"
                                        :placeholder="item.label"
                                        class="p-inputtext-sm mb-3 w-full" />
                                    <div
                                        class="flex align-items-center justify-content-between">
                                        <Slider
                                            v-model="item.value"
                                            class="flex-1 mr-4" />
                                        <span
                                            class="font-bold text-lg w-4rem text-right"
                                            >{{ item.value }}%</span
                                        >
                                    </div>
                                </div>
                            </template>
                        </Card>
                    </div>
                </div>
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
                <span :class="{ 'text-red-500 font-bold': totalValue !== 100 }"
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
                    :options="periodOptions"
                    @change="updateDates($event.value)"
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
                        mode="decimal" />
                    <InputGroupAddon>USD</InputGroupAddon>
                    <InputNumber
                        v-model="investmentUSD"
                        inputId="investmentUSD"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </InputGroup>
            </div>
            <div class="field col-12 md:col-6">
                <label>비교 대상</label>
                <div class="flex flex-wrap gap-3 mt-2">
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
                            inputId="compOther"
                            name="comparison"
                            value="Other" /><InputText
                            v-model="customComparison"
                            class="ml-2 p-inputtext-sm"
                            style="width: 80px"
                            :disabled="comparison !== 'Other'" />
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
            <div class="field col-6 md:col-3 flex align-items-end">
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
