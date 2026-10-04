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
        <section class="comparison-thumbnail" :class="`is-${changeTone}`" data-thumbnail-kind="comparison">
            <header>
                <div><strong>{{ data.symbol }}</strong><span>DIVIDEND COMPARISON</span></div>
                <time><small>배당락일</small>{{ formatDate(data.exDate) }}</time>
            </header>

            <div v-if="data.hasDividend" class="comparison-content">
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
            </div>

            <p v-else class="comparison-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>

            <footer>주당 USD 기준 · 세후 금액은 15% 원천징수 단순 가정</footer>
        </section>
    </div>
</template>

<style scoped>
.comparison-thumbnail-wrapper { width: 100%; aspect-ratio: 1 / 1; container-type: inline-size; }
.comparison-thumbnail {
    --theme-primary: #155eef;
    --theme-highlight: #eaf2ff;
    --theme-change: #eff6ff;
    display: grid;
    grid-template-rows: auto 1fr auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    padding: 0;
    box-sizing: border-box;
    background: #f8fafc;
    color: #0f2747;
    font-family: Inter, Pretendard, system-ui, sans-serif;
    overflow: hidden;
}
.comparison-thumbnail.is-up { --theme-primary: #059669; --theme-highlight: #ecfdf5; --theme-change: #ecfdf5; }
.comparison-thumbnail.is-down { --theme-primary: #c62828; --theme-highlight: #fff1f2; --theme-change: #fff1f2; }
header { display: flex; justify-content: space-between; align-items: flex-start; padding: 40px 44px 30px; background: var(--theme-primary); color: #fff; }
header div { display: flex; flex-direction: column; gap: 10px; }
header span { color: #dbeafe; font-size: 14px; font-weight: 700; letter-spacing: 0.16em; }
header strong { font-size: 64px; font-weight: 850; letter-spacing: -0.08em; line-height: .85; }
header time { display: flex; flex-direction: column; gap: 6px; padding-left: 28px; border-left: 1px solid rgba(255,255,255,.35); color: #fff; font-size: 22px; font-weight: 800; text-align: right; }
header time small { color: #dbeafe; font-size: 12px; font-weight: 600; }
.comparison-content { margin: 18px 26px 0; padding: 12px 16px 0; border: 1px solid #dbe4f0; border-radius: 12px; background: #fff; }
.comparison-headings,
.comparison-table > div { display: grid; grid-template-columns: 1.05fr 1fr 1fr; column-gap: 12px; }
.comparison-headings { padding: 0 12px 10px; color: #64748b; font-size: 12px; font-weight: 700; }
.comparison-headings span:not(:first-child) { text-align: right; }
.comparison-table { margin: 0; border-top: 1px solid #dbe4f0; }
.comparison-table > div { align-items: center; min-height: 52px; padding: 0 12px; border-bottom: 1px solid #dbe4f0; }
dt { color: #334155; font-size: 14px; font-weight: 650; }
dd { margin: 0; text-align: right; font-size: 18px; font-weight: 700; letter-spacing: -0.03em; }
dd:last-child { color: var(--theme-primary); }
.comparison-table .emphasis { background: var(--theme-highlight); box-shadow: inset 3px 0 var(--theme-primary); }
.comparison-table .emphasis dd { color: #0f2747; font-size: 20px; }
.comparison-change { margin: 12px 0; padding: 12px; border-radius: 8px; background: var(--theme-change); color: #334155; font-size: 13px; font-weight: 600; }
.comparison-change strong { float: right; font-size: 20px; }
.comparison-change.is-up strong, .comparison-change.is-down strong { color: var(--theme-primary); }
.comparison-change.is-neutral strong { color: #e2e8f0; }
.comparison-unavailable { margin: auto 0; text-align: center; color: #64748b; }
footer { padding: 12px; color: #64748b; font-size: 10px; text-align: center; }

@media (max-width: 520px) {
    header { padding: 22px 20px 16px; }
    header div { gap: 5px; }
    header span { font-size: 8px; }
    header strong { font-size: 38px; }
    header time { gap: 3px; padding-left: 14px; font-size: 13px; }
    header time small { font-size: 7px; }
    .comparison-content { margin: 10px 12px 0; padding: 8px 8px 0; }
    .comparison-headings { padding: 0 6px 5px; font-size: 8px; }
    .comparison-table > div { min-height: 33px; padding: 0 6px; }
    dt { font-size: 9px; }
    dd { font-size: 10px; }
    .comparison-table .emphasis dd { font-size: 11px; }
    .comparison-change { display: none; }
    footer { font-size: 8px; }
}
</style>
