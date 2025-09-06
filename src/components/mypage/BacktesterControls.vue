<script setup>
    import { ref, watch } from 'vue';
    import Calendar from 'primevue/calendar';
    import InputNumber from 'primevue/inputnumber';
    import ToggleButton from 'primevue/togglebutton';
    import Button from 'primevue/button';
    import MultiSelect from 'primevue/multiselect';
    import { useToast } from 'primevue/usetoast';

    const toast = useToast();

    const emit = defineEmits([
        'run',
        'update:selectedSymbols',
        'update:startDate',
    ]);

    const props = defineProps({
        availableStocks: { type: Array, default: () => [] },
        selectedSymbols: { type: Array, default: () => [] },
        startDate: { type: Date, default: null },
    });

    // v-model 바인딩을 위한 로컬 ref 변수들
    const localSelectedSymbols = ref([...props.selectedSymbols]);
    const localStartDate = ref(props.startDate);

    // 종료일, 투자금 등은 내부 상태로 관리
    const endDate = ref(new Date(new Date().setDate(new Date().getDate() - 1)));
    const initialInvestment = ref(10000000);
    const commission = ref(0.1);
    const reinvestDividends = ref(true);
    const exchangeRate = ref(1350);

    // Props -> 로컬 ref 동기화
    watch(
        () => props.selectedSymbols,
        (newVal) => {
            localSelectedSymbols.value = newVal;
        }
    );
    watch(
        () => props.startDate,
        (newVal) => {
            localStartDate.value = newVal;
        }
    );

    // 로컬 ref 변경 -> 상위 컴포넌트로 emit
    watch(localSelectedSymbols, (newValue) => {
        if (newValue.length > 5) {
            localSelectedSymbols.value = newValue.slice(0, 5);
            toast.add({
                severity: 'warn',
                summary: '선택 제한',
                detail: '최대 5개의 종목만 선택할 수 있습니다.',
                life: 3000,
            });
        }
        emit('update:selectedSymbols', localSelectedSymbols.value);
    });
    watch(localStartDate, (newVal) => {
        emit('update:startDate', newVal);
    });

    const handleRunClick = () => {
        emit('run', {
            // [수정] 상위에서 받은 startDate 대신, v-model로 양방향 바인딩된 localStartDate 사용
            startDate: getFormattedDate(localStartDate.value),
            endDate: getFormattedDate(endDate.value),
            initialInvestment: initialInvestment.value,
            commission: commission.value,
            reinvestDividends: reinvestDividends.value,
            exchangeRate: exchangeRate.value,
        });
    };

    function getFormattedDate(date) {
        if (!date) return null;
        return date.toISOString().split('T')[0];
    }
</script>

<template>
    <div class="p-4 border-round surface-card">
        <div class="grid formgrid p-fluid align-items-end">
            <div class="field col-12 md:col-6">
                <label for="symbolSelect">종목 선택 (최대 5개)</label>
                <MultiSelect
                    v-model="localSelectedSymbols"
                    :options="availableStocks"
                    optionLabel="longName"
                    optionValue="symbol"
                    placeholder="종목을 검색하고 선택하세요"
                    filter
                    showClear
                    class="w-full" />
            </div>
            <div class="field col-6 md:col-3">
                <label for="startDate">시작일</label>
                <Calendar
                    v-model="localStartDate"
                    inputId="startDate"
                    :maxDate="endDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-6 md:col-3">
                <label for="endDate">종료일</label>
                <Calendar
                    v-model="endDate"
                    inputId="endDate"
                    :minDate="localStartDate"
                    dateFormat="yy-mm-dd" />
            </div>
            <div class="field col-6 md:col-3">
                <label for="investment">투자원금 (KRW)</label>
                <InputNumber
                    v-model="initialInvestment"
                    inputId="investment"
                    mode="decimal"
                    :min="0" />
            </div>
            <div class="field col-6 md:col-3">
                <label for="exchangeRate">적용 환율</label>
                <InputNumber
                    v-model="exchangeRate"
                    inputId="exchangeRate"
                    mode="decimal"
                    :min="0" />
            </div>
            <div class="field col-4 md:col-2">
                <label for="commission">수수료 (%)</label>
                <InputNumber
                    v-model="commission"
                    inputId="commission"
                    :minFractionDigits="2"
                    suffix=" %"
                    :min="0" />
            </div>
            <div class="field col-4 md:col-2">
                <ToggleButton
                    v-model="reinvestDividends"
                    onLabel="재투자 O"
                    offLabel="재투자 X"
                    class="w-full" />
            </div>
            <div class="field col-4 md:col-2">
                <Button
                    label="백테스팅 실행"
                    icon="pi pi-play"
                    @click="handleRunClick"
                    class="w-full" />
            </div>
        </div>
    </div>
</template>
