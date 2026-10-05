<script setup>
import { computed } from 'vue';

const props = defineProps({ data: { type: Object, required: true } });
const history = computed(() => (props.data.recentDividendEvents ?? []).slice(-3));
const hasComparison = computed(() => Number(props.data.previousDividendAmount) > 0);
const difference = computed(() => Number(props.data.dividendDifference ?? 0));
const tone = computed(() => !hasComparison.value || difference.value === 0 ? 'neutral' : difference.value > 0 ? 'up' : 'down');
const formatAmount = (value) => value != null && Number.isFinite(Number(value))
    ? `$${Number(value).toFixed(6).replace(/\.?(0+)$/, '')}`
    : '데이터 없음';
const formatPercent = (value) => value != null && Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : '데이터 없음';
const formatDate = (value) => value ? value.replaceAll('-', '.') : '데이터 없음';
const signedAmount = computed(() => `${difference.value > 0 ? '+' : difference.value < 0 ? '-' : ''}$${Math.abs(difference.value).toFixed(6).replace(/\.?(0+)$/, '')}`);
const signedPercent = computed(() => {
    if (!hasComparison.value) return null;
    const value = Number(props.data.dividendChangePercent ?? 0);
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
});
</script>

<template>
    <section class="thumbnail-artboard thumbnail-summary" :class="`is-${tone}`" data-thumbnail-kind="summary">
        <header class="artwork-header">
            <div class="artwork-ticker"><h1>{{ data.symbol }}</h1><span v-if="data.metaLabel">{{ data.metaLabel }}</span></div>
            <div class="artwork-ex-date"><small>배당락일</small><time>{{ formatDate(data.exDate) }}</time></div>
        </header>
        <template v-if="data.hasDividend">
            <section class="summary-hero">
                <span>주당 지급 배당금 (세전)</span><strong>{{ formatAmount(data.currentDividendAmount) }}</strong>
                <p v-if="signedPercent" class="variance-pill"><b>{{ tone === 'up' ? '▲' : tone === 'down' ? '▼' : '─' }}</b>{{ signedPercent }} <small>({{ signedAmount }})</small></p>
                <p v-else class="variance-pill is-missing">직전 배당 데이터 없음</p>
            </section>
            <section class="summary-metrics" aria-label="핵심 배당 지표">
                <article><span>예상 세후 실수령</span><strong>{{ formatAmount(data.afterTaxDividendAmount) }}</strong><small>15% 원천징수</small></article>
                <article><span>{{ data.priceStatus === 'provisional' ? '참조 종가' : '배당락일 종가' }}</span><strong>{{ formatAmount(data.exDividendClose) }}</strong><small>{{ data.priceStatus === 'provisional' ? `잠정 · ${formatDate(data.priceReferenceDate)}` : 'USD 기준' }}</small></article>
                <article><span>세전 배당률</span><strong>{{ formatPercent(data.exDividendYield) }}</strong><small>1회 배당 기준</small></article>
            </section>
        </template>
        <p v-else class="artwork-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>
        <section v-if="history.length" class="summary-history">
            <div class="history-heading"><span>최근 3회차 배당금 추이</span><small><i /> 과거 <i class="latest" /> 이번회차</small></div>
            <div class="history-cards"><article v-for="(item, index) in history" :key="item.date" :class="{ latest: index === history.length - 1 }"><div><time>{{ formatDate(item.date) }}</time><em v-if="index === history.length - 1">최신</em></div><strong>{{ formatAmount(item.amount) }}</strong></article></div>
        </section>
        <footer>주당 USD 기준 · 세후 금액은 15% 원천징수 단순 가정<span v-if="data.priceStatus === 'provisional'"> · 장 마감 전 잠정치</span></footer>
    </section>
</template>
