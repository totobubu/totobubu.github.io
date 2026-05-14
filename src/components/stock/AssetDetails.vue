<template>
  <div class="asset-details-card surface-card border-round-xl p-4 mb-4">
    <div class="flex justify-content-between align-items-center mb-4">
      <div>
        <template v-if="isLoading">
          <Skeleton width="10rem" height="2rem" class="mb-2"></Skeleton>
          <Skeleton width="15rem" height="1.5rem"></Skeleton>
        </template>
        <template v-else>
          <h2 class="text-3xl font-bold m-0 text-900">{{ tickerInfo?.symbol }}</h2>
          <p class="text-xl text-600 m-0 mt-1">{{ tickerInfo?.longName }}</p>
        </template>
      </div>
      <div class="text-right">
        <Skeleton v-if="isLoading" width="8rem" height="2.5rem"></Skeleton>
        <h3 v-else class="text-4xl font-bold m-0 text-900">{{ tickerInfo?.price }} {{ tickerInfo?.currency }}</h3>
      </div>
    </div>

    <div class="grid mb-4">
      <template v-if="isLoading">
        <div class="col-6 md:col-4 lg:col-2" v-for="i in 6" :key="i">
          <Skeleton height="5rem" borderRadius="0.5rem"></Skeleton>
        </div>
      </template>
      <template v-else>
        <div class="col-6 md:col-4 lg:col-2">
          <div class="text-600 text-sm mb-1">시장</div>
          <div class="font-bold text-900">{{ tickerInfo?.market ? tickerInfo.market.toUpperCase() : '-' }}</div>
        </div>
        <div class="col-6 md:col-4 lg:col-2">
          <div class="text-600 text-sm mb-1">52W HIGH</div>
          <div class="font-bold text-900">{{ tickerInfo?.fiftyTwoWeekHigh || '-' }}</div>
        </div>
        <div class="col-6 md:col-4 lg:col-2">
          <div class="text-600 text-sm mb-1">52W LOW</div>
          <div class="font-bold text-900">{{ tickerInfo?.fiftyTwoWeekLow || '-' }}</div>
        </div>
        <div class="col-6 md:col-4 lg:col-2">
          <div class="text-600 text-sm mb-1">MARKET CAP</div>
          <div class="font-bold text-900">{{ tickerInfo?.marketCap || '-' }}</div>
        </div>
        <div class="col-6 md:col-4 lg:col-2">
          <div class="text-600 text-sm mb-1">YIELD</div>
          <div class="font-bold text-900">{{ tickerInfo?.yield ? (tickerInfo.yield * 100).toFixed(2) + '%' : '-' }}</div>
        </div>
        <div class="col-6 md:col-4 lg:col-2">
          <div class="text-600 text-sm mb-1">CATEGORY</div>
          <div class="font-bold text-900">{{ tickerInfo?.category || '-' }}</div>
        </div>
        <div class="col-6 md:col-4 lg:col-2">
          <div class="text-600 text-sm mb-1">EXP RATIO</div>
          <div class="font-bold text-900">{{ tickerInfo?.expenseRatio ? (tickerInfo.expenseRatio * 100).toFixed(2) + '%' : '-' }}</div>
        </div>
      </template>
    </div>

    <div class="text-700 line-height-3 mb-5 border-top-1 surface-border pt-4">
      {{ tickerInfo?.longBusinessSummary || 'Fund summary is not available at the moment.' }}
    </div>

    <div>
      <h3 class="text-xl font-bold mb-3 text-900">PRICE PERFORMANCE (주가 추이)</h3>
      <Skeleton v-if="isLoading" height="30rem" borderRadius="1rem"></Skeleton>
      <StockPriceCandlestickChart v-else-if="backtestData && backtestData.length > 0" :price-data="backtestData" />
    </div>
  </div>
</template>

<script setup>
import StockPriceCandlestickChart from '@/components/charts/StockPriceCandlestickChart.vue';
import Skeleton from 'primevue/skeleton';

defineProps({
  isLoading: Boolean,
  tickerInfo: Object,
  backtestData: Array
});
</script>

<style scoped>
.asset-details-card {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}
</style>
