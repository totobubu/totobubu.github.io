<!-- src\components\backtester\controls\DateAndInvestment.vue -->
<script setup>
    import { ref, watch, onMounted, computed } from 'vue';
    import Calendar from 'primevue/calendar';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import SelectButton from 'primevue/selectbutton';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import { useExchangeRates } from '@/composables/useExchangeRates';

    const props = defineProps({
        isLoading: Boolean,
        portfolio: Array,
    });

    const emit = defineEmits(['run-backtest']);

    const { findRateForDate } = useExchangeRates();
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
    const startDateRate = ref(0);
    const endDateRate = ref(0);

    const underlyingSymbol = computed(() => {
        const firstItem = props.portfolio?.find((p) => p.symbol);
        return firstItem?.underlying || null;
    });

    watch(startDate, (newDate) =>
        fetchExchangeRateForDate(ref(newDate), startDateRate)
    );
    watch(endDate, (newDate) => {
        if (newDate < startDate.value) {
            startDate.value = newDate;
        }
        fetchExchangeRateForDate(ref(newDate), endDateRate);
    });

    onMounted(() => {
        fetchExchangeRateForDate(startDate, startDateRate);
        fetchExchangeRateForDate(endDate, endDateRate);
    });

    const fetchExchangeRateForDate = async (dateRef, rateRef) => {
        const rate = await findRateForDate(dateRef.value);
        if (rate) {
            rateRef.value = rate;
        } else {
            rateRef.value = 1380;
        }
        if (dateRef === startDate) updateUSD();
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

    const handleRunClick = () => {
        emit('run-backtest', {
            startDate: startDate.value,
            endDate: endDate.value,
            initialInvestmentKRW: investmentKRW.value,
            commission: commission.value,
            applyTax: applyTax.value,
            comparisonSymbol:
                comparison.value === 'Other'
                    ? customComparison.value.toUpperCase()
                    : comparison.value === 'Underlying'
                      ? underlyingSymbol.value
                      : comparison.value,
        });
    };

    const updateKRW = () => {
        if (document.activeElement?.id === 'investmentUSD')
            investmentKRW.value = investmentUSD.value * exchangeRate.value;
    };
    const updateUSD = () => {
        if (document.activeElement?.id !== 'investmentUSD')
            investmentUSD.value = investmentKRW.value / exchangeRate.value;
    };
</script>

<template>
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
            <label for="startDate"
                >시작일
                <span v-if="startDateRate" class="text-xs text-surface-500"
                    >($1 ≈ ₩{{ startDateRate.toFixed(2) }})</span
                ></label
            >
            <Calendar
                v-model="startDate"
                id="startDate"
                dateFormat="yy-mm-dd" />
        </div>
        <div class="field col-6 md:col-3">
            <label for="endDate"
                >종료일
                <span v-if="endDateRate" class="text-xs text-surface-500"
                    >($1 ≈ ₩{{ endDateRate.toFixed(2) }})</span
                ></label
            >
            <Calendar v-model="endDate" id="endDate" dateFormat="yy-mm-dd" />
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
                <div v-if="underlyingSymbol" class="flex align-items-center">
                    <RadioButton
                        v-model="comparison"
                        inputId="compUnderlying"
                        name="comparison"
                        value="Underlying" />
                    <label for="compUnderlying" class="ml-2"
                        >기초자산 ({{ underlyingSymbol }})</label
                    >
                </div>
                <div class="flex align-items-center">
                    <RadioButton
                        v-model="comparison"
                        inputId="compOther"
                        name="comparison"
                        value="Other" />
                    <InputText
                        v-model="customComparison"
                        class="ml-2 p-inputtext-sm"
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
</template>
