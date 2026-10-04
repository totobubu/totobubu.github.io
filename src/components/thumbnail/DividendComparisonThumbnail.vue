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
    { label: '예상 세후 배당금', before: formatUsd(props.data.previousAfterTaxDividendAmount), current: formatUsd(props.data.afterTaxDividendAmount) },
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

const changeLabel = computed(() => {
    if (props.data.previousDividendAmount == null || props.data.previousDividendAmount <= 0) {
        return '직전 배당 데이터 없음';
    }
    if (changeTone.value === 'up') return '세전 배당금 인상';
    if (changeTone.value === 'down') return '세전 배당금 인하';
    return '세전 배당금 변동 없음';
});

const changeArrow = computed(() => ({ up: '↑', down: '↓', neutral: '→' })[changeTone.value]);

const changeAmount = computed(() => {
    if (props.data.previousDividendAmount == null || props.data.previousDividendAmount <= 0) return '데이터 없음';
    const difference = props.data.dividendDifference ?? 0;
    return `${difference > 0 ? '+' : ''}$${difference.toFixed(4)}`;
});

const changePercent = computed(() => {
    if (props.data.previousDividendAmount == null || props.data.previousDividendAmount <= 0) return '';
    const percent = props.data.dividendChangePercent ?? 0;
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
});
</script>

<template>
    <div class="comparison-thumbnail-wrapper">
        <section class="comparison-thumbnail" :class="`is-${changeTone}`" data-thumbnail-kind="comparison">
            <header>
                <div>
                    <div class="brand-line"><strong>{{ data.symbol }}</strong><b>ETF</b></div>
                    <span>DIVIDEND COMPARISON · 배당 비교</span>
                </div>
                <time><small>이번 배당락일</small>{{ formatDate(data.exDate) }}</time>
            </header>

            <div v-if="data.hasDividend" class="comparison-content">
                <section class="comparison-banner" :class="`is-${changeTone}`" aria-label="직전 배당 대비 변화">
                    <span class="comparison-banner-icon" aria-hidden="true">{{ changeArrow }}</span>
                    <span class="comparison-banner-copy"><small>직전 대비 배당 변화</small><strong>{{ changeLabel }}</strong></span>
                    <div class="comparison-banner-values"><b>{{ changeAmount }}</b><em v-if="changePercent">{{ changePercent }}</em></div>
                </section>
                <div class="comparison-headings">
                    <span>항목</span>
                    <span>직전</span>
                    <span>이번</span>
                </div>

                <dl class="comparison-table">
                    <div v-for="(row, index) in rows" :key="row.label" :class="{ emphasis: row.emphasis, 'is-alt': index % 2 === 1 }">
                        <dt>{{ row.label }}<small v-if="row.emphasis">핵심</small></dt>
                        <dd>{{ row.before }}</dd>
                        <dd>{{ row.current }}</dd>
                    </div>
                </dl>

                <p class="comparison-change" :class="`is-${changeTone}`">세전 배당금 증감 <strong>{{ changeText }}</strong></p>
            </div>

            <p v-else class="comparison-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>

            <footer><i aria-hidden="true" /> 주당 USD 기준 · 세후 금액은 15% 원천징수 단순 가정 <b>{{ data.symbol }} FEED</b></footer>
        </section>
    </div>
</template>

<style scoped>
.comparison-thumbnail-wrapper { display: flex; justify-content: center; width: 100%; height: auto; aspect-ratio: 1 / 1; overflow: hidden; container-type: inline-size; }
.comparison-thumbnail {
    --theme-primary: #155eef;
    --theme-highlight: #eff6ff;
    --theme-muted: #dbeafe;
    display: grid;
    grid-template-rows: auto 1fr auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    padding: 0;
    box-sizing: border-box;
    background: #fff;
    color: #0f2747;
    font-family: Inter, Pretendard, system-ui, sans-serif;
    overflow: hidden;
}
.comparison-thumbnail.is-up { --theme-primary: #059669; --theme-highlight: #ecfdf5; --theme-muted: #d1fae5; }
.comparison-thumbnail.is-down { --theme-primary: #c62828; --theme-highlight: #fff1f2; --theme-muted: #fecdd3; }
header { display: flex; justify-content: space-between; align-items: center; padding: 28px 34px 26px; background: var(--theme-primary); color: #fff; }
header > div { display: flex; flex-direction: column; gap: 6px; }
.brand-line { display: flex; align-items: center; gap: 7px; }
header strong { font-size: 45px; font-weight: 850; letter-spacing: -.07em; line-height: .85; }
.brand-line b { padding: 3px 6px; border-radius: 4px; background: rgba(255,255,255,.2); color: #fff; font-size: 11px; font-weight: 800; line-height: 1; }
header span { color: rgba(255,255,255,.78); font-size: 12px; font-weight: 750; letter-spacing: .06em; }
header time { display: flex; flex-direction: column; gap: 4px; padding-left: 24px; border-left: 1px solid rgba(255,255,255,.28); color: #fff; font-size: 21px; font-weight: 850; text-align: right; }
header time small { color: rgba(255,255,255,.78); font-size: 10px; font-weight: 650; }
.comparison-content { display: flex; flex: 1; flex-direction: column; justify-content: space-evenly; min-height: 0; margin: 0; padding: 12px 30px 8px; border: 0; border-radius: 0; background: #fff; }
.comparison-banner { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 8px 12px; border: 1px solid var(--theme-muted); border-radius: 12px; background: var(--theme-highlight); color: var(--theme-primary); box-sizing: border-box; }
.comparison-banner-icon { display: grid; place-items: center; flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%; background: var(--theme-primary); color: #fff; font-size: 18px; font-weight: 850; line-height: 1; }
.comparison-banner-copy { display: flex; flex: 1; flex-direction: column; gap: 1px; min-width: 0; }
.comparison-banner-copy small { color: #475569; font-size: 10px; font-weight: 700; }
.comparison-banner-copy strong { color: #1e293b; font-size: 13px; font-weight: 850; }
.comparison-banner-values { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.comparison-banner-values b { color: var(--theme-primary); font-size: 17px; font-weight: 850; letter-spacing: -.05em; }
.comparison-banner-values em { padding: 4px 6px; border-radius: 4px; background: var(--theme-primary); color: #fff; font-size: 11px; font-style: normal; font-weight: 850; }
.comparison-headings,
.comparison-table > div { display: grid; grid-template-columns: 1.05fr 1fr 1fr; column-gap: 12px; }
.comparison-headings { padding: 5px 12px 7px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 11px; font-weight: 750; }
.comparison-headings span:last-child { color: var(--theme-primary); }
.comparison-headings span:last-child::after { content: ''; display: inline-block; width: 5px; height: 5px; margin-left: 5px; border-radius: 50%; background: var(--theme-primary); vertical-align: middle; }
.comparison-headings span:not(:first-child) { text-align: right; }
.comparison-table { display: flex; flex-direction: column; gap: 4px; margin: 0; border: 0; }
.comparison-table > div { align-items: center; min-height: 36px; padding: 0 12px; border: 0; border-radius: 8px; }
.comparison-table > div.is-alt { background: #f8fafc; }
dt { display: flex; align-items: center; gap: 5px; color: #334155; font-size: 12px; font-weight: 650; }
dt small { padding: 2px 4px; border-radius: 3px; background: rgba(255,255,255,.25); color: inherit; font-size: 9px; font-weight: 800; line-height: 1; }
dd { margin: 0; text-align: right; color: #64748b; font-size: 13px; font-weight: 700; letter-spacing: -.03em; }
dd:last-child { color: var(--theme-primary); }
.comparison-table .emphasis { min-height: 44px; background: var(--theme-primary); }
.comparison-table .emphasis dt, .comparison-table .emphasis dd, .comparison-table .emphasis dd:last-child { color: #fff; font-weight: 800; }
.comparison-table .emphasis dd:first-of-type { color: rgba(255,255,255,.78); text-decoration: line-through; text-decoration-color: rgba(255,255,255,.45); }
.comparison-table .emphasis dd { font-size: 15px; }
.comparison-change { margin: 0; padding: 8px 12px; border: 1px dashed var(--theme-muted); border-radius: 8px; background: var(--theme-highlight); color: #334155; font-size: 12px; font-weight: 750; }
.comparison-change strong { float: right; color: var(--theme-primary); font-size: 14px; }
.comparison-change.is-up strong, .comparison-change.is-down strong { color: var(--theme-primary); }
.comparison-change.is-neutral strong { color: #334155; }
.comparison-unavailable { margin: auto 0; text-align: center; color: #64748b; }
footer { display: flex; align-items: center; gap: 6px; padding: 12px 24px; border-top: 1px solid #f1f5f9; background: #f8fafc; color: #64748b; font-size: 10px; text-align: left; }
footer i { width: 6px; height: 6px; border-radius: 50%; background: var(--theme-primary); }
footer b { margin-left: auto; color: var(--theme-primary); font-size: 9px; letter-spacing: .03em; white-space: nowrap; }

@media (max-width: 520px) {
    header { padding: 18px 20px 16px; }
    header > div { gap: 4px; }
    header span { font-size: 8px; }
    header strong { font-size: 34px; }
    .brand-line { gap: 4px; }
    .brand-line b { padding: 2px 4px; font-size: 7px; }
    header time { gap: 3px; padding-left: 14px; font-size: 13px; }
    header time small { font-size: 7px; }
    .comparison-content { padding: 8px 12px 6px; }
    .comparison-banner { gap: 5px; min-height: 31px; padding: 4px 6px; border-radius: 6px; }
    .comparison-banner-icon { flex-basis: 16px; width: 16px; height: 16px; font-size: 11px; }
    .comparison-banner-copy { gap: 0; }
    .comparison-banner-copy small { font-size: 6px; }
    .comparison-banner-copy strong { font-size: 8px; }
    .comparison-banner-values { gap: 4px; }
    .comparison-banner-values b { font-size: 9px; }
    .comparison-banner-values em { padding: 2px 3px; font-size: 7px; }
    .comparison-headings { padding: 4px 6px 5px; font-size: 8px; }
    .comparison-headings span:last-child::after { width: 3px; height: 3px; margin-left: 3px; }
    .comparison-table { gap: 2px; }
    .comparison-table > div { min-height: 29px; padding: 0 6px; border-radius: 5px; }
    dt { font-size: 9px; }
    dd { font-size: 10px; }
    dt small { padding: 1px 2px; font-size: 6px; }
    .comparison-table .emphasis { min-height: 34px; }
    .comparison-table .emphasis dd { font-size: 11px; }
    .comparison-change { display: block; margin: 0; padding: 6px; font-size: 8px; }
    .comparison-change strong { font-size: 10px; }
    footer { gap: 4px; padding: 8px 10px; font-size: 7px; }
    footer i { width: 4px; height: 4px; }
    footer b { font-size: 6px; }
}

/* The artwork is designed at the Stitch source size. Preview scaling is the
   only responsive behavior so exports and previews share one composition. */
.comparison-thumbnail {
    width: 390px;
    min-width: 390px;
    height: 390px;
    min-height: 390px;
    zoom: 1;
    transform: scale(calc(100cqw / 390px));
    transform-origin: top center;
}
header { padding: 18px 20px 16px; }
header > div { gap: 4px; }
header strong { font-size: 34px; }
header span { font-size: 8px; }
.brand-line { gap: 4px; }
.brand-line b { padding: 2px 4px; font-size: 7px; }
header time { gap: 3px; padding-left: 14px; font-size: 13px; }
header time small { font-size: 7px; }
.comparison-content { padding: 8px 12px 6px; }
.comparison-banner { gap: 5px; min-height: 31px; padding: 4px 6px; border-radius: 6px; }
.comparison-banner-icon { flex-basis: 16px; width: 16px; height: 16px; font-size: 11px; }
.comparison-banner-copy { gap: 0; }
.comparison-banner-copy small { font-size: 6px; }
.comparison-banner-copy strong { font-size: 8px; }
.comparison-banner-values { gap: 4px; }
.comparison-banner-values b { font-size: 9px; }
.comparison-banner-values em { padding: 2px 3px; font-size: 7px; }
.comparison-headings { padding: 4px 6px 5px; font-size: 8px; }
.comparison-headings span:last-child::after { width: 3px; height: 3px; margin-left: 3px; }
.comparison-table { gap: 2px; }
.comparison-table > div { min-height: 29px; padding: 0 6px; border-radius: 5px; }
dt { font-size: 9px; }
dd { font-size: 10px; }
dt small { padding: 1px 2px; font-size: 6px; }
.comparison-table .emphasis { min-height: 34px; }
.comparison-table .emphasis dd { font-size: 11px; }
.comparison-change { margin: 0; padding: 6px; font-size: 8px; }
.comparison-change strong { font-size: 10px; }
footer { gap: 4px; padding: 8px 10px; font-size: 7px; }
footer i { width: 4px; height: 4px; }
footer b { font-size: 6px; }
</style>
