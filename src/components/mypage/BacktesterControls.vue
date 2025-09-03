<script setup>
    import { ref, computed } from 'vue';
    import Calendar from 'primevue/calendar';
    import InputNumber from 'primevue/inputnumber';
    import ToggleButton from 'primevue/togglebutton';
    import Button from 'primevue/button';

    const props = defineProps({ selectedCount: Number });
    const emit = defineEmits(['run']);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = ref(yesterday);
    const initialInvestment = ref(10000000);
    const commission = ref(0.1);
    const reinvestDividends = ref(true);

    const today = ref(new Date());

    const maxDate = computed(() => {
        const y = new Date(today.value);
        y.setDate(y.getDate() - 1);
        return y;
    });

    const handleRunClick = () => {
        emit('run', {
            startDate: startDate.value.toISOString().split('T')[0],
            initialInvestment: initialInvestment.value,
            commission: commission.value,
            reinvestDividends: reinvestDividends.value,
        });
    };
</script>

<template>
    <div class="p-4 border-round surface-card">
        <div class="grid formgrid p-fluid">
            <div class="field col-12 md:col-3">
                <label for="startDate">시작일</label>
                <Calendar
                    v-model="startDate"
                    inputId="startDate"
                    :maxDate="maxDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-12 md:col-3">
                <label for="investment">투자원금 (KRW)</label>
                <InputNumber
                    v-model="initialInvestment"
                    inputId="investment"
                    mode="decimal"
                    :min="0" />
            </div>
            <div class="field col-12 md:col-2">
                <label for="commission">거래 수수료 (%)</label>
                <InputNumber
                    v-model="commission"
                    inputId="commission"
                    :minFractionDigits="2"
                    suffix=" %"
                    :min="0" />
            </div>
            <div class="field col-12 md:col-2 flex align-items-end">
                <ToggleButton
                    v-model="reinvestDividends"
                    onLabel="배당 재투자 O"
                    offLabel="배당 재투자 X"
                    class="w-full" />
            </div>
            <div class="field col-12 md:col-2 flex align-items-end">
                <Button
                    label="백테스팅 실행"
                    icon="pi pi-play"
                    @click="handleRunClick"
                    :disabled="selectedCount < 1 || selectedCount > 4"
                    class="w-full" />
            </div>
        </div>
        <div
            v-if="selectedCount < 1 || selectedCount > 4"
            class="text-sm text-surface-500 mt-2">
            북마크 목록에서 1개 이상, 4개 이하의 종목을 선택해주세요.
        </div>
    </div>
</template>
