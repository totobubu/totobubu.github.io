<!-- src\components\backtester\BacktesterControls.vue -->
<script setup>
    import { ref, watch } from 'vue';
    import Calendar from 'primevue/calendar';
    import InputText from 'primevue/inputtext';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import Button from 'primevue/button';
    import SelectButton from 'primevue/selectbutton';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';

    const emit = defineEmits(['run']);
    defineProps({ isLoading: Boolean });

    const symbols = ref(['TSLY', 'NVDY', 'CONY', 'MSTY']);
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

    const updateDates = (period) => {
        const newEndDate = new Date();
        const newStartDate = new Date();
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

    const handleRunClick = () => {
        const validSymbols = symbols.value
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
        if (validSymbols.length === 0) return;
        emit('run', {
            symbols: validSymbols,
            startDate: startDate.value.toISOString().split('T')[0],
            endDate: endDate.value.toISOString().split('T')[0],
            initialInvestmentKRW: investmentKRW.value,
            commission: commission.value,
            comparisonSymbol:
                comparison.value === 'Other'
                    ? customComparison.value.toUpperCase()
                    : comparison.value,
        });
    };

    watch(investmentKRW, (newVal) => {
        investmentUSD.value = newVal / exchangeRate.value;
    });
    watch(investmentUSD, (newVal) => {
        investmentKRW.value = newVal * exchangeRate.value;
    });
</script>

<template>
    <div class="p-4 border-round surface-card">
        <div class="grid formgrid p-fluid align-items-end gap-y-4">
            <div v-for="i in 4" :key="i" class="field col-6 md:col-3">
                <label :for="`symbol${i}`">종목 {{ i }}</label>
                <InputText v-model="symbols[i - 1]" :id="`symbol${i}`" />
            </div>

            <div class="field col-12">
                <label>기간 선택</label>
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
                <label for="investment">투자원금 (시작일 환율 기준)</label>
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
                            class="ml-2"
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
