<!-- src\components\mypage\BacktesterChart.vue -->
<script setup>
    import { computed, watch } from 'vue';
    import Chart from 'primevue/chart';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';

    const props = defineProps({
        result: {
            type: Object,
            default: null,
        },
        isLoading: {
            type: Boolean,
            default: false,
        },
    });

    // [디버그 4] props로 받은 result 데이터가 변경될 때마다 확인합니다.
    watch(
        () => props.result,
        (newResult) => {
            console.log(
                '%c[Chart] 4. props로 새로운 result 데이터 수신',
                'color: purple; font-weight: bold;',
                newResult
            );
        },
        { deep: true, immediate: true }
    );

    const chartOptions = computed(() => {
        return {
            maintainAspectRatio: false,
            aspectRatio: 1.8,
            plugins: {
                legend: {
                    position: 'top',
                },
                datalabels: {
                    display: false,
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function (tooltipItems) {
                            return tooltipItems[0].label;
                        },
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + '%';
                            }
                            return label;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 12,
                        autoSkip: true,
                    },
                },
                y: {
                    ticks: {
                        callback: function (value) {
                            return value + '%';
                        },
                    },
                    title: {
                        display: true,
                        text: 'Total Return (%)',
                    },
                },
            },
            elements: {
                point: {
                    radius: 0,
                },
                line: {
                    borderWidth: 2,
                },
            },
        };
    });

    // [추가] 최종 요약 정보를 표시하기 위한 computed 속성
    const summary = computed(() => {
        if (!props.result || !props.result.summary) return null;
        return props.result.summary;
    });
</script>

<template>
    <div class="surface-card p-4 border-round">
        <div
            v-if="isLoading"
            class="flex flex-column justify-content-center align-items-center"
            style="height: 400px">
            <i class="pi pi-spin pi-spinner" style="font-size: 3rem"></i>
            <p class="mt-3 text-lg">
                과거 데이터를 기반으로 시뮬레이션 중입니다...
            </p>
        </div>

        <!-- [핵심 수정] v-else-if를 div 내부로 옮겨 구조를 변경합니다. -->
        <div v-else-if="result && result.chartData">
            <!-- 요약 정보 카드 -->
            <div v-if="summary" class="grid text-center mb-4">
                <div class="col">
                    <div class="surface-section p-3 border-round">
                        <div class="text-500 mb-2">최종 평가액 (USD)</div>
                        <div class="text-xl font-bold">
                            {{
                                new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                }).format(summary.finalValue)
                            }}
                        </div>
                    </div>
                </div>
                <div class="col">
                    <div class="surface-section p-3 border-round">
                        <div class="text-500 mb-2">포트폴리오 총 수익률</div>
                        <div
                            class="text-xl font-bold"
                            :class="
                                summary.totalReturnPercent >= 0
                                    ? 'text-green-500'
                                    : 'text-red-500'
                            ">
                            {{ summary.totalReturnPercent.toFixed(2) }}%
                        </div>
                    </div>
                </div>
                <div class="col">
                    <div class="surface-section p-3 border-round">
                        <div class="text-500 mb-2">S&P 500 총 수익률</div>
                        <div
                            class="text-xl font-bold"
                            :class="
                                summary.sp500ReturnPercent >= 0
                                    ? 'text-green-500'
                                    : 'text-red-500'
                            ">
                            {{ summary.sp500ReturnPercent.toFixed(2) }}%
                        </div>
                    </div>
                </div>
            </div>

            <!-- 차트와 테이블을 감싸는 컨테이너 -->
            <div class="grid">
                <div class="col-12" style="height: 400px">
                    <Chart
                        type="line"
                        :data="result.chartData"
                        :options="chartOptions" />
                </div>

                <!-- 재투자 X 모드일 때만 배당금 내역 테이블 표시 -->
                <div
                    v-if="
                        result.cashDividends && result.cashDividends.length > 0
                    "
                    class="col-12 mt-4">
                    <h3 class="text-xl font-semibold mb-2">
                        누적 현금 배당금 내역 (세후)
                    </h3>
                    <DataTable
                        :value="result.cashDividends"
                        :rows="5"
                        paginator
                        responsiveLayout="scroll"
                        class="p-datatable-sm">
                        <Column field="date" header="지급일" sortable></Column>
                        <Column field="ticker" header="종목" sortable></Column>
                        <Column field="amount" header="배당금 (USD)" sortable>
                            <template #body="slotProps">
                                {{
                                    new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
                                    }).format(slotProps.data.amount)
                                }}
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>
        </div>

        <div
            v-else
            class="flex flex-column justify-content-center align-items-center"
            style="height: 400px">
            <p class="text-surface-500">
                북마크 목록에서 5개 이하 종목을 선택하고 백테스팅을
                실행해주세요.
            </p>
        </div>
    </div>
</template>
