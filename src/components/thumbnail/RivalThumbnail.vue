<script setup>
const props = defineProps({ data: { type: Object, default: null } });
const formatPercent = (value) => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : '—';
const formatUsd = (value) => Number.isFinite(value) ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
const formatDate = (value) => value?.replaceAll('-', '.');
const hasCrown = (symbol, metric) => props.data?.crowns?.[metric]?.has(symbol);
const relativeLabel = (value) => {
    if (!Number.isFinite(value)) return '—';
    if (value > 0.000001) return 'WIN';
    if (value < -0.000001) return 'LOSE';
    return 'DRAW';
};
</script>

<template>
    <section class="thumbnail-artboard thumbnail-rival" data-thumbnail-kind="rival">
        <template v-if="data?.comparison">
            <header class="rival-header">
                <div class="rival-title"><h1>RIVAL</h1><span>{{ data.underlying }} ETF 비교</span></div>
                <p>{{ formatDate(data.comparison.startDate) }} — {{ formatDate(data.comparison.endDate) }}<small v-if="!data.comparison.usesFullYear">공통 이력</small></p>
                <div class="underlying-summary">
                    <span>기준 {{ data.underlying }}</span>
                    <b>{{ formatUsd(data.comparison.underlying.startPrice) }} → {{ formatUsd(data.comparison.underlying.endPrice) }}</b>
                    <strong>{{ formatPercent(data.comparison.underlying.priceReturn) }}</strong>
                    <em>$10K 투자 시 <b>{{ formatUsd(data.comparison.underlying.finalValue) }}</b></em>
                </div>
            </header>
            <section class="rival-table" aria-label="라이벌 ETF 성과 비교">
                <div class="rival-row rival-head"><span>구분 <small>($10K 동일)</small></span><b v-for="item in data.comparison.metrics" :key="item.symbol" :class="{ selected: item.symbol === 'TSLY' }">{{ item.symbol }}<i v-if="item.symbol === 'TSLY'">선택</i></b></div>
                <div class="rival-row rival-key"><span>10K 최종 평가</span><b v-for="item in data.comparison.metrics" :key="item.symbol" :class="{ crowned: hasCrown(item.symbol, 'totalReturn') }">{{ hasCrown(item.symbol, 'totalReturn') ? '👑 ' : '' }}{{ formatUsd(item.finalValue) }}</b></div>
                <div class="rival-row rival-tr"><span>총수익률 (TR)</span><b v-for="item in data.comparison.metrics" :key="item.symbol" :class="{ crowned: hasCrown(item.symbol, 'totalReturn') }">{{ hasCrown(item.symbol, 'totalReturn') ? '👑 ' : '' }}{{ formatPercent(item.totalReturn) }}</b></div>
                <div class="rival-row"><span>주가 수익률</span><b v-for="item in data.comparison.metrics" :key="item.symbol" :class="{ crowned: hasCrown(item.symbol, 'priceReturn') }">{{ hasCrown(item.symbol, 'priceReturn') ? '👑 ' : '' }}{{ formatPercent(item.priceReturn) }}</b></div>
                <div class="rival-row"><span>누적 배당금</span><b v-for="item in data.comparison.metrics" :key="item.symbol" :class="{ crowned: hasCrown(item.symbol, 'cumulativeDividends') }">{{ hasCrown(item.symbol, 'cumulativeDividends') ? '👑 ' : '' }}{{ formatUsd(item.cumulativeDividends) }}</b></div>
                <div class="rival-row rival-prices"><span>주가 (시작→종료)</span><b v-for="item in data.comparison.metrics" :key="item.symbol">{{ formatUsd(item.startPrice) }}→{{ formatUsd(item.endPrice) }}</b></div>
                <div class="rival-row rival-info"><span>주식정보</span><b v-for="item in data.comparison.metrics" :key="item.symbol"><small>{{ item.frequency ?? '—' }}</small><em>{{ item.actualPayments }}회 배당</em></b></div>
                <div class="rival-row rival-vs"><span>VS {{ data.underlying }}</span><b v-for="item in data.comparison.metrics" :key="item.symbol" :class="`is-${relativeLabel(item.vsUnderlying).toLowerCase()}`">{{ relativeLabel(item.vsUnderlying) }}</b></div>
            </section>
        </template>
        <p v-else class="artwork-unavailable">승인된 라이벌 세트 또는 공통 가격 이력이 없습니다.</p>
        <footer>세전 · 수수료/세금 제외 · TR은 배당락일 종가 소수점 재투자</footer>
    </section>
</template>
