<script setup>
    import { ref, watch, computed, reactive  } from 'vue';
    import { useToast } from 'primevue/usetoast';
    import { subMonths, subYears } from 'date-fns';

    import DatePicker from 'primevue/datepicker';
    import InputNumber from 'primevue/inputnumber';
    import Button from 'primevue/button';
    import SelectButton from 'primevue/selectbutton';
    import Stepper from 'primevue/stepper';
    import StepItem from 'primevue/stepitem';
    import StepPanel from 'primevue/steppanel';
    import Step from 'primevue/step';
    import Listbox from 'primevue/listbox';
    import Tag from 'primevue/tag';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import FloatLabel from 'primevue/floatlabel';
    import Dropdown from 'primevue/dropdown';

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

    // --- 상태 변수 ---
    const options = reactive({
        testerType: '과거 비교',
        reinvestment: {
            strategy: '셀프 재투자',
            targetSymbol: null, // 지정 재투자 시 사용
        },
        dateRange: props.dateRange,
        investmentKRW: 10000000,
        exchangeRate: 1350,
        commission: 0.1,
    });

    const periodValue = ref('1Y');
    const periodOptions = ref(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX']);
    const today = new Date();

    // --- Computed 속성 ---

    const datePickerSelectionMode = computed(() =>
        options.testerType === '과거 비교' ? 'range' : 'single'
    );

    const formattedDateRange = computed(() => {
        if (!options.dateRange || options.dateRange.length === 0) return '';
        const [start, end] = options.dateRange;
        const format = (date) => (date ? date.toLocaleDateString('ko-KR') : '');
        if (end) return `${format(start)} ~ ${format(end)}`;
        return format(start);
    });

    const investmentUSD = computed({
        get: () =>
            options.exchangeRate && options.exchangeRate !== 0
                ? options.investmentKRW / options.exchangeRate
                : 0,
        set: (newValue) => {
            options.investmentKRW = newValue * options.exchangeRate;
        },
    });

    const reinvestmentOptions = computed(() => {
        return options.testerType === '과거 비교'
            ? ['셀프 재투자', '지정 재투자', '현금 비축']
            : ['셀프 재투자', '지정 재투자'];
    });

    // 지정 재투자 시 선택 가능한 종목 목록 (선택된 종목 + 전체 종목)
    const targetReinvestmentStocks = computed(() => {
        return props.availableStocks;
    });

    const groupedAvailableStocks = computed(() => {
        const grouped = props.availableStocks.reduce((acc, stock) => {
            const groupLabel = stock.company || '개별 주식';
            if (!acc[groupLabel]) acc[groupLabel] = [];
            acc[groupLabel].push(stock);
            return acc;
        }, {});
        return Object.keys(grouped)
            .map((label) => ({ label, items: grouped[label] }))
            .sort((a, b) => a.label.localeCompare(b.label));
    });

    const selectedStockDetails = computed(() => {
        const stockMap = new Map(
            props.availableStocks.map((s) => [s.symbol, s])
        );
        return props.selectedSymbols
            .map((symbol) => stockMap.get(symbol))
            .filter(Boolean);
    });

    // --- Watchers ---

    watch(
        () => options.dateRange,
        (newRange) => {
            emit('update:dateRange', newRange);
        },
        { deep: true }
    );

    watch(periodValue, (newPeriod) => {
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1);
        let startDate = new Date(endDate);
        if (newPeriod.endsWith('M'))
            startDate = subMonths(endDate, parseInt(newPeriod));
        else if (newPeriod.endsWith('Y'))
            startDate = subYears(endDate, parseInt(newPeriod));
        else if (newPeriod === 'MAX') startDate = new Date('2010-01-01');
        options.dateRange = [startDate, endDate];
    });

    watch(
        () => props.selectedSymbols,
        (newValue) => {
            if (newValue.length > 5) {
                const limitedSymbols = newValue.slice(0, 5);
                emit('update:selectedSymbols', limitedSymbols);
                toast.add({
                    severity: 'warn',
                    summary: '선택 제한',
                    detail: '최대 5개의 종목만 선택할 수 있습니다.',
                    life: 3000,
                });
            }
        }
    );

    // --- 이벤트 핸들러 ---
    const handleRunClick = () => {
        const [startDate, endDate] = options.dateRange;
        emit('run', {
            testerType: options.testerType,
            reinvestmentStrategy: options.reinvestment.strategy,
            reinvestmentTarget: options.reinvestment.targetSymbol,
            startDate: getFormattedDate(startDate),
            endDate: getFormattedDate(endDate),
            initialInvestment: options.investmentKRW,
            commission: options.commission,
            exchangeRate: options.exchangeRate,
        });
    };

    const removeSymbol = (symbolToRemove) => {
        const newSymbols = props.selectedSymbols.filter(
            (symbol) => symbol !== symbolToRemove
        );
        emit('update:selectedSymbols', newSymbols);
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
                <Step>테스터 & 재투자 방식 선택</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <div class="grid">
                        <div class="col-12 md:col-6">
                            <h5 class="text-center">1. 분석 방식 선택</h5>
                            <div
                                class="border-2 border-dashed surface-border border-round flex-auto flex justify-content-center align-items-center p-4">
                                <SelectButton
                                    v-model="options.testerType"
                                    :options="['과거 비교', '원금 회수']" />
                            </div>
                        </div>
                        <div class="col-12 md:col-6">
                            <h5 class="text-center">
                                2. 배당금 처리 방식 선택
                            </h5>
                            <div
                                class="border-2 border-dashed surface-border border-round flex-auto flex justify-content-center align-items-center p-4">
                                <SelectButton
                                    v-model="options.reinvestment.strategy"
                                    :options="reinvestmentOptions" />
                            </div>
                        </div>
                        
                    </div>
                    <div class="flex pt-4 justify-content-end">
                        <Button label="Next" @click="activateCallback('2')" />
                    </div>
                </StepPanel>
            </StepItem>

            <StepItem value="2">
                <Step v-if="options.testerType === '과거 비교'"
                    >투자기간
                    <small class="text-surface-500 ml-2">{{
                        formattedDateRange
                    }}</small></Step
                >
                <Step v-else>투자 원금 정보</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <!-- 과거 비교 모드 -->
                    <div v-if="options.testerType === '과거 비교'">
                        <div class="flex flex-column gap-3">
                            <SelectButton
                                v-model="periodValue"
                                :options="periodOptions" />
                            <DatePicker
                                v-model="options.dateRange"
                                :selectionMode="datePickerSelectionMode"
                                :inline="true"
                                :numberOfMonths="1"
                                :maxDate="today"
                                dateFormat="yy-mm-dd"
                                class="w-full justify-content-center" />
                        </div>
                    </div>
                    <!-- 원금 회수 모드 -->
                    <div v-else class="flex flex-column gap-3">
                        <p class="text-surface-500 text-center">
                            원금 회수 기간 계산을 위해, 각 종목의 평단가와
                            수량을 북마크 관리 탭에서 입력해주세요.
                        </p>
                        <p class="text-surface-500 text-center">
                            (이 모드에서는 투자금액 입력이 필요 없습니다)
                        </p>
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
                <Step v-if="options.testerType === '과거 비교'">투자금액</Step>
                <Step v-else>종목 선택</Step>
                <StepPanel v-slot="{ activateCallback }">
                    <!-- 과거 비교 모드 -->
                    <div
                        v-if="options.testerType === '과거 비교'"
                        class="flex flex-column gap-3">
                        <InputGroup
                            ><InputGroupAddon>KRW</InputGroupAddon
                            ><InputNumber
                                placeholder="원화"
                                v-model="options.investmentKRW"
                                mode="currency"
                                currency="KRW"
                                locale="ko-KR"
                        /></InputGroup>
                        <InputGroup
                            ><InputGroupAddon>USD</InputGroupAddon
                            ><InputNumber
                                placeholder="달러"
                                v-model="investmentUSD"
                                mode="currency"
                                currency="USD"
                                locale="en-US"
                        /></InputGroup>
                        <InputGroup
                            ><InputGroupAddon
                                ><i class="pi pi-sync" /></InputGroupAddon
                            ><FloatLabel variant="in"
                                ><InputNumber
                                    v-model="options.exchangeRate"
                                    inputId="exchangeRate"
                                    mode="decimal"
                                    :min="0" /><label for="exchangeRate"
                                    >적용 환율</label
                                ></FloatLabel
                            ></InputGroup
                        >
                        <InputGroup
                            ><InputGroupAddon
                                ><i class="pi pi-percentage" /></InputGroupAddon
                            ><FloatLabel variant="in"
                                ><InputNumber
                                    v-model="options.commission"
                                    inputId="commission"
                                    :minFractionDigits="2"
                                    suffix=" %"
                                    :min="0" /><label for="commission"
                                    >수수료 (%)</label
                                ></FloatLabel
                            ></InputGroup
                        >
                    </div>

                    <!-- 원금 회수 모드 -->
                    <div v-else class="flex flex-column">
                        
                        <div class="p-2 border-bottom-1 surface-border">
                            <template v-if="selectedStockDetails.length > 0"
                                ><Tag
                                    v-for="stock in selectedStockDetails"
                                    :key="stock.symbol"
                                    class="mr-2 mb-2"
                                    icon="pi pi-times"
                                    @click="removeSymbol(stock.symbol)"
                                    >{{ stock.symbol }}</Tag
                                ></template
                            >
                            <span v-else class="text-surface-500 text-sm p-2"
                                >아래 목록에서 분석할 종목을 선택하세요.</span
                            >
                        </div>
                        <Listbox
                            :modelValue="selectedSymbols"
                            @update:modelValue="
                                (symbols) =>
                                    emit('update:selectedSymbols', symbols)
                            "
                            :options="groupedAvailableStocks"
                            optionLabel="longName"
                            optionValue="symbol"
                            optionGroupLabel="label"
                            optionGroupChildren="items"
                            multiple
                            filter
                            listStyle="height:342px"
                            class="w-full">
                            <template #optiongroup="slotProps"
                                ><div
                                    class="flex align-items-center p-2 font-bold bg-surface-100 dark:bg-surface-800">
                                    {{ slotProps.option.label }}
                                </div></template
                            >
                            <template #option="slotProps"
                                ><div class="flex align-items-center">
                                    <div>{{ slotProps.option.longName }}</div>
                                </div></template
                            >
                        </Listbox>

                        <div
                            v-if="
                                options.reinvestment.strategy === '지정 재투자'
                            "
                            class="col-12 mt-3">
                            <FloatLabel>
                                <Dropdown
                                    v-model="options.reinvestment.targetSymbol"
                                    :options="targetReinvestmentStocks"
                                    optionLabel="longName"
                                    optionValue="symbol"
                                    filter
                                    showClear
                                    placeholder="배당금을 재투자할 종목을 선택하세요"
                                    class="w-full" />
                                <label for="reinvestTarget"
                                    >재투자 대상 종목</label
                                >
                            </FloatLabel>
                        </div>
                    </div>

                    <div class="flex pt-4 justify-content-between">
                        <Button
                            label="Back"
                            severity="secondary"
                            @click="activateCallback('2')" />
                        <Button
                            v-if="options.testerType === '과거 비교'"
                            label="Next"
                            @click="activateCallback('4')" />
                        <Button
                            v-else
                            label="분석 실행"
                            icon="pi pi-play"
                            @click="handleRunClick" />
                    </div>
                </StepPanel>
            </StepItem>

            <StepItem value="4" v-if="options.testerType === '과거 비교'">
                <Step>종목 선택 (최대 5개)</Step>
                <StepPanel>
                    <div class="flex flex-column">
                        <div class="p-2 border-bottom-1 surface-border">
                            <template v-if="selectedStockDetails.length > 0"
                                ><Tag
                                    v-for="stock in selectedStockDetails"
                                    :key="stock.symbol"
                                    class="mr-2 mb-2"
                                    icon="pi pi-times"
                                    @click="removeSymbol(stock.symbol)"
                                    >{{ stock.symbol }}</Tag
                                ></template
                            >
                            <span v-else class="text-surface-500 text-sm p-2"
                                >아래 목록에서 종목을 선택하세요.</span
                            >
                        </div>
                        <Listbox
                            :modelValue="selectedSymbols"
                            @update:modelValue="
                                (symbols) =>
                                    emit('update:selectedSymbols', symbols)
                            "
                            :options="groupedAvailableStocks"
                            optionLabel="longName"
                            optionValue="symbol"
                            optionGroupLabel="label"
                            optionGroupChildren="items"
                            multiple
                            filter
                            listStyle="height:342px"
                            class="w-full">
                            <template #optiongroup="slotProps"
                                ><div
                                    class="flex align-items-center p-2 font-bold bg-surface-100 dark:bg-surface-800">
                                    {{ slotProps.option.label }}
                                </div></template
                            >
                            <template #option="slotProps"
                                ><div class="flex align-items-center">
                                    <div>{{ slotProps.option.longName }}</div>
                                </div></template
                            >
                        </Listbox>

                        <div
                            v-if="
                                options.reinvestment.strategy === '지정 재투자'
                            "
                            class="col-12 mt-3">
                            <FloatLabel>
                                <Dropdown
                                    v-model="options.reinvestment.targetSymbol"
                                    :options="targetReinvestmentStocks"
                                    optionLabel="longName"
                                    optionValue="symbol"
                                    filter
                                    showClear
                                    placeholder="배당금을 재투자할 종목을 선택하세요"
                                    class="w-full" />
                                <label for="reinvestTarget"
                                    >재투자 대상 종목</label
                                >
                            </FloatLabel>
                        </div>
                    </div>
                    <div class="flex pt-4 justify-content-between">
                        <Button
                            label="Back"
                            severity="secondary"
                            @click="activateCallback('3')" />
                        <Button
                            label="분석 실행"
                            icon="pi pi-play"
                            @click="handleRunClick" />
                    </div>
                </StepPanel>
            </StepItem>
        </Stepper>
    </div>
</template>
