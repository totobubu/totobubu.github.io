<script setup>
    import { computed } from 'vue';
    import DatePicker from 'primevue/datepicker';
    import InputNumber from 'primevue/inputnumber';

    const startDate = defineModel('startDate');
    const endDate = defineModel('endDate');
    const exchangeRate = defineModel('exchangeRate');
    const commission = defineModel('commission');

    const props = defineProps({
        totalInvestmentUSD: { type: Number, default: 0 },
    });

    const totalInvestmentKRW = computed(() => {
        const rate = exchangeRate.value || 0;
        return props.totalInvestmentUSD * rate;
    });
</script>

<template>
    <div class="surface-card p-4 border-round">
        <h3 class="font-bold mt-0 mb-4">기본 설정</h3>
        <div class="grid formgrid p-fluid">
            <div class="field col-6">
                <label for="startDate">시작일</label
                ><DatePicker
                    v-model="startDate"
                    inputId="startDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-6">
                <label for="endDate">종료일</label
                ><DatePicker
                    v-model="endDate"
                    inputId="endDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-6">
                <label for="investmentUSD">총 투자금 (USD)</label
                ><InputNumber
                    :modelValue="totalInvestmentUSD"
                    inputId="investmentUSD"
                    mode="currency"
                    currency="USD"
                    disabled />
            </div>
            <div class="field col-6">
                <label for="investmentKRW">총 투자금 (KRW)</label
                ><InputNumber
                    :modelValue="totalInvestmentKRW"
                    inputId="investmentKRW"
                    mode="currency"
                    currency="KRW"
                    locale="ko-KR"
                    disabled />
            </div>
            <div class="field col-6">
                <label for="exchangeRate">적용 환율</label
                ><InputNumber v-model="exchangeRate" inputId="exchangeRate" />
            </div>
            <div class="field col-6">
                <label for="commission">수수료 (%)</label
                ><InputNumber
                    v-model="commission"
                    inputId="commission"
                    suffix=" %"
                    :minFractionDigits="2" />
            </div>
        </div>
    </div>
</template>
