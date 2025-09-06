<script setup>
    import { ref, watch, computed } from 'vue';
    import { useToast } from 'primevue/usetoast';

    import DatePicker from 'primevue/datepicker';
    import InputNumber from 'primevue/inputnumber';
    import Button from 'primevue/button';
    import SelectButton from 'primevue/selectbutton';
    import Stepper from 'primevue/stepper';
    import StepItem from 'primevue/stepitem';
    import StepPanel from 'primevue/steppanel';
    import Step from 'primevue/step';
    import PickList from 'primevue/picklist';

    const toast = useToast();

    const emit = defineEmits([
        'run',
        'update:selectedSymbols',
        'update:dateRange',
    ]);

    const props = defineProps({
        availableStocks: { type: Array, default: () => [] },
        selectedSymbols: { type: Array, default: () => [] },
        dateRange: { type: Array, default: () => [] },
    });

    // --- PickList를 위한 데이터 구조 ---
    // PickList는 [source, target] 형태의 데이터가 필요합니다.
    const picklistData = ref([
        [], // source: 선택 가능한 전체 종목
        [], // target: 사용자가 선택한 종목
    ]);

    const localDateRange = ref(props.dateRange);

    // --- v-model 동기화 및 데이터 처리 로직 ---

    // availableStocks prop이 변경되면 PickList의 source를 업데이트합니다.
    watch(
        () => props.availableStocks,
        (newStocks) => {
            // 이미 선택된 종목들은 source 목록에서 제외합니다.
            const selectedSymbolSet = new Set(props.selectedSymbols);
            picklistData.value[0] = newStocks.filter(
                (stock) => !selectedSymbolSet.has(stock.symbol)
            );
        },
        { immediate: true }
    );

    // selectedSymbols prop이 변경되면 PickList의 target을 업데이트합니다.
    watch(
        () => props.selectedSymbols,
        (newSymbols) => {
            const selectedStockDetails = props.availableStocks.filter((stock) =>
                newSymbols.includes(stock.symbol)
            );
            picklistData.value[1] = selectedStockDetails;
        },
        { immediate: true }
    );

    // PickList의 target(선택된 종목)이 변경될 때 상위로 emit합니다.
    watch(
        () => picklistData.value[1],
        (newTargetList) => {
            const newSymbols = newTargetList.map((item) => item.symbol);
            if (newSymbols.length > 5) {
                // 5개 초과 시 마지막에 추가된 항목을 다시 source로 되돌림
                const overflowItem = newTargetList.pop();
                picklistData.value[0].unshift(overflowItem);

                toast.add({
                    severity: 'warn',
                    summary: '선택 제한',
                    detail: '최대 5개의 종목만 선택할 수 있습니다.',
                    life: 3000,
                });
            } else {
                emit('update:selectedSymbols', newSymbols);
            }
        },
        { deep: true }
    );

    // DatePicker 동기화
    watch(
        () => props.dateRange,
        (newVal) => {
            localDateRange.value = newVal;
        }
    );
    watch(localDateRange, (newVal) => {
        emit('update:dateRange', newVal);
    });

    // --- 나머지 상태 변수 ---
    const testerValue = ref('과거비교');
    const testerOptions = ref(['과거비교', '미래예측']);

    const initialInvestment = ref(10000000);
    const commission = ref(0.1);
    const exchangeRate = ref(1350);

    const reinvestValue = ref('셀프재투자');
    const reinvestOptions = ref(['셀프재투자', '다른주식재투자', '현금비축']);
    const today = new Date();

    // --- 이벤트 핸들러 ---
    const handleRunClick = () => {
        const [startDate, endDate] = localDateRange.value;
        emit('run', {
            startDate: getFormattedDate(startDate),
            endDate: getFormattedDate(endDate),
            initialInvestment: initialInvestment.value,
            commission: commission.value,
            // [수정] reinvestDividends 대신 reinvestValue 전달
            reinvestmentStrategy: reinvestValue.value,
            exchangeRate: exchangeRate.value,
        });
    };

    function getFormattedDate(date) {
        if (!date) return null;
        return date.toISOString().split('T')[0];
    }
</script>

<template>
    <div class="card">
        <Stepper value="1">
            <StepItem value="1">
                <Step>테스터 선택</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <div class="flex flex-column h-12rem">
                        <div
                            class="border-2 border-dashed surface-border border-round flex-auto flex justify-content-center align-items-center font-medium">
                            <SelectButton
                                v-model="testerValue"
                                :options="testerOptions" />
                        </div>
                    </div>
                    <div class="flex pt-4 justify-content-end">
                        <Button label="Next" @click="activateCallback('2')" />
                    </div>
                </StepPanel>
            </StepItem>
            <StepItem value="2">
                <Step>투자기간 {{ localDateRange }}</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <div class="flex flex-column">
                        <DatePicker
                            v-model="localDateRange"
                            selectionMode="range"
                            :inline="true"
                            :numberOfMonths="1"
                            :maxDate="today"
                            dateFormat="yy-mm-dd"
                            class="w-full justify-content-center" />
                    </div>
                    <div class="flex pt-4 justify-content-between">
                        <Button
                            label="Back"
                            severity="secondary"
                            @click="activateCallback('1')" />
                        <Button label="Next" @click="activateCallback('3')" />
                    </div>
                </StepPanel>
            </StepItem>
            <StepItem value="3">
                <Step>투자금액</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <div class="flex flex-column gap-3">
                        <InputGroup>
                            <InputGroupAddon>
                                <i class="pi pi-dollar" />
                            </InputGroupAddon>
                            <FloatLabel variant="in">
                                <InputNumber
                                    placeholder="KRW"
                                    v-model="inputAmountKRW"
                                    mode="currency"
                                    currency="KRW"
                                    locale="ko-KR" />

                                <InputNumber
                                    placeholder="USD"
                                    v-model="inputAmountUSD"
                                    mode="currency"
                                    currency="USD"
                                    locale="en-US" />

                                <label for="in_label">투자 금액</label>
                            </FloatLabel>
                        </InputGroup>
                        <!-- <div class="field">
                            <label for="investment">투자원금 (KRW)</label>
                            <InputNumber
                                v-model="initialInvestment"
                                inputId="investment"
                                mode="decimal"
                                :min="0" />
                        </div> -->
                        <InputGroup>
                            <InputGroupAddon>
                                <i class="pi pi-dollar" />
                            </InputGroupAddon>
                            <FloatLabel variant="in">
                                <InputNumber
                                    v-model="exchangeRate"
                                    inputId="exchangeRate"
                                    mode="decimal"
                                    :min="0" />
                                <label for="exchangeRate">적용 환율</label>
                            </FloatLabel>
                        </InputGroup>
                        <InputGroup>
                            <InputGroupAddon>
                                <i class="pi pi-dollar"
                            /></InputGroupAddon>
                            <FloatLabel variant="in"
                                ><InputNumber
                                    v-model="commission"
                                    inputId="commission"
                                    :minFractionDigits="2"
                                    suffix=" %"
                                    :min="0" />
                                <label for="in_label">수수료 (%)</label>
                            </FloatLabel>
                        </InputGroup>
                    </div>
                    <div class="flex pt-4 justify-content-between">
                        <Button
                            label="Back"
                            severity="secondary"
                            @click="activateCallback('2')" />
                        <Button label="Next" @click="activateCallback('4')" />
                    </div>
                </StepPanel>
            </StepItem>
            <StepItem value="4">
                <Step>종목 선택 (최대 5개)</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <div class="flex flex-column">
                        <PickList
                            v-model="picklistData"
                            listStyle="height:342px"
                            dataKey="symbol"
                            breakpoint="1400px">
                            <template #sourceheader>선택 가능 종목</template>
                            <template #targetheader>선택된 종목</template>
                            <template #item="slotProps">
                                <div
                                    class="flex flex-wrap p-2 align-items-center gap-3">
                                    <div class="flex-1 flex flex-column gap-2">
                                        <span class="font-bold">{{
                                            slotProps.item.symbol
                                        }}</span>
                                        <div
                                            class="flex align-items-center gap-2">
                                            <span>{{
                                                slotProps.item.longName.replace(
                                                    slotProps.item.symbol +
                                                        ' - ',
                                                    ''
                                                )
                                            }}</span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </PickList>
                    </div>
                    <div class="flex pt-4 justify-content-between">
                        <Button
                            label="Back"
                            severity="secondary"
                            @click="activateCallback('3')" />
                        <Button label="Next" @click="activateCallback('5')" />
                    </div>
                </StepPanel>
            </StepItem>
            <StepItem value="5">
                <Step>재투자</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <div class="flex flex-column h-12rem">
                        <div
                            class="border-2 border-dashed surface-border border-round flex-auto flex justify-content-center align-items-center font-medium">
                            <SelectButton
                                v-model="reinvestValue"
                                :options="reinvestOptions" />
                        </div>
                    </div>
                    <div class="flex pt-4 justify-content-between">
                        <Button
                            label="Back"
                            severity="secondary"
                            @click="activateCallback('4')" />
                        <Button
                            label="백테스팅 실행"
                            icon="pi pi-play"
                            @click="handleRunClick" />
                    </div>
                </StepPanel>
            </StepItem>
        </Stepper>
    </div>
</template>
