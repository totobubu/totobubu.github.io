<script setup>
const props = defineProps({ data: { type: Object, default: null } });
const formatPercent = (value) => Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : '—';
const formatUsd = (value) => Number.isFinite(value) ? `$${value.toFixed(0)}` : '—';
const formatDate = (value) => value?.replaceAll('-', '.');
const hasCrown = (symbol, metric) => props.data?.crowns?.[metric]?.has(symbol);
</script>

<template>
    <section class="thumbnail-artboard thumbnail-rival" data-thumbnail-kind="rival">
        <header class="artwork-header">
            <div class="artwork-ticker"><h1>RIVAL</h1><span>{{ data?.underlying ?? '승인 세트 없음' }}</span></div>
            <div class="rival-notional">$10K 동일 매수</div>
        </header>
        <template v-if="data?.comparison">
            <p class="rival-period">{{ formatDate(data.comparison.startDate) }} — {{ formatDate(data.comparison.endDate) }}<span v-if="!data.comparison.usesFullYear"> · 공통 이력</span></p>
            <section class="rival-table" aria-label="라이벌 ETF 성과 비교">
                <div class="rival-row rival-head"><span>ETF</span><span>주가</span><span>누적 배당</span><span>TR</span></div>
                <div v-for="item in data.comparison.metrics" :key="item.symbol" class="rival-row">
                    <strong>{{ item.symbol }}</strong>
                    <span :class="{ crowned: hasCrown(item.symbol, 'priceReturn') }">{{ hasCrown(item.symbol, 'priceReturn') ? '♛ ' : '' }}{{ formatPercent(item.priceReturn) }}</span>
                    <span :class="{ crowned: hasCrown(item.symbol, 'cumulativeDividends') }">{{ hasCrown(item.symbol, 'cumulativeDividends') ? '♛ ' : '' }}{{ formatUsd(item.cumulativeDividends) }}</span>
                    <span :class="{ crowned: hasCrown(item.symbol, 'totalReturn') }">{{ hasCrown(item.symbol, 'totalReturn') ? '♛ ' : '' }}{{ formatPercent(item.totalReturn) }}</span>
                </div>
            </section>
            <section class="rival-continuity">
                <span>배당지급 연속성</span>
                <div v-for="item in data.comparison.metrics" :key="item.symbol"><b>{{ item.symbol }}</b><i><em :style="{ width: `${(item.continuityRate ?? 0) * 100}%` }" /></i><strong>{{ item.continuityRate == null ? '—' : `${Math.round(item.continuityRate * 100)}%` }}</strong></div>
            </section>
        </template>
        <p v-else class="artwork-unavailable">승인된 라이벌 세트 또는 공통 가격 이력이 없습니다.</p>
        <footer>세전 · 수수료/세금 제외 · TR은 배당락일 종가 소수점 재투자</footer>
    </section>
</template>
