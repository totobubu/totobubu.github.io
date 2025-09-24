<!-- src\components\backtester\BacktesterControls.vue -->
<script setup>
    import { ref } from 'vue';
    import Calendar from 'primevue/calendar';
    import InputText from 'primevue/inputtext';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import Button from 'primevue/button';

    defineProps({ isLoading: Boolean });
    const emit = defineEmits(['run']);

    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setFullYear(defaultStartDate.getFullYear() - 5);

    const symbols = ref('TSLY,NVDY,CONY,MSTY');
    const startDate = ref(defaultStartDate);
    const endDate = ref(defaultEndDate);
    const initialInvestment = ref(10000000);
    const commission = ref(0.1);
    const comparison = ref('SPY');
    const customComparison = ref('');

    const handleRunClick = () => {
        emit('run', {
            symbols: symbols.value
                .split(',')
                .map((s) => s.trim().toUpperCase()),
            startDate: startDate.value.toISOString().split('T')[0],
            endDate: endDate.value.toISOString().split('T')[0],
            initialInvestmentKRW: initialInvestment.value,
            commission: commission.value,
            comparisonSymbol:
                comparison.value === 'Other'
                    ? customComparison.value.toUpperCase()
                    : comparison.value,
        });
    };
</script>

<template>
    <div class="p-4 border-round surface-card">
        <div class="grid formgrid p-fluid align-items-end">
            <div class="field col-12 md:col-6">
                <label for="symbols">종목 (쉼표로 구분)</label>
                <InputText v-model="symbols" id="symbols" />
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
                <label>비교 대상</label>
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
                <label for="investment">투자원금 (KRW)</label>
                <InputNumber
                    v-model="initialInvestment"
                    inputId="investment"
                    mode="decimal" />
            </div>
            <div class="field col-6 md:col-3">
                <label for="commission">거래 수수료 (%)</label>
                <InputNumber
                    v-model="commission"
                    inputId="commission"
                    :minFractionDigits="2"
                    suffix=" %" />
            </div>
        </div>
        <div class="mt-4 flex justify-content-end">
            <Button
                label="백테스팅 실행"
                icon="pi pi-chart-line"
                @click="handleRunClick"
                :loading="isLoading" />
        </div>
    </div>
</template>
