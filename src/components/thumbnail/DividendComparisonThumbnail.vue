<script setup>
import { computed } from 'vue';

const props = defineProps({
    data: {
        type: Object,
        required: true,
    },
});

const formatUsd = (value, digits = 4) =>
    value == null ? '데이터 없음' : `$${Number(value).toFixed(digits)}`;
const formatPercent = (value) =>
    value == null ? '데이터 없음' : `${Number(value).toFixed(2)}%`;
const formatDate = (value) => (value ? value.replaceAll('-', '.') : '데이터 없음');

const rows = computed(() => [
    { label: '배당락일', before: formatDate(props.data.previousExDate), current: formatDate(props.data.exDate) },
    { label: '배당락일 종가', before: formatUsd(props.data.previousExDividendClose, 2), current: formatUsd(props.data.exDividendClose, 2) },
    { label: '세전 배당금', before: formatUsd(props.data.previousDividendAmount), current: formatUsd(props.data.currentDividendAmount), emphasis: true },
    { label: '세후 배당금', before: formatUsd(props.data.previousAfterTaxDividendAmount), current: formatUsd(props.data.afterTaxDividendAmount) },
    { label: '세전 배당률', before: formatPercent(props.data.previousExDividendYield), current: formatPercent(props.data.exDividendYield) },
    { label: '세후 배당률', before: formatPercent(props.data.previousAfterTaxDividendYield), current: formatPercent(props.data.afterTaxDividendYield) },
]);

const changeText = computed(() => {
    if (props.data.previousDividendAmount == null || props.data.previousDividendAmount <= 0) {
        return '직전 배당 데이터 없음';
    }

    const difference = props.data.dividendDifference ?? 0;
    const percent = props.data.dividendChangePercent ?? 0;
    const sign = difference > 0 ? '+' : '';
    return `${sign}$${difference.toFixed(4)} · ${sign}${percent.toFixed(2)}%`;
});

const changeTone = computed(() => {
    if (!props.data.previousDividendAmount || !props.data.dividendDifference) return 'neutral';
    return props.data.dividendDifference > 0 ? 'up' : 'down';
});
</script>

<template>
    <div class="comparison-thumbnail-wrapper">
        <section class="comparison-thumbnail" data-thumbnail-kind="comparison">
            <header>
                <span>DIVIDEND COMPARISON</span>
                <strong>{{ data.symbol }}</strong>
            </header>

            <template v-if="data.hasDividend">
                <div class="comparison-headings">
                    <span>항목</span>
                    <span>직전</span>
                    <span>이번</span>
                </div>

                <dl class="comparison-table">
                    <div v-for="row in rows" :key="row.label" :class="{ emphasis: row.emphasis }">
                        <dt>{{ row.label }}</dt>
                        <dd>{{ row.before }}</dd>
                        <dd>{{ row.current }}</dd>
                    </div>
                </dl>

                <p class="comparison-change" :class="`is-${changeTone}`">
                    세전 배당금 변화 <strong>{{ changeText }}</strong>
                </p>
            </template>

            <p v-else class="comparison-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>

            <footer>주당 USD 기준 · 세후 금액은 15% 원천징수 단순 가정</footer>
        </section>
    </div>
</template>

<style scoped>
.comparison-thumbnail-wrapper { width: 100%; aspect-ratio: 1 / 1; container-type: inline-size; }
.comparison-thumbnail {
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    padding: 32px;
    box-sizing: border-box;
    background: #071827;
    color: #f8fafc;
    font-family: Inter, Pretendard, system-ui, sans-serif;
    overflow: hidden;
}
header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px; }
header span { color: #93c5fd; font-size: 15px; font-weight: 700; letter-spacing: 0.12em; }
header strong { font-size: 56px; font-weight: 800; letter-spacing: -0.06em; line-height: 1; }
.comparison-headings,
.comparison-table > div { display: grid; grid-template-columns: 1.05fr 1fr 1fr; column-gap: 12px; }
.comparison-headings { padding: 0 18px 14px; color: #94a3b8; font-size: 13px; font-weight: 700; }
.comparison-headings span:not(:first-child) { text-align: right; }
.comparison-table { margin: 0; border-top: 1px solid #334155; }
.comparison-table > div { align-items: center; min-height: 58px; padding: 0 18px; border-bottom: 1px solid #334155; }
dt { color: #cbd5e1; font-size: 15px; font-weight: 600; }
dd { margin: 0; text-align: right; font-size: 18px; font-weight: 700; letter-spacing: -0.03em; }
dd:last-child { color: #bfdbfe; }
.comparison-table .emphasis { background: #12354b; box-shadow: inset 3px 0 #3b82f6; }
.comparison-table .emphasis dd { color: #ffffff; font-size: 22px; }
.comparison-change { margin: auto 0 12px; padding: 14px; border-radius: 12px; background: #102d42; color: #cbd5e1; font-size: 14px; font-weight: 600; }
.comparison-change strong { float: right; font-size: 20px; }
.comparison-change.is-up strong { color: #86efac; }
.comparison-change.is-down strong { color: #fca5a5; }
.comparison-change.is-neutral strong { color: #e2e8f0; }
.comparison-unavailable { margin: auto 0; text-align: center; color: #cbd5e1; }
footer { color: #94a3b8; font-size: 11px; text-align: center; }

@media (max-width: 520px) {
    .comparison-thumbnail { padding: 18px; }
    header { margin-bottom: 12px; }
    header span { font-size: 10px; }
    header strong { font-size: 38px; }
    .comparison-headings { padding: 0 6px 5px; font-size: 8px; }
    .comparison-table > div { min-height: 33px; padding: 0 6px; }
    dt { font-size: 9px; }
    dd { font-size: 10px; }
    .comparison-table .emphasis dd { font-size: 11px; }
    .comparison-change { display: none; }
    footer { font-size: 8px; }
}
</style>
