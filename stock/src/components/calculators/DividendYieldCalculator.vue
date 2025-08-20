<script setup>
    import { ref, computed, onMounted } from 'vue';
    import { parseYYMMDD } from '@/utils/date.js';
    import InputNumber from 'primevue/inputnumber';
    import SelectButton from 'primevue/selectbutton';

    const props = defineProps({
        tickerInfo: Object,
        dividendHistory: Array,
    });

    // --- 상태 변수 ---
    const calculationMode = ref('quantity');

    const modeOptions = ref([
        { label: '금액으로 계산', value: 'amount' },
        { label: '수량으로 계산', value: 'quantity' },
    ]);

    const inputAmountKRW = ref(1000000);
    const inputQuantity = ref(100);
    const exchangeRate = ref(1380);
    const dividendPeriod = ref('1Y'); // 배당금 참고 기간 상태 추가
    const periodOptions = ref([
        { label: '前 3M', value: '3M' },
        { label: '前 6M', value: '6M' },
        { label: '前 1Y', value: '1Y' },
    ]);

    // --- 데이터 추출 (Computed) ---
    const currentPriceUSD = computed(
        () => props.tickerInfo?.regularMarketPrice || 0
    );
    const payoutsPerYear = computed(() => {
        if (!props.dividendHistory || props.dividendHistory.length === 0)
            return 0;
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // d.date -> d['배당락'] 으로 수정
        const pastYearDividends = props.dividendHistory.filter(
            (d) => parseYYMMDD(d['배당락']) > oneYearAgo
        );

        if (pastYearDividends.length > 0) return pastYearDividends.length;

        // API에 frequency 정보가 없는 경우를 대비한 기본값 추가
        const freq = props.tickerInfo?.frequency;
        if (freq === '분기') return 4;
        if (freq === '매주') return 52;
        return 12; // 기본값은 월배당으로 간주
    });

    // --- 핵심: 과거 배당금 통계 계산 (희망/평균/절망) ---
    const dividendStats = computed(() => {
        if (!props.dividendHistory) return { min: 0, max: 0, avg: 0 };

        const filtered = props.dividendHistory.filter((item) => {
            const now = new Date();
            let cutoffDate = new Date();
            const rangeValue = parseInt(dividendPeriod.value);
            const rangeUnit = dividendPeriod.value.slice(-1);
            if (rangeUnit === 'M')
                cutoffDate.setMonth(now.getMonth() - rangeValue);
            else cutoffDate.setFullYear(now.getFullYear() - rangeValue);
            return parseYYMMDD(item['배당락']) >= cutoffDate;
        });

        const validAmounts = filtered
            .map((h) => parseFloat(h['배당금']?.replace('$', '')))
            .filter((a) => !isNaN(a) && a > 0);

        if (validAmounts.length === 0) return { min: 0, max: 0, avg: 0 };

        return {
            min: Math.min(...validAmounts),
            max: Math.max(...validAmounts),
            avg: validAmounts.reduce((s, a) => s + a, 0) / validAmounts.length,
        };
    });

    // --- 계산 로직 (Computed) ---
    // 최종적으로 계산의 기준이 되는 '수량'
    const calculatedQuantity = computed(() => {
        if (calculationMode.value === 'quantity') {
            return inputQuantity.value;
        } else {
            // amount 모드
            if (currentPriceUSD.value === 0 || exchangeRate.value === 0)
                return 0;
            const budgetUSD = inputAmountKRW.value / exchangeRate.value;
            return Math.floor(budgetUSD / currentPriceUSD.value);
        }
    });
    // 최종적으로 계산의 기준이 되는 '총 투자금 (USD)'
    const totalInvestmentUSD = computed(() => {
        return calculatedQuantity.value * currentPriceUSD.value;
    });

    // --- 핵심: 시나리오별 예상 배당금 계산 ---
    const expectedDividendsByScenario = computed(() => {
        const calculate = (dividendPerShare) => {
            if (
                calculatedQuantity.value === 0 ||
                dividendPerShare === 0 ||
                payoutsPerYear.value === 0
            ) {
                return { perPayout: 0, monthly: 0, quarterly: 0, annual: 0 };
            }
            const totalDividendPerPayout =
                calculatedQuantity.value * dividendPerShare;
            const annualDividend =
                totalDividendPerPayout * payoutsPerYear.value;
            return {
                perPayout: totalDividendPerPayout,
                monthly: annualDividend / 12,
                quarterly: annualDividend / 4,
                annual: annualDividend,
            };
        };

        return {
            hope: calculate(dividendStats.value.max),
            avg: calculate(dividendStats.value.avg),
            despair: calculate(dividendStats.value.min),
        };
    });

    onMounted(async () => {
        try {
            const response = await fetch('/api/getExchangeRate');
            if (!response.ok) {
                throw new Error('Failed to fetch exchange rate');
            }
            const data = await response.json();
            exchangeRate.value = data.price; // 예: 1380.55
        } catch (error) {
            console.error(error);
            // 환율을 가져오지 못했을 때의 예비 처리 (예: 기본값 사용)
            exchangeRate.value = 1380;
        }
    });

    // 숫자 포맷팅 헬퍼
    const formatKRW = (amount) =>
        (amount * exchangeRate.value).toLocaleString('ko-KR', {
            maximumFractionDigits: 0,
        }) + '원';
</script>

<template>
    <div class="p-4">
        <div class="flex flex-column gap-4">
            <!-- 모드 전환 버튼 -->
            <SelectButton
                v-model="calculationMode"
                :options="modeOptions"
                optionLabel="label"
                optionValue="value" />

            <!-- 입력 섹션 -->
            <div v-if="calculationMode === 'amount'">
                <label for="input-amount" class="block mb-2 text-sm"
                    >투자 금액 (KRW)</label
                >
                <InputNumber
                    inputId="input-amount"
                    v-model="inputAmountKRW"
                    mode="currency"
                    currency="KRW"
                    locale="ko-KR"
                    class="w-full" />
            </div>
            <div v-else>
                <label for="input-quantity" class="block mb-2 text-sm"
                    >매수 수량</label
                >
                <InputNumber
                    inputId="input-quantity"
                    v-model="inputQuantity"
                    suffix=" 주"
                    class="w-full" />
            </div>

            <!-- 계산 결과 요약 -->
            <div class="text-sm p-3 bg-surface-800 rounded-md">
                <div
                    v-if="calculationMode === 'amount'"
                    class="flex justify-between">
                    <span>매수 가능 수량:</span>
                    <span class="font-semibold"
                        >{{ calculatedQuantity.toLocaleString() }} 주</span
                    >
                </div>
                <div class="flex justify-between">
                    <span>예상 투자금:</span>
                    <span class="font-semibold">
                        {{
                            (totalInvestmentUSD * exchangeRate).toLocaleString(
                                'ko-KR',
                                { style: 'currency', currency: 'KRW' }
                            )
                        }}
                        (${{
                            totalInvestmentUSD.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })
                        }})
                    </span>
                </div>
            </div>

            <!-- 배당금 참고 기간 선택 버튼 -->
            <div>
                <label class="block mb-2 text-sm">前 배당금 참고 기간</label>
                <SelectButton
                    v-model="dividendPeriod"
                    :options="periodOptions"
                    optionLabel="label"
                    optionValue="value" />
            </div>

            <!-- ... 계산 결과 요약 (매수 가능 수량, 예상 투자금) ... -->

            <!-- 핵심: 시나리오별 예상 배당금 테이블 -->
            <div class="mt-4">
                <h3 class="font-bold mb-2">시나리오별 예상 배당금 (세전)</h3>
                <table class="w-full text-center text-sm">
                    <thead>
                        <tr class="border-b border-surface-700">
                            <th class="p-2">구분</th>
                            <th class="p-2 text-green-400">
                                희망 (${{ dividendStats.max.toFixed(4) }})
                            </th>
                            <th class="p-2 text-yellow-400">
                                평균 (${{ dividendStats.avg.toFixed(4) }})
                            </th>
                            <th class="p-2 text-red-400">
                                절망 (${{ dividendStats.min.toFixed(4) }})
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-surface-800">
                            <td class="p-2 font-semibold">1회당</td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.hope.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.hope
                                            .perPayout
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.avg.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.avg
                                            .perPayout
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.despair.perPayout.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.despair
                                            .perPayout
                                    )
                                }}</small>
                            </td>
                        </tr>
                        <tr class="border-b border-surface-800">
                            <td class="p-2 font-semibold">월간</td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.hope.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.hope.monthly
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.avg.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.avg.monthly
                                    )
                                }}</small>
                            </td>
                            <td>
                                ${{
                                    expectedDividendsByScenario.despair.monthly.toFixed(
                                        2
                                    )
                                }}<br /><small>{{
                                    formatKRW(
                                        expectedDividendsByScenario.despair
                                            .monthly
                                    )
                                }}</small>
                            </td>
                        </tr>
                        <!-- 분기, 연간 행도 동일한 패턴으로 추가 -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
