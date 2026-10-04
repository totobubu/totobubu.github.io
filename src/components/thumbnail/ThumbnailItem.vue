<!-- src/components/thumbnail/ThumbnailItem.vue -->
<script setup>
import { computed } from 'vue';

const props = defineProps({
    data: Object,
});

const recentDividendEvents = computed(() => {
    if (!props.data.showChart) return [];
    return props.data.recentDividendEvents ?? [];
});

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

const formatMetricAmount = (amount) =>
    amount != null && Number.isFinite(Number(amount))
        ? formatAmount(amount)
        : '데이터 없음';

const formatMetricPercent = (value) =>
    value != null && Number.isFinite(Number(value))
        ? `${Number(value).toFixed(2)}%`
        : '데이터 없음';
</script>

<template>
    <div class="thumbnail-item-wrapper" :class="{ 'with-chart': data.showChart }">
        <div class="thumbnail-container">
            <section class="thumbnail-capture" :class="`is-${comparisonTone}`" data-thumbnail-kind="summary">
                <div class="summary-card">
                    <header class="distribution-header">
                        <div class="ticker-meta">
                            <h1 class="ticker">{{ data.symbol }}</h1>
                            <span class="ticker-badge">배당 정보</span>
                        </div>
                        <div class="header-meta">
                            <div class="ex-date"><span>배당락일</span><time>{{ formatDate(data.exDate) }}</time></div>
                        </div>
                    </header>

                    <main v-if="data.hasDividend" class="distribution-main">
                        <div class="summary-hero">
                            <span>주당 지급 배당금 (세전)</span>
                            <strong>{{ formatAmount(data.currentDividendAmount) }}</strong>
                        </div>

                        <section class="change-signal" :class="`is-${comparisonTone}`" aria-label="직전 배당 대비 변화">
                            <template v-if="hasComparison">
                                <div class="change-badge">
                                    <span aria-hidden="true">{{ comparisonTone === 'up' ? '▲' : comparisonTone === 'down' ? '▼' : '─' }}</span>
                                    <strong>{{ formatSignedPercent(comparisonPercent) }}</strong>
                                    <small>({{ formatSignedAmount(comparisonDifference) }})</small>
                                </div>
                            </template>
                            <p v-else class="comparison-missing">직전 배당 데이터 없음</p>
                        </section>

                        <section class="key-metrics" aria-label="배당 핵심 지표">
                            <article>
                                <span>예상 세후 실수령</span>
                                <strong>{{ formatMetricAmount(data.afterTaxDividendAmount) }}</strong>
                                <small>15% 원천징수</small>
                            </article>
                            <article>
                                <span>배당락일 종가</span>
                                <strong>{{ formatMetricAmount(data.exDividendClose) }}</strong>
                                <small>USD 기준</small>
                            </article>
                            <article>
                                <span>세전 배당률</span>
                                <strong>{{ formatMetricPercent(data.exDividendYield) }}</strong>
                                <small>1회 배당 기준</small>
                            </article>
                        </section>
                    </main>

                    <p v-else class="distribution-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>

                    <section v-if="data.showChart && recentDividendEvents.length > 0" class="monthly-history">
                        <div class="history-heading">
                            <span>최근 3회차 배당금 추이</span>
                            <small><i aria-hidden="true" /> 과거 <i class="latest" aria-hidden="true" /> 이번회차</small>
                        </div>
                        <div class="monthly-cards">
                            <article v-for="(item, index) in recentDividendEvents" :key="item.date" class="monthly-card" :class="{ latest: index === recentDividendEvents.length - 1 }">
                                <div>
                                    <span class="chart-month">{{ formatDate(item.date) }}</span>
                                    <em v-if="index === recentDividendEvents.length - 1">최신</em>
                                </div>
                                <strong class="chart-total">{{ formatAmount(item.amount) }}</strong>
                            </article>
                        </div>
                    </section>
                    <footer class="thumbnail-footer">주당 USD 기준 · 세후 금액은 15% 원천징수 단순 가정</footer>
                </div>
            </section>
        </div>
    </div>
</template>
