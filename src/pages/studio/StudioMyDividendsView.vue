<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';
    import { useHead } from '@vueuse/head';
    import InputNumber from 'primevue/inputnumber';
    import Button from 'primevue/button';
    import {
        annualized,
        nextExpectedDate,
        type DistributionTicker,
        useDividendPortfolio,
    } from '@/composables/studio/useDividendPortfolio';
    const rows = ref<DistributionTicker[]>([]);
    const error = ref('');
    const loading = ref(true);
    const { holdings, watchlist, setHolding, removeHolding, toggleWatchlist } =
        useDividendPortfolio();
    useHead({ title: '내 배당 | DivGrow' });
    const number = (value: number) =>
        `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    const portfolio = computed(() =>
        holdings.value.map((holding) => {
            const row = rows.value.find(
                (item) => item.ticker === holding.ticker
            );
            const annual = row ? annualized(row.latest) : null;
            return {
                ...holding,
                row,
                annual: annual === null ? null : annual * holding.shares,
                next: row ? nextExpectedDate(row.latest) : null,
            };
        })
    );
    const totalAnnual = computed(() =>
        portfolio.value.reduce((sum, item) => sum + (item.annual || 0), 0)
    );
    const savedRows = computed(() =>
        rows.value.filter((row) => watchlist.value.includes(row.ticker))
    );
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
            <p class="eyebrow">LOCAL PORTFOLIO · PRE-TAX USD ESTIMATE</p>
            <h1>내 배당</h1>
            <p>
                이 기기에만 저장됩니다. 세전 USD 추정치이며, 실제
                배당금·지급일은 운용사 발표에 따라 달라질 수 있습니다.
            </p>
        </header>
        <p v-if="error" class="notice error">{{ error }}</p>
        <article class="total">
            <span>연 환산 예상 배당</span
            ><strong>{{ number(totalAnnual) }}</strong
            ><small>공식 최신 배당 × 현재 보유 수량</small>
        </article>
        <p v-if="loading" class="notice">공식 원장을 불러오는 중…</p>
        <div v-else-if="portfolio.length" class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>ETF</th>
                        <th>보유 수량</th>
                        <th>최근 배당</th>
                        <th>다음 예상 배당락일</th>
                        <th>연 환산 추정</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in portfolio" :key="item.ticker">
                        <td>
                            <strong>{{ item.ticker }}</strong
                            ><small v-if="!item.row"
                                >현재 공식 원장에 없음</small
                            >
                        </td>
                        <td>
                            <InputNumber
                                :model-value="item.shares"
                                :min="0"
                                :min-fraction-digits="0"
                                :max-fraction-digits="6"
                                @update:model-value="
                                    setHolding(item.ticker, Number($event || 0))
                                " />
                        </td>
                        <td>
                            {{
                                item.row
                                    ? `$${item.row.latest.distribution_per_share}`
                                    : '—'
                            }}
                        </td>
                        <td>{{ item.next || '이력 부족' }}</td>
                        <td>
                            {{
                                item.annual === null ? '—' : number(item.annual)
                            }}
                        </td>
                        <td>
                            <Button
                                size="small"
                                text
                                severity="danger"
                                label="삭제"
                                @click="removeHolding(item.ticker)" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p v-else-if="!loading" class="notice">
            비교 화면에서 ETF를 관심종목으로 추가한 뒤, 여기서 보유 수량을
            입력하세요.
        </p>
        <section v-if="!loading && savedRows.length" class="watch">
            <h2>관심 ETF</h2>
            <div v-for="row in savedRows" :key="row.ticker">
                <strong>{{ row.ticker }}</strong
                ><span
                    >최근 ${{ row.latest.distribution_per_share }} ·
                    {{ row.latest.frequency || '주기 미상' }}</span
                ><InputNumber
                    placeholder="보유 수량"
                    :min="0"
                    :max-fraction-digits="6"
                    @update:model-value="
                        setHolding(row.ticker, Number($event || 0))
                    " /><Button
                    size="small"
                    text
                    label="관심 해제"
                    @click="toggleWatchlist(row.ticker)" />
            </div>
        </section>
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
    .total {
        display: grid;
        gap: 0.35rem;
        padding: 1.25rem;
        border: 1px solid var(--studio-accent);
        border-radius: 1rem;
        background: var(--studio-surface);
    }
    .total strong {
        font-size: 2rem;
    }
    .total small,
    .watch span,
    td small {
        color: var(--studio-muted);
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
    .watch {
        display: grid;
        gap: 0.6rem;
    }
    .watch h2 {
        margin: 0;
    }
    .watch > div {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.8rem 1rem;
        border: 1px solid var(--studio-border);
        border-radius: 0.75rem;
        background: var(--studio-surface);
    }
    .watch span {
        flex: 1;
    }
    @media (max-width: 640px) {
        .watch > div {
            align-items: stretch;
            flex-direction: column;
        }
    }
</style>
