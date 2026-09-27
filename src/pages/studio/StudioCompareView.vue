<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';
    import { useHead } from '@vueuse/head';
    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import {
        annualized,
        nextExpectedDate,
        type DistributionTicker,
        useDividendPortfolio,
    } from '@/composables/studio/useDividendPortfolio';
    const rows = ref<DistributionTicker[]>([]);
    const selected = ref<string[]>([]);
    const query = ref('');
    const error = ref('');
    const loading = ref(true);
    const { watchlist, toggleWatchlist } = useDividendPortfolio();
    useHead({ title: 'ETF 비교 | DivGrow' });
    const matches = computed(() =>
        rows.value
            .filter((row) =>
                row.ticker.toLowerCase().includes(query.value.toLowerCase())
            )
            .slice(0, 12)
    );
    const compared = computed(
        () =>
            selected.value
                .map((ticker) =>
                    rows.value.find((row) => row.ticker === ticker)
                )
                .filter(Boolean) as DistributionTicker[]
    );
    const money = (value: number | null) =>
        value === null || !Number.isFinite(value)
            ? '—'
            : `$${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
    const change = (row: DistributionTicker) =>
        row.latest.comparisonBasis === 'corporate_action_or_frequency_change' ||
        row.latest.previous_amount === null
            ? '—'
            : money(
                  Number(row.latest.distribution_per_share) -
                      Number(row.latest.previous_amount)
              );
    const toggleCompare = (ticker: string) => {
        selected.value = selected.value.includes(ticker)
            ? selected.value.filter((item) => item !== ticker)
            : selected.value.length < 4
              ? [...selected.value, ticker]
              : selected.value;
    };
    onMounted(async () => {
        try {
            const response = await fetch(
                '/content-studio/distribution-index.json',
                { cache: 'no-store' }
            );
            if (!response.ok)
                throw new Error(
                    `공식 원장을 읽지 못했습니다 (${response.status})`
                );
            const index = await response.json();
            rows.value = (index.tickers || []).filter(
                (row: DistributionTicker) =>
                    ['official', 'cross_checked'].includes(
                        row.latest.verification_status
                    )
            );
        } catch (e) {
            error.value =
                e instanceof Error
                    ? e.message
                    : '공식 원장을 불러오지 못했습니다.';
        } finally {
            loading.value = false;
        }
    });
</script>
<template>
    <section class="view">
        <header>
            <p class="eyebrow">OFFICIAL DISTRIBUTION COMPARISON</p>
            <h1>ETF 배당 비교</h1>
            <p>
                공식 확인된 배당 이력으로 최대 4개 미국 ETF를 비교합니다.
                예상값은 과거 지급 주기와 최신 발표를 바탕으로 한 세전 USD
                추정입니다.
            </p>
        </header>
        <p v-if="error" class="notice error">{{ error }}</p>
        <div class="picker">
            <InputText
                v-model="query"
                placeholder="티커 검색 (예: TSLY)" /><span
                >{{ selected.length }}/4 선택</span
            >
        </div>
        <div v-if="query" class="results">
            <div v-for="row in matches" :key="row.ticker">
                <strong>{{ row.ticker }}</strong
                ><small>{{ row.providerSlug }}</small>
                <div>
                    <Button
                        size="small"
                        :label="
                            selected.includes(row.ticker) ? '비교 해제' : '비교'
                        "
                        :disabled="
                            !selected.includes(row.ticker) &&
                            selected.length >= 4
                        "
                        @click="toggleCompare(row.ticker)" /><Button
                        size="small"
                        text
                        :label="
                            watchlist.includes(row.ticker)
                                ? '관심 해제'
                                : '관심'
                        "
                        @click="toggleWatchlist(row.ticker)" />
                </div>
            </div>
        </div>
        <p v-if="loading" class="notice">공식 원장을 불러오는 중…</p>
        <div v-else-if="compared.length" class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>ETF</th>
                        <th>최근 배당</th>
                        <th>직전 대비</th>
                        <th>4회 평균</th>
                        <th>12회 평균</th>
                        <th>지급 주기</th>
                        <th>다음 예상 배당락일</th>
                        <th>연 환산 추정</th>
                        <th>공식 원문</th>
                        <th>검증</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in compared" :key="row.ticker">
                        <td>
                            <strong>{{ row.ticker }}</strong
                            ><small>{{ row.providerSlug }}</small>
                        </td>
                        <td>
                            {{
                                money(Number(row.latest.distribution_per_share))
                            }}
                        </td>
                        <td>{{ change(row) }}</td>
                        <td>{{ money(row.latest.average4) }}</td>
                        <td>{{ money(row.latest.average12) }}</td>
                        <td>{{ row.latest.frequency || '—' }}</td>
                        <td>
                            {{ nextExpectedDate(row.latest) || '이력 부족' }}
                        </td>
                        <td>{{ money(annualized(row.latest)) }}</td>
                        <td>
                            <a
                                :href="row.latest.official_url"
                                target="_blank"
                                rel="noreferrer"
                                >보기</a
                            >
                        </td>
                        <td>
                            <span
                                v-if="
                                    row.latest.comparisonBasis ===
                                    'corporate_action_or_frequency_change'
                                "
                                >기업행동/주기 변경</span
                            >
                            <span v-else>{{
                                row.latest.verification_status ===
                                'cross_checked'
                                    ? '교차 검증'
                                    : '공식 확인'
                            }}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p v-else-if="!loading" class="notice">
            검색해 비교할 ETF를 선택하세요.
        </p>
    </section>
</template>
<style scoped>
    .view {
        display: grid;
        gap: 1.25rem;
    }
    h1,
    p {
        margin-top: 0;
    }
    .eyebrow {
        color: var(--studio-accent);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
    }
    .picker {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
    }
    .picker :deep(.p-inputtext) {
        width: min(28rem, 100%);
    }
    .results {
        display: grid;
        gap: 0.5rem;
    }
    .results > div {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem 1rem;
        border: 1px solid var(--studio-border);
        border-radius: 0.75rem;
        background: var(--studio-surface);
    }
    .results small,
    td small {
        display: block;
        color: var(--studio-muted);
    }
    .results > div > div {
        margin-left: auto;
        display: flex;
        gap: 0.3rem;
    }
    .table-wrap {
        overflow: auto;
        border: 1px solid var(--studio-border);
        border-radius: 1rem;
        background: var(--studio-surface);
    }
    table {
        width: 100%;
        border-collapse: collapse;
    }
    th,
    td {
        padding: 0.8rem 0.7rem;
        border-bottom: 1px solid var(--studio-border);
        text-align: left;
        white-space: nowrap;
    }
    th {
        color: var(--studio-muted);
        font-size: 0.75rem;
    }
    .notice {
        margin: 0;
        padding: 1rem;
        border-radius: 0.75rem;
        background: var(--studio-surface-subtle);
        color: var(--studio-muted);
    }
    .error {
        color: var(--studio-danger);
    }
    @media (max-width: 640px) {
        .picker {
            align-items: stretch;
            flex-direction: column;
        }
        .picker :deep(.p-inputtext) {
            width: 100%;
        }
    }
</style>
