<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

type Review = { id: number; ticker: string; ex_date: string; status: string; distribution_per_share: string; official_url: string; comparison_json: string; data_path: string | null };
const reviews = ref<Review[]>([]); const summary = ref<Record<string, number>>({}); const error = ref('');
const pending = computed(() => reviews.value.filter(row => !['matched', 'applied', 'rejected'].includes(row.status)));
function details(row: Review) { try { return JSON.parse(row.comparison_json) as { matchingFields?: string[]; legacy?: unknown[] }; } catch { return {}; } }
async function load() { try { const response = await fetch('/content-studio/reconciliation.json', { cache: 'no-store' }); if (!response.ok) throw new Error(`스냅샷 없음 (${response.status})`); const payload = await response.json(); reviews.value = payload.reviews || []; summary.value = payload.summary || {}; } catch (reason) { error.value = reason instanceof Error ? reason.message : '불러오기 실패'; } }
onMounted(load);
</script>
<template>
  <section class="view"><header><div><p>CONTENT STUDIO ADMIN</p><h1>기존 데이터 대조·승인 대기</h1></div><button @click="load">새로고침</button></header>
    <p class="notice">SQLite 공식 원장과 <code>public/data</code>를 대조합니다. 공식 수집 티커의 JSON이 없으면 기존 신규 티커 워크플로를 먼저 실행합니다. 배당 행 자체는 이 화면에서 바꾸지 않으며 승인된 건만 로컬 CLI에서 반영합니다.</p>
    <p v-if="error" class="notice error">{{ error }}</p>
    <div class="stats"><span v-for="(count, status) in summary" :key="status"><b>{{ status }}</b> {{ count }}</span></div>
    <div class="table-wrap" v-if="reviews.length"><table><thead><tr><th>티커</th><th>배당락일</th><th>공식 금액</th><th>대조 결과</th><th>일치 기준</th><th>공식 원문</th></tr></thead><tbody><tr v-for="row in reviews" :key="row.id" :class="{ pending: pending.includes(row) }"><td>{{ row.ticker }}</td><td>{{ row.ex_date }}</td><td>{{ row.distribution_per_share }}</td><td><code>{{ row.status }}</code></td><td>{{ details(row).matchingFields?.join(', ') || '수동 검토' }}</td><td><a :href="row.official_url" target="_blank" rel="noreferrer">공식 원문</a></td></tr></tbody></table></div>
    <p v-else class="notice">표시할 기록이 없습니다.</p>
    <p class="command">승인: <code>python scripts/content_pipeline/reconcile_public_data.py --apply-review &lt;id&gt; --reviewer "name" --action append|replace</code></p>
  </section>
</template>
<style scoped>
.view{display:grid;gap:1rem}.view header{display:flex;justify-content:space-between;align-items:end;gap:1rem}.view header p{color:var(--studio-accent);font-weight:800;font-size:.75rem;letter-spacing:.1em;margin:0}.view h1{margin:.2rem 0 0}.view button{border:1px solid var(--studio-border);background:var(--studio-surface);padding:.5rem .75rem;border-radius:.5rem;color:inherit}.notice,.command{margin:0;padding:1rem;background:var(--studio-surface);border:1px solid var(--studio-border);border-radius:.75rem;color:var(--studio-muted)}.error{color:var(--studio-danger)}.stats{display:flex;gap:.5rem;flex-wrap:wrap}.stats span{padding:.4rem .6rem;border-radius:.5rem;background:var(--studio-surface);border:1px solid var(--studio-border);font-size:.85rem}.table-wrap{overflow:auto;border:1px solid var(--studio-border);border-radius:.75rem;background:var(--studio-surface)}table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{padding:.7rem;border-bottom:1px solid var(--studio-border);text-align:left;white-space:nowrap}th{color:var(--studio-muted)}tr.pending td{background:color-mix(in srgb,var(--studio-warning) 8%,transparent)}a{color:var(--studio-accent)}code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.8rem}
</style>
