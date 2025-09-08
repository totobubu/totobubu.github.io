<script setup>
    import { computed } from 'vue';
    import DatePicker from 'primevue/datepicker';
    import InputNumber from 'primevue/inputnumber';

    const options = defineModel('options', { type: Object, required: true });

    const investmentUSD = computed({
        get: () =>
            options.value.exchangeRate && options.value.exchangeRate !== 0
                ? options.value.initialInvestment / options.value.exchangeRate
                : 0,
        set: (newValue) => {
            if (options.value) {
                options.value.initialInvestment =
                    newValue * options.value.exchangeRate;
            }
        },
    });
</script>

<template>
    <div class="surface-card p-4 border-round">
        <div v-if="options" class="grid formgrid p-fluid align-items-end">
            <div class="field col-6 md:col-2">
                <label for="startDate">시작일</label>
                <DatePicker
                    v-model="options.startDate"
                    inputId="startDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-6 md:col-2">
                <label for="endDate">종료일</label>
                <DatePicker
                    v-model="options.endDate"
                    inputId="endDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-6 md:col-2">
                <label for="investment">투자원금 (KRW)</label>
                <InputNumber
                    v-model="options.initialInvestment"
                    inputId="investment"
                    mode="decimal" />
            </div>
            <div class="field col-6 md:col-2">
                <label for="investmentUSD">투자원금 (USD)</label>
                <InputNumber
                    v-model="investmentUSD"
                    inputId="investmentUSD"
                    mode="currency"
                    currency="USD" />
            </div>
            <div class="field col-6 md:col-2">
                <label for="exchangeRate">적용 환율</label>
                <InputNumber
                    v-model="options.exchangeRate"
                    inputId="exchangeRate"
                    mode="decimal" />
            </div>
            <div class="field col-6 md:col-2">
                <label for="commission">수수료 (%)</label>
                <InputNumber
                    v-model="options.commission"
                    inputId="commission"
                    suffix=" %"
                    :minFractionDigits="2" />
            </div>
        </div>
    </div>
</template>
