<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { runRefresh, type RefreshInput, type RefreshStatus } from '@/services/contentRefresh';

type Provider = { slug: string; displayName: string; eventCount: number; catalogTickerCount: number; collectedTickerCount: number };
type ProviderFund = { provider_slug: string; ticker: string; official_url: string | null; source_type: string; coverage_status: 'collected' | 'catalog_only' };
type DistributionIndex = { tickers?: Array<{ ticker: string; providerSlug?: string }> };
type Dashboard = {
    providers?: Array<{
        slug: string;
        display_name: string;
        enabled: number;
        event_count: number;
        catalog_ticker_count?: number;
        collected_ticker_count?: number;
    }>;
    providerFunds?: ProviderFund[];
};

const providers = ref<Provider[]>([]);
const knownTickers = ref(new Set<string>());
const providerFunds = ref<ProviderFund[]>([]);
const provider = ref('');
const ticker = ref('');
const exDate = ref(new Date().toISOString().slice(0, 10));
const isRunning = ref(false);
const status = ref<RefreshStatus | null>(null);
const message = ref('');
const error = ref('');

const tickerNormalized = computed(() => ticker.value.trim().toUpperCase());
const tickerIsKnown = computed(() => knownTickers.value.has(tickerNormalized.value));
const coverageGaps = computed(() => providerFunds.value.filter((item) => item.coverage_status === 'catalog_only'));

async function loadIndex() {
    const [indexResponse, dashboardResponse] = await Promise.all([
        fetch('/content-studio/distribution-index.json', { cache: 'no-store' }),
        fetch('/content-studio/dashboard.json', { cache: 'no-store' }),
    ]);
    if (!indexResponse.ok) throw new Error(`배당 색인을 읽지 못했습니다 (${indexResponse.status})`);
    if (!dashboardResponse.ok) throw new Error(`공급자 원장을 읽지 못했습니다 (${dashboardResponse.status})`);

    const index = (await indexResponse.json()) as DistributionIndex;
    const dashboard = (await dashboardResponse.json()) as Dashboard;
    const indexedTickerCounts = new Map<string, number>();
    for (const item of index.tickers || []) {
        if (item.providerSlug) {
            indexedTickerCounts.set(item.providerSlug, (indexedTickerCounts.get(item.providerSlug) || 0) + 1);
        }
    }
    providers.value = (dashboard.providers || [])
        .filter((item) => item.enabled === 1)
        .map((item) => ({
            slug: item.slug,
            displayName: item.display_name,
            eventCount: item.event_count,
            catalogTickerCount: item.catalog_ticker_count || indexedTickerCounts.get(item.slug) || 0,
            collectedTickerCount: item.collected_ticker_count || indexedTickerCounts.get(item.slug) || 0,
        }));
    providerFunds.value = dashboard.providerFunds || [];
    knownTickers.value = new Set((index.tickers || []).map((row) => row.ticker.toUpperCase()));
    provider.value ||= providers.value[0]?.slug || '';
}

async function execute(input: RefreshInput, label: string) {
    if (!window.confirm(`${label} 수집을 시작할까요? 공식 사이트에 실제 요청이 전송됩니다.`)) return;
    isRunning.value = true;
    status.value = null;
    message.value = `${label} 요청을 준비하고 있습니다.`;
    error.value = '';
    try {
        status.value = await runRefresh(input, (next) => {
            status.value = next;
            message.value = `${label}: ${next.status}`;
        });
        message.value = `${label} 수집이 완료됐습니다. 새 스냅샷 반영 후 상태를 확인하세요.`;
    } catch (reason) {
        error.value = reason instanceof Error ? reason.message : `${label} 수집에 실패했습니다.`;
    } finally {
        isRunning.value = false;
    }
}

onMounted(() => loadIndex().catch((reason) => {
    error.value = reason instanceof Error ? reason.message : '배당 색인을 불러오지 못했습니다.';
}));
</script>

<template>
    <section class="collection-view">
        <header>
            <p>CONTROLLED OFFICIAL COLLECTION</p>
            <h1>공식 데이터 수집</h1>
            <span>각 작업은 한 번에 하나만 실행되며 동일 대상은 10분 동안 다시 실행할 수 없습니다.</span>
        </header>

        <p v-if="message" class="notice">{{ message }}</p>
        <p v-if="error" class="notice error">{{ error }}</p>

        <div class="control-grid">
            <article>
                <h2>전체</h2>
                <p>등록된 모든 운용사의 공식 소스를 순차 수집합니다.</p>
                <Button label="전체 수집" :loading="isRunning" @click="execute({ scope: 'all' }, '전체')" />
            </article>

            <article>
                <h2>운용사별</h2>
                <p>선택한 운용사의 전체 공식 종목을 확인합니다.</p>
                <select v-model="provider" aria-label="운용사 선택">
                    <option v-for="item in providers" :key="item.slug" :value="item.slug">
                        {{ item.displayName }} · 공식 종목 {{ item.catalogTickerCount }} / 수집 {{ item.collectedTickerCount }}
                    </option>
                </select>
                <Button label="운용사 수집" :disabled="!provider" :loading="isRunning"
                    @click="execute({ scope: 'provider', provider }, `운용사 ${provider}`)" />
            </article>

            <article>
                <h2>배당락일별</h2>
                <p>해당 날짜를 포함할 수 있는 공식 이력과 거래소 공지만 제한적으로 조회합니다.</p>
                <input v-model="exDate" type="date" aria-label="배당락일" />
                <Button label="배당락일 수집" :disabled="!exDate" :loading="isRunning"
                    @click="execute({ scope: 'ex_date', exDate }, `배당락일 ${exDate}`)" />
            </article>

            <article>
                <h2>특정 ETF</h2>
                <p>공식 원장에 등록된 ETF 한 종목의 공식 URL만 갱신합니다.</p>
                <InputText v-model="ticker" placeholder="예: SCHD" aria-label="ETF 티커" />
                <small v-if="ticker && !tickerIsKnown">공식 원장에 등록된 티커만 실행할 수 있습니다.</small>
                <Button label="ETF 수집" :disabled="!tickerIsKnown" :loading="isRunning"
                    @click="execute({ scope: 'ticker', ticker: tickerNormalized }, `ETF ${tickerNormalized}`)" />
            </article>
        </div>

        <section class="coverage">
            <div>
                <p>OFFICIAL CATALOG COVERAGE</p>
                <h2>공식 목록에는 있지만 배당 원장에는 없는 종목</h2>
                <span>후보는 자동으로 검증 데이터가 되지 않습니다. 공식 배당 행을 실제 파싱한 뒤에만 수집 완료로 바뀝니다.</span>
            </div>
            <div v-if="coverageGaps.length" class="gap-list">
                <a v-for="fund in coverageGaps" :key="`${fund.provider_slug}:${fund.ticker}`"
                    :href="fund.official_url || undefined" target="_blank" rel="noreferrer">
                    <strong>{{ fund.ticker }}</strong><span>{{ fund.provider_slug }} · {{ fund.source_type }}</span>
                </a>
            </div>
            <p v-else class="notice">다음 수집부터 공식 카탈로그 커버리지가 누적됩니다.</p>
        </section>

        <aside>
            <strong>차단 안전장치</strong>
            <span>403·429·CAPTCHA가 감지되면 우회하지 않고 작업을 중단해 공급자 상태에 원인을 기록합니다.</span>
        </aside>
    </section>
</template>

<style scoped>
.collection-view{display:grid;gap:1.25rem}.collection-view>header p,.coverage>div>p{margin:0 0 .4rem;color:var(--studio-accent);font-size:.75rem;font-weight:800;letter-spacing:.1em}h1{margin:.2rem 0 .5rem;font-size:clamp(2rem,5vw,3.5rem)}header span,article p,small,aside span,.coverage>div>span,.gap-list span{color:var(--studio-muted)}.control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.control-grid article{display:grid;align-content:start;gap:.8rem;padding:1.25rem;border:1px solid var(--studio-border);border-radius:1rem;background:var(--studio-surface)}h2,p{margin:0}select,input{width:100%;min-height:2.65rem;padding:.65rem;border:1px solid var(--studio-border);border-radius:.5rem;background:var(--studio-surface-subtle);color:inherit}.notice,aside,.coverage{padding:1rem;border:1px solid var(--studio-border);border-radius:.75rem;background:var(--studio-surface)}.notice.error{color:var(--studio-danger)}aside{display:flex;gap:.75rem;flex-wrap:wrap}.coverage{display:grid;gap:1rem}.gap-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(12rem,1fr));gap:.5rem}.gap-list a{display:grid;gap:.2rem;padding:.7rem;border:1px solid var(--studio-border);border-radius:.5rem;color:inherit;text-decoration:none}.gap-list a:hover{border-color:var(--studio-accent)}@media(max-width:720px){.control-grid{grid-template-columns:1fr}}
</style>
