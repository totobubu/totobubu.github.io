<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useHead } from '@vueuse/head';

type EventRow = {
    id: number;
    provider_slug: string;
    ticker: string;
    distribution_per_share: string;
    previous_amount: string | null;
    average4: number | null;
    average12: number | null;
    declared_date: string;
    ex_date: string;
    payable_date: string | null;
    official_url: string;
};
type Provider = {
    slug: string;
    displayName: string;
    eventCount: number;
    pageCount: number;
    latestExDate: string | null;
};
type Index = { providers: Provider[]; recentEvents: EventRow[] };
type Page = { page: number; events: EventRow[] };

const index = ref<Index>({ providers: [], recentEvents: [] });
const activeProvider = ref('recent');
const currentPage = ref(1);
const loadedPage = ref<Page>({ page: 1, events: [] });
const isLoading = ref(true);
const error = ref('');

useHead({ title: '배당 이력 | 콘텐츠 스튜디오' });

const activeMeta = computed(() =>
    index.value.providers.find((provider) => provider.slug === activeProvider.value)
);
const visibleEvents = computed(() =>
    activeProvider.value === 'recent'
        ? index.value.recentEvents
        : loadedPage.value.events
);

const fetchProviderPage = async (slug: string, page = 1) => {
    isLoading.value = true;
    error.value = '';
    activeProvider.value = slug;
    currentPage.value = page;
    try {
        if (slug === 'recent') {
            loadedPage.value = { page: 1, events: [] };
            return;
        }
        const response = await fetch(
            `/content-studio/distribution-${slug}-${page}.json?t=${Date.now()}`,
            { cache: 'no-store' }
        );
        if (!response.ok) throw new Error(`배당 이력을 읽지 못했습니다 (${response.status})`);
        loadedPage.value = await response.json();
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : '배당 이력을 불러오지 못했습니다.';
    } finally {
        isLoading.value = false;
    }
};

onMounted(async () => {
    try {
        const response = await fetch(`/content-studio/distribution-index.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`배당 이력 색인을 읽지 못했습니다 (${response.status})`);
        index.value = await response.json();
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : '배당 이력 색인을 불러오지 못했습니다.';
    } finally {
        isLoading.value = false;
    }
});

const decimal = (value: string | number | null) =>
    value === null || value === undefined ? '—' : `$${Number(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
</script>

<template>
    <section class="distribution-view">
        <header>
            <p class="eyebrow">OFFICIAL DISTRIBUTION LEDGER</p>
            <h1>배당 이력</h1>
            <p>초기에는 최근 발표만 표시하고, 운용사 탭을 선택하면 해당 이력 200건만 불러옵니다.</p>
        </header>

        <p v-if="error" class="notice error">{{ error }}</p>
        <div class="tabs" role="tablist" aria-label="운용사별 배당 이력">
            <button :class="{ active: activeProvider === 'recent' }" type="button" @click="fetchProviderPage('recent')">최근 발표</button>
            <button v-for="provider in index.providers" :key="provider.slug" :class="{ active: activeProvider === provider.slug }" type="button" @click="fetchProviderPage(provider.slug)">
                {{ provider.displayName }} <small>{{ provider.eventCount.toLocaleString() }}</small>
            </button>
        </div>

        <p v-if="isLoading" class="notice">불러오는 중…</p>
        <div v-else-if="visibleEvents.length" class="table-wrap">
            <table>
                <thead><tr><th>티커</th><th>배당금</th><th>직전</th><th>4회 평균</th><th>12회 평균</th><th>배당락일</th><th>공식 원문</th></tr></thead>
                <tbody>
                    <tr v-for="event in visibleEvents" :key="event.id">
                        <td><strong>{{ event.ticker }}</strong></td>
                        <td>{{ decimal(event.distribution_per_share) }}</td>
                        <td>{{ decimal(event.previous_amount) }}</td>
                        <td>{{ decimal(event.average4) }}</td>
                        <td>{{ decimal(event.average12) }}</td>
                        <td>{{ event.ex_date }}</td>
                        <td><a :href="event.official_url" target="_blank" rel="noreferrer">보기</a></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p v-else class="notice">표시할 배당 이력이 없습니다.</p>

        <nav v-if="activeMeta && activeMeta.pageCount > 1" class="pagination" aria-label="배당 이력 페이지">
            <button type="button" :disabled="currentPage <= 1" @click="fetchProviderPage(activeMeta.slug, currentPage - 1)">이전</button>
            <span>{{ currentPage }} / {{ activeMeta.pageCount }}</span>
            <button type="button" :disabled="currentPage >= activeMeta.pageCount" @click="fetchProviderPage(activeMeta.slug, currentPage + 1)">다음</button>
        </nav>
    </section>
</template>

<style scoped>
.distribution-view { display:grid; gap:1.25rem; } h1,p { margin-top:0; } h1 { margin-bottom:.5rem; font-size:clamp(2rem,5vw,3.5rem); line-height:1; } header p:last-child,.notice { color:var(--studio-muted); } .eyebrow { margin-bottom:.45rem; color:var(--studio-accent); font-size:.72rem; font-weight:800; letter-spacing:.12em; }
.tabs { display:flex; gap:.45rem; overflow-x:auto; padding-bottom:.25rem; } .tabs button,.pagination button { border:1px solid var(--studio-border); border-radius:999px; background:var(--studio-surface); color:var(--studio-muted); cursor:pointer; font:inherit; padding:.48rem .75rem; white-space:nowrap; } .tabs button.active { border-color:var(--studio-accent); color:var(--studio-accent); font-weight:800; } .tabs small { color:inherit; opacity:.7; } .tabs button:disabled,.pagination button:disabled { cursor:not-allowed; opacity:.45; }
.table-wrap { overflow-x:auto; border:1px solid var(--studio-border); border-radius:1rem; background:var(--studio-surface); } table { width:100%; border-collapse:collapse; } th,td { padding:.8rem .7rem; border-bottom:1px solid var(--studio-border); text-align:left; white-space:nowrap; } th { color:var(--studio-muted); font-size:.75rem; letter-spacing:.05em; } .notice { margin:0; padding:1rem; border-radius:.75rem; background:var(--studio-surface-subtle); } .error { color:var(--studio-danger); } .pagination { display:flex; justify-content:center; align-items:center; gap:.75rem; }
</style>
