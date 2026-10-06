<script setup>
import { computed } from 'vue';

const props = defineProps({ data: { type: Object, required: true } });
const hasPrevious = computed(() => Number(props.data.previousDividendAmount) > 0);
const difference = computed(() => Number(props.data.dividendDifference ?? 0));
const tone = computed(() => !hasPrevious.value || difference.value === 0 ? 'neutral' : difference.value > 0 ? 'up' : 'down');
const formatDividend = (value) => value != null && Number.isFinite(Number(value))
    ? `$${Number(value).toFixed(6).replace(/\.?(0+)$/, '')}`
    : '데이터 없음';
const formatUsd = (value, digits = 2) => value != null && Number.isFinite(Number(value)) ? `$${Number(value).toFixed(digits)}` : '데이터 없음';
const formatPercent = (value) => value != null && Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)}%` : '데이터 없음';
const formatDate = (value) => value ? value.replaceAll('-', '.') : '데이터 없음';
const signed = (value, suffix = '') => `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}${suffix}`;
const changePercent = computed(() => hasPrevious.value ? signed(props.data.dividendChangePercent, '%') : '데이터 없음');
const changeAmount = computed(() => hasPrevious.value ? `${difference.value > 0 ? '+' : difference.value < 0 ? '-' : ''}$${Math.abs(difference.value).toFixed(6).replace(/\.?(0+)$/, '')}` : '데이터 없음');
const label = computed(() => tone.value === 'up' ? '세전 배당금 인상' : tone.value === 'down' ? '세전 배당금 인하' : '세전 배당금 변동 없음');
const rateLabel = computed(() => tone.value === 'up' ? '세전 배당금 인상률' : tone.value === 'down' ? '세전 배당금 인하율' : '세전 배당금 변동률');
const amountLabel = computed(() => tone.value === 'up' ? '주당 배당 인상액' : tone.value === 'down' ? '주당 배당 인하액' : '주당 배당 변동액');
const yieldDelta = (previous, current) => previous != null && current != null ? `(${signed(Number(current) - Number(previous), '%p')})` : '';
const rows = computed(() => [
    { label: '배당락일', before: formatDate(props.data.previousExDate), current: formatDate(props.data.exDate) },
    { label: props.data.priceStatus === 'provisional' ? '참조 종가 (잠정)' : '배당락일 종가', before: formatUsd(props.data.previousExDividendClose, 2), current: formatUsd(props.data.exDividendClose, 2) },
    { label: '세전 배당금', before: formatDividend(props.data.previousDividendAmount), current: formatDividend(props.data.currentDividendAmount), key: true },
    { label: '예상 세후 배당금', before: formatDividend(props.data.previousAfterTaxDividendAmount), current: formatDividend(props.data.afterTaxDividendAmount) },
    { label: '세전 배당률', before: formatPercent(props.data.previousExDividendYield), current: formatPercent(props.data.exDividendYield), delta: yieldDelta(props.data.previousExDividendYield, props.data.exDividendYield) },
    { label: '세후 배당률', before: formatPercent(props.data.previousAfterTaxDividendYield), current: formatPercent(props.data.afterTaxDividendYield), delta: yieldDelta(props.data.previousAfterTaxDividendYield, props.data.afterTaxDividendYield) },
]);
</script>

<template>
    <section class="thumbnail-artboard thumbnail-comparison" :class="`is-${tone}`" data-thumbnail-kind="comparison">
        <header class="artwork-header">
            <div class="artwork-ticker"><h1>{{ data.symbol }}</h1><span v-if="data.metaLabel">{{ data.metaLabel }}</span></div>
            <div class="artwork-ex-date"><small>배당락일</small><time>{{ formatDate(data.exDate) }}</time></div>
        </header>
        <template v-if="data.hasDividend">
            <section class="comparison-kpis"><article class="primary"><span>{{ rateLabel }}</span><strong>{{ changePercent }}</strong><b>{{ tone === 'up' ? '↗' : tone === 'down' ? '↘' : '→' }}</b></article><article><span>{{ amountLabel }}</span><strong>{{ changeAmount }}</strong><b>{{ tone === 'up' ? '↑' : tone === 'down' ? '↓' : '→' }}</b></article></section>
            <section class="comparison-table" aria-label="배당 비교표"><div class="comparison-columns"><span>비교 항목</span><span>직전 배당</span><span>이번 배당 <i /></span></div><dl><div v-for="row in rows" :key="row.label" :class="{ key: row.key }"><dt>{{ row.label }}<em v-if="row.key">핵심</em></dt><dd>{{ row.before }}</dd><dd>{{ row.current }} <small v-if="row.delta">{{ row.delta }}</small><b v-if="row.key">{{ label.replace('세전 배당금 ', '') }}</b></dd></div></dl></section>
        </template>
        <p v-else class="artwork-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>
        <footer><i /> 주당 USD 기준 · 세후 금액은 15% 원천징수 단순 가정<span v-if="data.priceStatus === 'provisional'"> · 전 거래일 종가 기준</span></footer>
    </section>
</template>
