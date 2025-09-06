<script setup>
    import { ref, watch, computed } from 'vue';
    import DatePicker from 'primevue/datepicker'; // Calendar 대신 DatePicker import
    import InputNumber from 'primevue/inputnumber';
    import ToggleButton from 'primevue/togglebutton';
    import Button from 'primevue/button';
    import MultiSelect from 'primevue/multiselect';
    import { useToast } from 'primevue/usetoast';

    const toast = useToast();

    const emit = defineEmits([
        'run',
        'update:selectedSymbols',
        'update:dateRange', // 시작일/종료일을 하나의 이벤트로 통합
    ]);

    const props = defineProps({
        availableStocks: { type: Array, default: () => [] },
        selectedSymbols: { type: Array, default: () => [] },
        // [수정] Date 객체 2개를 담는 배열로 prop 변경
        dateRange: { type: Array, default: () => [] },
    });

    const localSelectedSymbols = ref([...props.selectedSymbols]);

    // [핵심 수정] dateRange를 위한 로컬 ref
    const localDateRange = ref(props.dateRange);

    // v-model 동기화 로직
    watch(
        () => props.selectedSymbols,
        (newVal) => {
            localSelectedSymbols.value = newVal;
        }
    );
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
    watch(
        () => props.dateRange,
        (newVal) => {
            localDateRange.value = newVal;
        }
    );
    watch(localDateRange, (newVal) => {
        emit('update:dateRange', newVal);
    });

    const initialInvestment = ref(10000000);
    const commission = ref(0.1);
    const reinvestDividends = ref(true);
    const exchangeRate = ref(1350);

    const today = new Date();

    const handleRunClick = () => {
        // [수정] dateRange 배열에서 시작일과 종료일을 추출
        const [startDate, endDate] = localDateRange.value;

        emit('run', {
            startDate: getFormattedDate(startDate),
            endDate: getFormattedDate(endDate),
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
        <div class="grid formgrid p-fluid">
            <!-- 좌측: 설정 영역 -->
            <div class="col-12 md:col-7">
                <div class="grid align-items-end">
                    <div class="field col-12">
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

            <!-- 우측: DatePicker 영역 -->
            <div class="col-12 md:col-5">
                <label>기간 선택</label>
                <!-- [핵심 수정] 인라인, 범위 선택, 2달 표시 DatePicker -->
                <DatePicker
                    v-model="localDateRange"
                    selectionMode="range"
                    :inline="true"
                    :numberOfMonths="2"
                    :maxDate="today"
                    dateFormat="yy-mm-dd"
                    class="w-full justify-content-center" />
            </div>
        </div>
    </div>
</template>
