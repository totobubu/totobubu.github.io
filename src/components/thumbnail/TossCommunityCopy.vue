<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
    data: {
        type: Object,
        required: true,
    },
});

const copied = ref(false);

const formatUsd = (value, digits = 4) => `$${Number(value).toFixed(digits)}`;
const formatPercent = (value) => `${Number(value).toFixed(2)}%`;

const changeSummary = computed(() => {
    const { previousDividendAmount, dividendDifference, dividendChangePercent } =
        props.data;

    if (previousDividendAmount == null || previousDividendAmount <= 0) {
        return '직전 배당 데이터가 부족하여 증감률 비교는 제공하지 않습니다.';
    }

    if (dividendDifference === 0) {
        return '직전 배당 이벤트와 비교해 주당 배당금에 변동이 없습니다.';
    }

    const direction = dividendDifference > 0 ? '증가' : '감소';
    return `직전 배당 이벤트와 비교해 주당 ${formatUsd(Math.abs(dividendDifference))} ${direction}했습니다 (${dividendDifference > 0 ? '+' : ''}${formatPercent(dividendChangePercent)}).`;
});

const postText = computed(() => {
    if (!props.data.hasDividend) {
        return `${props.data.symbol} 최근 배당 정보\n\n최근 배당 데이터를 찾지 못했습니다.`;
    }

    const lines = [
        `📢 ${props.data.symbol} 최근 배당 공시 안내`,
        '',
        `${props.data.symbol}의 최근 배당 정보입니다.`,
        '',
        `• 배당락일: ${props.data.exDate}`,
        `• 배당락일 종가: ${props.data.exDividendClose == null ? '데이터 없음' : formatUsd(props.data.exDividendClose, 2)}`,
        `• 세전 배당금: ${formatUsd(props.data.currentDividendAmount)}`,
        `• 세후 배당금(15% 원천징수 가정): ${formatUsd(props.data.afterTaxDividendAmount)}`,
    ];

    if (props.data.exDividendYield != null) {
        lines.push(`• 주가 대비 세전 배당률: ${formatPercent(props.data.exDividendYield)}`);
        lines.push(`• 주가 대비 세후 배당률: ${formatPercent(props.data.afterTaxDividendYield)}`);
    }

    lines.push('', changeSummary.value, '');
    lines.push('배당금은 시장 상황, 운용 전략 및 운용사의 향후 공시에 따라 달라질 수 있습니다.');
    lines.push('실제 수령액은 보유 수량, 매수 시점, 세금 등에 따라 개인별로 차이가 발생할 수 있습니다.');
    lines.push('', '* 위 내용은 가장 최근 배당 데이터 기준의 주당 USD 금액입니다.');
    lines.push('* 주가 대비 배당률은 연환산 수익률이 아닌 해당 1회 배당금의 배당락일 종가 대비 비율입니다.');
    lines.push('* 투자 판단은 본인의 확인과 책임하에 진행해 주세요.');

    return lines.join('\n');
});

const copyPostText = async () => {
    if (!props.data.hasDividend || !navigator.clipboard) return;

    try {
        await navigator.clipboard.writeText(postText.value);
        copied.value = true;
        window.setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch (error) {
        console.error('Failed to copy Toss community text:', error);
    }
};
</script>

<template>
    <aside class="toss-community-copy" :aria-label="`${data.symbol} 토스 게시 문구`">
        <p class="copy-eyebrow">TOSS COMMUNITY</p>
        <h2>{{ data.symbol }} 최근 배당 공시 안내</h2>

        <template v-if="data.hasDividend">
            <dl class="copy-facts">
                <div><dt>배당락일</dt><dd>{{ data.exDate }}</dd></div>
                <div><dt>배당락일 종가</dt><dd>{{ data.exDividendClose == null ? '데이터 없음' : `$${Number(data.exDividendClose).toFixed(2)}` }}</dd></div>
                <div><dt>세전 배당금</dt><dd>${{ Number(data.currentDividendAmount).toFixed(4) }}</dd></div>
                <div><dt>세후 배당금</dt><dd>${{ Number(data.afterTaxDividendAmount).toFixed(4) }}</dd></div>
                <div v-if="data.exDividendYield != null"><dt>주가 대비 세전 배당률</dt><dd>{{ Number(data.exDividendYield).toFixed(2) }}%</dd></div>
                <div v-if="data.afterTaxDividendYield != null"><dt>주가 대비 세후 배당률</dt><dd>{{ Number(data.afterTaxDividendYield).toFixed(2) }}%</dd></div>
            </dl>

            <p class="copy-summary">{{ changeSummary }}</p>
            <button type="button" class="copy-button" @click="copyPostText">
                <i class="pi" :class="copied ? 'pi-check' : 'pi-copy'" aria-hidden="true" />
                {{ copied ? '복사 완료' : '토스 게시 문구 복사' }}
            </button>
        </template>

        <p v-else class="copy-unavailable">최근 배당 데이터를 찾지 못했습니다.</p>
    </aside>
</template>
