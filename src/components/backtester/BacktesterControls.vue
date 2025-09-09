<!-- src\components\backtester\BacktesterControls.vue -->
<script setup>
    import { computed, ref, watch } from 'vue';
    import DatePicker from 'primevue/datepicker';
    import InputNumber from 'primevue/inputnumber';
    import RadioButton from 'primevue/radiobutton';
    import Card from 'primevue/card';

    const props = defineProps({
        totalInvestmentUSD: { type: Number, default: 0 },
    });

    // v-model을 defineModel로 처리
    const startDate = defineModel('startDate');
    const endDate = defineModel('endDate');
    const exchangeRate = defineModel('exchangeRate');
    const commission = defineModel('commission');
    const mode = defineModel('mode'); // [추가] 분석 모드를 위한 v-model

    // 내부 상태 변수
    const today = new Date();

    const totalInvestmentKRW = computed(() => {
        const rate = exchangeRate.value || 0;
        return props.totalInvestmentUSD * rate;
    });
</script>

<template>
    <div class="grid p-fluid">
        <div class="col-6">
            <InputGroup>
                <InputGroupAddon>
                    <RadioButton
                        v-model="mode"
                        inputId="modeBacktest"
                        name="testMode"
                        value="backtest" />
                </InputGroupAddon>

                <InputGroupAddon>
                    <label for="modeBacktest">백데이터</label>
                </InputGroupAddon>
                <DatePicker
                    v-model="startDate"
                    inputId="startDate"
                    dateFormat="yy-mm-dd"
                    :disabled="mode !== 'backtest'"
                    :maxDate="today" />
                <InputGroupAddon>~</InputGroupAddon>
                <DatePicker
                    v-model="endDate"
                    inputId="endDate"
                    :disabled="mode !== 'backtest'"
                    dateFormat="yy-mm-dd"
                    :maxDate="today" />
            </InputGroup>
        </div>
        <div class="col-6">
            <InputGroup>
                <InputGroupAddon>
                    <RadioButton
                        v-model="mode"
                        inputId="modeForecast"
                        name="testMode"
                        value="forecast" />
                </InputGroupAddon>

                <InputGroupAddon>
                    <label for="modeForecast">미래 예측</label>
                </InputGroupAddon>
                <InputGroupAddon>Today ~</InputGroupAddon>
                <DatePicker
                    v-model="endDate"
                    inputId="forecastDate"
                    :disabled="mode === 'backtest'"
                    dateFormat="yy-mm-dd"
                    :minDate="today" />
            </InputGroup>
        </div>
    </div>

    <div class="grid formgrid p-fluid">
        <!-- 3. 투자금 및 기타 설정 -->
        <div class="field col-6">
            <label for="investmentUSD">총 투자금 (USD)</label>
            <InputNumber
                :modelValue="totalInvestmentUSD"
                inputId="investmentUSD"
                mode="currency"
                currency="USD"
                disabled />
        </div>
        <div class="field col-6">
            <label for="investmentKRW">총 투자금 (KRW)</label>
            <InputNumber
                :modelValue="totalInvestmentKRW"
                inputId="investmentKRW"
                mode="currency"
                currency="KRW"
                locale="ko-KR"
                disabled />
        </div>
        <div class="field col-6">
            <label for="exchangeRate">적용 환율</label>
            <InputNumber
                v-model="exchangeRate"
                inputId="exchangeRate"
                disabled />
        </div>
        <div class="field col-6">
            <label for="commission">수수료 (%)</label>
            <InputNumber
                v-model="commission"
                inputId="commission"
                suffix=" %"
                :minFractionDigits="2" />
        </div>
    </div>
</template>
