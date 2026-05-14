<template>
  <div class="similar-assets-card surface-card border-round-xl p-4 mb-4" v-if="similarAssets.length > 0">
    <h3 class="text-xl font-bold mb-4 text-900">Similar Assets (유사 종목)</h3>
    
    <div class="grid">
      <div class="col-12 md:col-4" v-for="asset in similarAssets" :key="asset.symbol">
        <router-link
          :to="`/stock/${asset.market.toLowerCase()}/${asset.symbol.toLowerCase()}`"
          class="asset-link"
        >
          <div class="border-1 surface-border border-round-lg p-3 bg-green-50 asset-item">
            <div class="flex justify-content-between align-items-start mb-2">
              <div>
                <div class="font-bold text-xl text-900">{{ asset.symbol }}</div>
                <div class="text-sm text-600 line-height-2">{{ asset.koName || asset.symbol }}</div>
              </div>
              <i class="pi pi-external-link text-green-600"></i>
            </div>
            <div class="flex flex-wrap gap-2 mt-3">
              <span v-if="asset.matchReasons.includes('underlying')" class="match-tag bg-green-200 text-green-800">
                <i class="pi pi-link" style="font-size: 0.65rem;"></i> 동일 기초자산
              </span>
              <span v-if="asset.matchReasons.includes('frequency')" class="match-tag bg-blue-100 text-blue-700">
                <i class="pi pi-calendar" style="font-size: 0.65rem;"></i> {{ asset.frequency }}
              </span>
              <span v-if="asset.company" class="match-tag bg-purple-100 text-purple-700">
                {{ asset.company }}
              </span>
            </div>
            <div v-if="asset.underlying" class="text-xs text-500 mt-2">
              기초자산: {{ asset.underlying }}
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { getDataUrl } from '@/utils/dataUrl';

const props = defineProps({
  tickerInfo: Object
});

const similarAssets = ref([]);
let navCache = null;

async function loadNav() {
  if (navCache) return navCache;
  try {
    const res = await fetch(getDataUrl('nav.json'));
    if (!res.ok) throw new Error('nav.json fetch failed');
    navCache = await res.json();
    return navCache;
  } catch (e) {
    console.error('[SimilarAssets] Failed to load nav.json', e);
    return { nav: [] };
  }
}

function findSimilarAssets(currentSymbol, navItems) {
  const current = navItems.find(
    (item) => item.symbol?.toUpperCase() === currentSymbol?.toUpperCase()
  );
  if (!current) return [];

  const currentUnderlying = current.underlying || null;
  const currentFrequency = current.frequency || null;

  const scored = [];

  for (const item of navItems) {
    // Skip self and items without dividends
    if (item.symbol?.toUpperCase() === currentSymbol?.toUpperCase()) continue;
    if (item.noDividends) continue;

    const matchReasons = [];
    let score = 0;

    // 1. Same underlying (strongest match)
    if (currentUnderlying && item.underlying && item.underlying === currentUnderlying) {
      matchReasons.push('underlying');
      score += 10;
    }

    // 2. Same frequency
    if (currentFrequency && item.frequency && item.frequency === currentFrequency) {
      matchReasons.push('frequency');
      score += 3;
    }

    // Only include if at least one match reason
    if (matchReasons.length > 0) {
      scored.push({
        symbol: item.symbol,
        koName: item.koName || item.longName || '',
        market: item.market || 'NYSE',
        frequency: item.frequency || '',
        underlying: item.underlying || null,
        company: item.company || null,
        matchReasons,
        score
      });
    }
  }

  // Sort by score desc, then alphabetically
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.symbol.localeCompare(b.symbol);
  });

  // Return top 6
  return scored.slice(0, 5);
}

watch(
  () => props.tickerInfo?.symbol,
  async (symbol) => {
    if (!symbol) {
      similarAssets.value = [];
      return;
    }
    const navData = await loadNav();
    similarAssets.value = findSimilarAssets(symbol, navData.nav || []);
  },
  { immediate: true }
);
</script>

<style scoped>
.similar-assets-card {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.asset-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.asset-item {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;
}

.asset-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.match-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
}
</style>
