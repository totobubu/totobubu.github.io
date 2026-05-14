<template>
  <div class="similar-assets-card surface-card border-round-xl p-4 mb-4">
    <h3 class="text-xl font-bold mb-4 text-900">Similar Assets Comparison (유사 종목 비교)</h3>
    
    <div class="grid">
      <div class="col-12 md:col-4" v-for="asset in mockSimilarAssets" :key="asset.symbol">
        <div class="border-1 surface-border border-round-lg p-3 bg-green-50">
          <div class="flex justify-content-between align-items-start mb-2">
            <div>
              <div class="font-bold text-xl text-900">{{ asset.symbol }}</div>
              <div class="text-sm text-600 line-height-2">{{ asset.name }}</div>
            </div>
            <i class="pi pi-external-link text-green-600"></i>
          </div>
          <div class="flex justify-content-between text-sm mb-1 mt-3">
            <span class="text-600">YIELD</span>
            <span class="font-bold">{{ asset.yield }}</span>
          </div>
          <div class="flex justify-content-between text-sm mb-3">
            <span class="text-600">PE RATIO</span>
            <span class="font-bold">{{ asset.peRatio }}</span>
          </div>
          <div class="flex justify-content-between text-sm align-items-center">
            <span class="text-600">SAFETY</span>
            <span class="font-bold text-xs bg-green-200 text-green-800 px-2 py-1 border-round">{{ asset.safety }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const mockSimilarAssets = ref([
  { symbol: 'VIG', name: 'Vanguard Div Appreciation', yield: '1.76%', peRatio: '18.25', safety: 'EXCEPTIONAL' },
  { symbol: 'VYM', name: 'Vanguard High Div Yield', yield: '3.15%', peRatio: '14.45', safety: 'VERY SAFE' },
  { symbol: 'DGRO', name: 'iShares Core Div Growth', yield: '2.35%', peRatio: '16.50', safety: 'SAFE' }
]);
</script>

<style scoped>
.similar-assets-card {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}
</style>
