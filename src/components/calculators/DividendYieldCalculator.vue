<!-- src\components\calculators\DividendYieldCalculator.vue -->
<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useDividendStats } from '@/composables/useDividendStats';
    import { parseYYMMDD } from '@/utils/date.js';

    // PrimeVue 컴포넌트 import
    import Card from 'primevue/card';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import InputNumber from 'primevue/inputnumber';
    import SelectButton from 'primevue/selectbutton';
    import Divider from 'primevue/divider';
    import Tag from 'primevue/tag';
    import IftaLabel from 'primevue/iftalabel';
    import RadioButton from 'primevue/radiobutton';

    const props = defineProps({
        tickerInfo: Object,
        dividendHistory: Array,
    });

    // --- 상태 변수 ---
    const { deviceType } = useBreakpoint();
    const calculationMode = ref('quantity');

    // 1. 초기값을 100주 기준으로 변경
    const inputAmountKRW = ref(0); // 초기 투자금은 0으로 시작
    const inputQuantity = ref(100); // 초기 수량을 100주로 설정
    const exchangeRate = ref(1380);
    const dividendPeriod = ref('1Y');
    const periodOptions = ref([
        { label: '前 3M', value: '3M' },
        { label: '前 6M', value: '6M' },
        { label: '前 1Y', value: '1Y' },
    ]);

    // 2. 초기 계산을 한 번만 실행하기 위한 플래그
    const isInitialized = ref(false);

    const { dividendStats, payoutsPerYear } = useDividendStats(
        computed(() => props.dividendHistory),
        computed(() => props.tickerInfo),
        dividendPeriod
    );

    const inputAmountUSD = computed({
        get: () => {
            if (!exchangeRate.value) return 0;
            return inputAmountKRW.value / exchangeRate.value;
        },
        set: (newValue) => {
            if (!exchangeRate.value) return;
            inputAmountKRW.value = newValue * exchangeRate.value;
        },
    });

    // --- 데이터 추출 (Computed) ---
    const currentPriceUSD = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );

    // --- 계산 로직 (Computed) ---
    watch(inputAmountKRW, (newKRW) => {
        if (
            calculationMode.value === 'amount' &&
            currentPriceUSD.value > 0 &&
            exchangeRate.value > 0
        ) {
            const budgetUSD = newKRW / exchangeRate.value;
            inputQuantity.value = Math.floor(budgetUSD / currentPriceUSD.value);
        }
    });

    watch(inputQuantity, (newQuantity) => {
        if (
            calculationMode.value === 'quantity' &&
            currentPriceUSD.value > 0 &&
            exchangeRate.value > 0
        ) {
            const totalValueUSD = newQuantity * currentPriceUSD.value;
            inputAmountKRW.value = totalValueUSD * exchangeRate.value;
        }
    });

    const expectedDividendsByScenario = computed(() => {
        const calculate = (dividendPerShare, taxRate) => {
            if (
                inputQuantity.value === 0 ||
                dividendPerShare === 0 ||
                payoutsPerYear.value === 0
            ) {
                return { perPayout: 0, monthly: 0, quarterly: 0, annual: 0 };
            }
            const totalDividendPerPayout =
                inputQuantity.value * dividendPerShare * taxRate;
            const annualDividend =
                totalDividendPerPayout * payoutsPerYear.value;
            return {
                perPayout: totalDividendPerPayout,
                monthly: annualDividend / 12,
                quarterly: annualDividend / 4,
                annual: annualDividend,
            };
        };

        const createScenarios = (taxRate) => {
            return {
                hope: calculate(dividendStats.value.max, taxRate),
                avg: calculate(dividendStats.value.avg, taxRate),
                despair: calculate(dividendStats.value.min, taxRate),
            };
        };

        return {
            preTax: createScenarios(1.0),
            postTax: createScenarios(0.85),
        };
    });

    // 3. 초기 투자금 계산 함수
    const calculateInitialAmount = () => {
        // 이미 초기화되었거나, 필요한 데이터가 없으면 실행하지 않음
        if (
            isInitialized.value ||
            currentPriceUSD.value <= 0 ||
            exchangeRate.value <= 0
        ) {
            return;
        }
        // 100주 기준으로 투자금(KRW) 계산
        inputAmountKRW.value =
            inputQuantity.value * currentPriceUSD.value * exchangeRate.value;
        isInitialized.value = true; // 초기화 완료 플래그 설정
    };

    onMounted(async () => {
        try {
            const response = await fetch('/api/getExchangeRate');
            if (!response.ok) {
                throw new Error('Failed to fetch exchange rate');
            }
            const data = await response.json();
            exchangeRate.value = data.price;
        } catch (error) {
            console.error(error);
            exchangeRate.value = 1380;
        } finally {
            // 4. 환율을 가져온 후 초기 투자금 계산 시도
            calculateInitialAmount();
        }
    });

    // 5. 주가 정보(props)가 변경될 때 초기 투자금 계산 시도
    watch(currentPriceUSD, () => {
        calculateInitialAmount();
    });

    const formatKRW = (amount) =>
        (amount * exchangeRate.value).toLocaleString('ko-KR', {
            maximumFractionDigits: 0,
        }) + '원';
</script>

<template>
    <div
        class="toto-calculator-grid"
        :class="
            deviceType === 'desktop'
                ? 'toto-calculator-grid-row'
                : 'toto-calculator-grid-column'
        ">
        <div class="toto-calculator-option">
            <!-- 1. 현재 환율과 현재 주가 표시 -->
            <div class="flex align-items-center mb-2 justify-content-between">
                <Tag severity="contrast"
                    >환율 : {{ exchangeRate?.toLocaleString('ko-KR') }}원</Tag
                >
                <Tag severity="contrast"
                    >현재 주가 :
                    {{
                        currentPriceUSD?.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                        })
                    }}</Tag
                >
            </div>
            <div class="toto-howmuch">
                <InputGroup>
                    <InputGroupAddon>
                        <RadioButton
                            v-model="calculationMode"
                            inputId="modeAmount"
                            name="calcMode"
                            value="amount" />
                    </InputGroupAddon>
                    <InputGroupAddon>
                        <i class="pi pi-dollar" />
                    </InputGroupAddon>
                    <InputNumber
                        placeholder="투자 금액 (KRW)"
                        v-model="inputAmountKRW"
                        mode="currency"
                        currency="KRW"
                        locale="ko-KR" />
                    <InputNumber
                        placeholder="투자 금액 (USD)"
                        v-model="inputAmountUSD"
                        mode="currency"
                        currency="USD"
                        locale="en-US" />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon>
                        <RadioButton
                            v-model="calculationMode"
                            inputId="modeQuantity"
                            name="calcMode"
                            value="quantity" />
                    </InputGroupAddon>
                    <InputGroupAddon>
                        <i class="pi pi-dollar" />
                    </InputGroupAddon>
                    <InputNumber
                        inputId="input-quantity"
                        v-model="inputQuantity"
                        suffix=" 주"
                        class="w-full" />
                </InputGroup>
            </div>
            <InputGroup class="toto-reference-period">
                <IftaLabel>
                    <SelectButton
                        v-model="dividendPeriod"
                        :options="periodOptions"
                        optionLabel="label"
                        optionValue="value" />
                    <label>
                        <span>前 배당금 참고 기간</span>
                        <Tag severity="contrast">{{ dividendPeriod }}</Tag>
                    </label>
                </IftaLabel>
            </InputGroup>
            <!-- 세금 적용 선택 UI 제거 -->
        </div>
        <Divider v-if="deviceType !== 'desktop'" />
        <Card class="toto-calculator-result flex-1 toto-howmuch-result">
            <template #content>
                <table class="w-full text-center">
                    <colgroup>
                        <col />
                        <col style="width: 15%" />
                        <col style="width: 25%" />
                        <col style="width: 25%" />
                        <col style="width: 25%" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th></th>
                            <th>세금</th>
                            <th>희망</th>
                            <th>평균</th>
                            <th>절망</th>
                        </tr>
                        <tr>
                            <th rowspan="2">기준 배당금</th>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <th>${{ dividendStats.max.toFixed(4) }}</th>
                            <th>${{ dividendStats.avg.toFixed(4) }}</th>
                            <th>${{ dividendStats.min.toFixed(4) }}</th>
                        </tr>
                        <tr>
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <th>
                                ${{ (dividendStats.max * 0.85).toFixed(4) }}
                            </th>
                            <th>
                                ${{ (dividendStats.avg * 0.85).toFixed(4) }}
                            </th>
                            <th>
                                ${{ (dividendStats.min * 0.85).toFixed(4) }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- 1회당 -->
                        <tr>
                            <td class="p-2 font-semibold" rowspan="2">1회당</td>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.hope.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax.hope
                                            .perPayout
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.avg.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax.avg
                                            .perPayout
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.despair.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax
                                            .despair.perPayout
                                    )
                                }}</small>
                            </td>
                        </tr>
                        <tr class="border-b border-surface-800">
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.hope.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax.hope
                                            .perPayout
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.avg.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax.avg
                                            .perPayout
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.despair.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax
                                            .despair.perPayout
                                    )
                                }}</small>
                            </td>
                        </tr>

                        <!-- 월간 -->
                        <tr>
                            <td class="p-2 font-semibold" rowspan="2">월간</td>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.hope.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax.hope
                                            .monthly
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.avg.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax.avg
                                            .monthly
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.despair.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax
                                            .despair.monthly
                                    )
                                }}</small>
                            </td>
                        </tr>
                        <tr class="border-b border-surface-800">
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.hope.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax.hope
                                            .monthly
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.avg.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax.avg
                                            .monthly
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.despair.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax
                                            .despair.monthly
                                    )
                                }}</small>
                            </td>
                        </tr>
                        <!-- 연간 -->
                        <tr>
                            <td class="p-2 font-semibold" rowspan="2">연간</td>
                            <th>
                                <i
                                    class="pi pi-lock-open"
                                    v-tooltip.bottom="'세전'" />
                            </th>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.hope.annual.toFixed(
                                        2
                                    )
                                }}<br />
                                <small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax.hope
                                            .annual
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.avg.annual.toFixed(
                                        2
                                    )
                                }}<br />
                                <small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax.avg
                                            .annual
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.preTax.despair.annual.toFixed(
                                        2
                                    )
                                }}<br />
                                <small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.preTax
                                            .despair.annual
                                    )
                                }}</small>
                            </td>
                        </tr>
                        <tr>
                            <th>
                                <i
                                    class="pi pi-lock"
                                    v-tooltip.bottom="'세후'" />
                            </th>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.hope.annual.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax.hope
                                            .annual
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.avg.annual.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax.avg
                                            .annual
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.postTax.despair.annual.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.postTax
                                            .despair.annual
                                    )
                                }}</small>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </template>
        </Card>
    </div>
</template>
