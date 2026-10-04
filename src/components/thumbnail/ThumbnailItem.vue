<!-- src/components/thumbnail/ThumbnailItem.vue -->
<script setup>
import { computed } from 'vue';

const props = defineProps({
    data: Object,
});

const chartData = computed(() => {
    if (!props.data.showChart || !props.data.chartDividends) return [];

    // targetDate 추출 (YYYY-MM-DD 형식)
    const targetDateStr = props.data.targetDate;
    let targetDate = null;
    let targetYearMonth = null;

    if (targetDateStr) {
        // 날짜 비교를 위해 시간을 00:00:00으로 설정
        targetDate = new Date(targetDateStr);
        targetDate.setHours(0, 0, 0, 0);
        targetYearMonth = `${targetDate.getFullYear().toString().slice(-2)}.${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    // 월별로 그룹화
    const monthlyGroups = {};
    props.data.chartDividends.forEach((dividend) => {
        const date = new Date(dividend.date);
        // 날짜 비교를 위해 시간을 00:00:00으로 설정
        date.setHours(0, 0, 0, 0);
        const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        // targetDate가 속한 월의 경우, targetDate 이후의 배당은 제외
        if (
            targetYearMonth &&
            yearMonth === targetYearMonth &&
            targetDate
        ) {
            if (date > targetDate) {
                return; // 이 배당은 제외
            }
        }

        // NEW STRUCTURE: Use amountFixed as primary value (actual received amount)
        const amount = dividend.amountFixed ?? dividend.amount;

        if (!monthlyGroups[yearMonth]) {
            monthlyGroups[yearMonth] = [];
        }
        monthlyGroups[yearMonth].push(amount);
    });

    // 오래된 월부터 최신 월순으로 정렬 (최신이 아래로)
    const sortedData = Object.keys(monthlyGroups)
        .sort((a, b) => {
            const [ya, ma] = a.split('.').map(Number);
            const [yb, mb] = b.split('.').map(Number);
            if (ya !== yb) return ya - yb;
            return ma - mb;
        })
        .slice(-4) // 최근 4개월만 표시 (뒤에서 4개)
        .map((month) => ({
            month,
            amounts: monthlyGroups[month],
            total: monthlyGroups[month].reduce((sum, amt) => sum + amt, 0),
        }));

    // 최대 total 값을 구해서 비율 계산
    const totals = sortedData.map((item) => item.total);
    const maxTotal = totals.length > 0 ? Math.max(...totals) : 1;

    return sortedData.map((item) => ({
        ...item,
        widthRatio: (item.total / maxTotal) * 100,
    }));
});

const weekColors = [
    '#4285F4',
    '#EA4335',
    '#FBBC04',
    '#34A853',
    '#FF6D01',
    '#9C27B0',
    '#00BCD4',
];
const getColor = (index) => weekColors[index % weekColors.length];

const formatAmount = (amount) => {
    return `$${Number(amount).toFixed(4)}`;
};

const formatDate = (date) => {
    if (!date) return '날짜 정보 없음';
    const [year, month, day] = date.split('-');
    return `${year.slice(-2)}.${month}.${day}`;
};

const hasComparison = computed(
    () =>
        props.data.previousDividendAmount != null &&
        props.data.previousDividendAmount > 0
);

const comparisonDifference = computed(
    () => props.data.dividendDifference ?? 0
);
const comparisonPercent = computed(() => props.data.dividendChangePercent);
const comparisonTone = computed(() => {
    if (!hasComparison.value || comparisonDifference.value === 0) return 'neutral';
    return comparisonDifference.value > 0 ? 'up' : 'down';
});

const formatSignedAmount = (amount) => {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
    return `${sign}${formatAmount(Math.abs(amount))}`;
};

const formatSignedPercent = (value) => {
    if (value == null) return '';
    const sign = value > 0 ? '+' : '';
    return `${sign}${Number(value).toFixed(2)}%`;
};
</script>

<template>
    <div class="thumbnail-item-wrapper" :class="{ 'with-chart': data.showChart }">
        <div class="thumbnail-container">
            <section class="thumbnail-capture" data-thumbnail-kind="summary">
                <img :src="data.backgroundImageUrl" class="bg-image" alt="" />
                <div class="thumbnail-scrim" aria-hidden="true" />

                <header class="distribution-header">
                    <span>최근 배당 정보</span>
                    <time>{{ formatDate(data.exDate) }}</time>
                </header>

                <main v-if="data.hasDividend" class="distribution-main">
                    <h1 class="ticker">
                        {{ data.symbol }}
                    </h1>
                    <div class="current-amount">
                        <span>이번 세전 배당금</span>
                        <strong>{{ formatAmount(data.currentDividendAmount) }}</strong>
                    </div>

                    <section class="comparison-card" :class="`is-${comparisonTone}`">
                        <template v-if="hasComparison">
                            <p>직전 배당금 <strong>{{ formatAmount(data.previousDividendAmount) }}</strong></p>
                            <span class="comparison-arrow" aria-hidden="true">→</span>
                            <p>이번 배당금 <strong>{{ formatAmount(data.currentDividendAmount) }}</strong></p>
                            <b>{{ formatSignedAmount(comparisonDifference) }} · {{ formatSignedPercent(comparisonPercent) }}</b>
                        </template>
                        <p v-else class="comparison-missing">직전 배당 데이터 없음</p>
                    </section>

                </main>

                <p v-else class="distribution-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>

                <section v-if="data.showChart && chartData.length > 0" class="monthly-history">
                    <p>최근 월별 배당 합계 <small>예정값 제외</small></p>
                    <div v-for="item in chartData" :key="item.month" class="chart-row">
                        <div class="chart-label">
                            <span class="chart-month">{{ item.month }}</span>
                            <span class="chart-total">{{ formatAmount(item.total) }}</span>
                        </div>
                        <div class="chart-bar" :style="{ width: `${item.widthRatio}%` }">
                            <div v-for="(amount, idx) in item.amounts" :key="idx" class="chart-segment" :style="{
                                width: `${(amount / item.total) * 100}%`,
                                backgroundColor: getColor(idx),
                            }" />
                        </div>
                    </div>
                </section>

                <footer class="thumbnail-footer">주당 USD 기준 · 최근 실제 배당 이력</footer>
            </section>
        </div>
    </div>
</template>
