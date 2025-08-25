<script setup>
    import { ref, computed } from 'vue';

    // PrimeVue 컴포넌트 import
    import Card from 'primevue/card';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Tag from 'primevue/tag';
    import Avatar from 'primevue/avatar';

    // --- 데이터 ---
    // 추후 CSV 파싱 및 API 연동을 통해 받아올 데이터의 목업(mock)입니다.

    // 1. 자산 요약 데이터
    const summary = ref({
        totalAssets: 50406597,
        investment: 50406597 - 639889,
        cash: 639889,
        principal: 84312644,
        totalPnl: -34545936,
        totalPnlPercent: -40.97,
        dailyPnl: 1543128,
        dailyPnlPercent: 3.2,
    });

    // 2. 보유 종목 데이터
    // 이미지처럼 '계좌'별로 동일 종목을 그룹핑하기 위해 'group'과 'accountName' 속성을 추가했습니다.
    const holdings = ref([
        // YieldMax Universe Fund ...
        {
            group: 'YMAX',
            logo: 'https://images.stockanalysis.com/assets/images/stocks/logos/YMAX.png',
            name: 'YieldMax Universe Fund of Option Income ETFs',
            ticker: 'YMAX',
            accountName: '남편',
            evaluation: 24306748,
            quantity: 1365,
            avgCost: 23478,
            currentPrice: 17807,
            dailyPnl: 548557,
            dailyPnlPercent: 2.31,
        },
        {
            group: 'YMAX',
            name: 'YieldMax Universe Fund of Option Income ETFs',
            ticker: 'YMAX',
            accountName: '위탁계좌',
            evaluation: 0,
            quantity: 0,
            avgCost: 0,
            currentPrice: 17807,
            dailyPnl: 0,
            dailyPnlPercent: 2.31,
        },
        // TSLY
        {
            group: 'TSLY',
            logo: 'https://images.stockanalysis.com/assets/images/stocks/logos/TSLY.png',
            name: '일드맥스 테슬라 옵션 인컴 전략 ETF',
            ticker: 'TSLY',
            accountName: '위탁',
            evaluation: 12561727,
            quantity: 1141.66,
            avgCost: 21588,
            currentPrice: 11003,
            dailyPnl: 601191,
            dailyPnlPercent: 5.03,
        },
        // MSTY
        {
            group: 'MSTY',
            logo: 'https://images.stockanalysis.com/assets/images/stocks/logos/MSTY.png',
            name: 'YieldMax MSTR Option Income Strategy ETF',
            ticker: 'MSTY',
            accountName: '위탁',
            evaluation: 3529476,
            quantity: 145.12,
            avgCost: 27832,
            currentPrice: 24320,
            dailyPnl: 172954,
            dailyPnlPercent: 5.15,
        },
    ]);

    // 3. 현금 보유 데이터
    const cashHoldings = ref([
        { currency: 'KRW', amount: 17748, symbol: '원' },
        { currency: 'USD', amount: 448.95, symbol: '$' },
    ]);

    // --- 헬퍼 함수 ---

    // 숫자 포맷 (원화)
    const formatKrw = (value) => {
        if (typeof value !== 'number') return value;
        return `${value.toLocaleString('ko-KR')}원`;
    };

    // 퍼센트 포맷 (+/- 기호 포함)
    const formatPercent = (value) => {
        if (typeof value !== 'number') return '0.00%';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    // 손익에 따른 CSS 클래스 반환
    const getPnlClass = (value) => {
        if (value > 0) return 'text-red-500';
        if (value < 0) return 'text-blue-500';
        return 'text-color-secondary';
    };

    // DataTable 그룹 헤더 계산용
    const calculateGroupTotal = (data, field) => {
        if (!data) return 0;
        return data.reduce((acc, item) => acc + item[field], 0);
    };
</script>

<template>
    <div class="asset-manager p-4">
        <!-- 1. 자산 요약 카드 -->
        <Card class="mb-4">
            <template #title>
                <div class="flex justify-content-between align-items-center">
                    <span>총 자산</span>
                    <i
                        class="pi pi-replay cursor-pointer text-lg"
                        v-tooltip.bottom="'새로고침'"></i>
                </div>
            </template>
            <template #content>
                <div class="summary-content">
                    <h1 class="total-assets">
                        {{ formatKrw(summary.totalAssets) }}
                    </h1>
                    <div class="flex justify-content-between text-lg my-3">
                        <div>
                            <span class="text-color-secondary mr-2">투자</span>
                            <strong>{{ formatKrw(summary.investment) }}</strong>
                        </div>
                        <div>
                            <span class="text-color-secondary mr-2">현금</span>
                            <strong>{{ formatKrw(summary.cash) }}</strong>
                        </div>
                    </div>
                    <hr class="my-3 border-surface-200" />
                    <div class="grid text-base">
                        <div class="col-4">
                            <div class="text-color-secondary">원금</div>
                            <div>{{ formatKrw(summary.principal) }}</div>
                        </div>
                        <div class="col-4">
                            <div class="text-color-secondary">총 수익</div>
                            <div :class="getPnlClass(summary.totalPnl)">
                                {{ formatKrw(summary.totalPnl) }}
                                ({{ formatPercent(summary.totalPnlPercent) }})
                            </div>
                        </div>
                        <div class="col-4">
                            <div class="text-color-secondary">일간 수익</div>
                            <div :class="getPnlClass(summary.dailyPnl)">
                                {{ formatKrw(summary.dailyPnl) }}
                                ({{ formatPercent(summary.dailyPnlPercent) }})
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </Card>

        <!-- 2. 투자 종목 테이블 -->
        <div class="holdings-section">
            <h2 class="section-title">투자</h2>
            <DataTable
                :value="holdings"
                rowGroupMode="subheader"
                groupRowsBy="group"
                sortMode="single"
                sortField="group"
                :sortOrder="1">
                <template #groupheader="slotProps">
                    <div class="flex align-items-center gap-2 p-2 font-bold">
                        <Avatar :image="slotProps.data.logo" shape="circle" />
                        <span class="text-lg"
                            >{{ slotProps.data.name }} ({{
                                slotProps.data.ticker
                            }})</span
                        >
                    </div>
                </template>

                <Column
                    field="accountName"
                    header="계좌"
                    style="width: 15%"></Column>

                <Column
                    field="evaluation"
                    header="평가액"
                    sortable
                    style="width: 20%">
                    <template #body="{ data }">
                        {{ formatKrw(data.evaluation) }}
                    </template>
                </Column>

                <Column
                    field="quantity"
                    header="보유량"
                    sortable
                    style="width: 10%">
                    <template #body="{ data }">
                        {{ data.quantity.toLocaleString() }}
                    </template>
                </Column>

                <Column
                    field="avgCost"
                    header="평단가"
                    sortable
                    style="width: 15%">
                    <template #body="{ data }">
                        {{ formatKrw(data.avgCost) }}
                    </template>
                </Column>
                <Column
                    field="currentPrice"
                    header="현재 시세"
                    style="width: 15%">
                    <template #body="{ data }">
                        {{ formatKrw(data.currentPrice) }}
                    </template>
                </Column>
                <Column
                    field="dailyPnl"
                    header="일간 수익"
                    sortable
                    style="width: 25%">
                    <template #body="{ data }">
                        <div class="flex flex-column text-right">
                            <span :class="getPnlClass(data.dailyPnl)">{{
                                formatKrw(data.dailyPnl)
                            }}</span>
                            <span :class="getPnlClass(data.dailyPnlPercent)">{{
                                formatPercent(data.dailyPnlPercent)
                            }}</span>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- 3. 현금 보유 -->
        <div class="cash-section mt-4">
            <h2 class="section-title">현금</h2>
            <Card>
                <template #content>
                    <div
                        v-for="cash in cashHoldings"
                        :key="cash.currency"
                        class="flex justify-content-between align-items-center mb-2">
                        <div class="flex align-items-center">
                            <Avatar
                                :label="cash.symbol"
                                shape="circle"
                                class="mr-2" />
                            <span>{{ cash.currency }}</span>
                        </div>
                        <span class="font-bold text-lg">
                            {{
                                cash.amount.toLocaleString(undefined, {
                                    minimumFractionDigits:
                                        cash.currency === 'USD' ? 2 : 0,
                                })
                            }}
                            {{ cash.symbol }}
                        </span>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>

<style scoped>
    .asset-manager {
        max-width: 1200px;
        margin: 0 auto;
    }

    .total-assets {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 0;
    }

    .section-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 1rem;
    }

    .text-red-500 {
        color: #ef4444; /* PrimeVue 기본 색상과 유사하게 */
    }

    .text-blue-500 {
        color: #3b82f6; /* PrimeVue 기본 색상과 유사하게 */
    }

    /* DataTable 우측 정렬 */
    .p-datatable .p-column-header-content {
        justify-content: flex-end;
    }
</style>
