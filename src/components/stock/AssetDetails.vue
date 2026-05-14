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
          <p class="text-md text-600 m-0 mt-1">{{ tickerInfo?.longName || tickerInfo?.englishName }}</p>
          <p class="text-md text-600 m-0 mt-1">{{ tickerInfo?.koName }}</p>
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
        <div
          v-for="detail in stockDetails"
          :key="detail.key"
          class="col-6 md:col-4 lg:col-2"
        >
          <div class="detail-item">
            <div class="text-600 text-sm mb-1">{{ detail.label }}</div>
            <div class="font-bold text-900">{{ detail.value }}</div>
            <div v-if="detail.changeInfo" class="change-badge mt-1">
              <Tag
                :severity="getChangeSeverity(detail.changeInfo.change)"
                class="text-xs"
              >
                <i :class="getChangeIcon(detail.changeInfo.change)" style="font-size: 0.65rem;" />
              </Tag>
            </div>
          </div>
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
import { computed } from 'vue';
import StockPriceCandlestickChart from '@/components/charts/StockPriceCandlestickChart.vue';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import {
  formatCurrency,
  formatLargeNumber,
  formatPercent,
} from '@/utils/formatters.js';

const props = defineProps({
  isLoading: Boolean,
  tickerInfo: Object,
  backtestData: Array
});

const stockDetails = computed(() => {
  if (!props.tickerInfo) return [];
  const { currency = 'USD' } = props.tickerInfo;

  const detailMapping = [
    {
      key: 'market',
      label: '시장',
      alwaysShow: true,
      formatter: (val) => val ? String(val).toUpperCase() : null,
    },
    {
      key: 'fiftyTwoWeekHigh',
      label: '52W HIGH',
      alwaysShow: true,
    },
    {
      key: 'fiftyTwoWeekLow',
      label: '52W LOW',
      alwaysShow: true,
    },
    {
      key: 'marketCap',
      label: 'MARKET CAP',
      alwaysShow: true,
      formatter: (val) => formatLargeNumber(val, currency),
    },
    {
      key: 'Yield',
      label: 'YIELD',
      alwaysShow: true,
      formatter: formatPercent,
    },
    {
      key: 'category',
      label: 'CATEGORY',
      alwaysShow: true,
    },
    {
      key: 'expenseRatio',
      label: 'EXP RATIO',
      alwaysShow: true,
      formatter: formatPercent,
    },
    {
      key: 'enterpriseValue',
      label: '기업가치',
      formatter: (val) => formatLargeNumber(val, currency),
    },
    { key: 'earningsDate', label: '실적발표일' },
    {
      key: 'Volume',
      label: '거래량',
      formatter: (val) => formatLargeNumber(val, currency),
    },
    {
      key: 'AvgVolume',
      label: '평균거래량',
      formatter: (val) => formatLargeNumber(val, currency),
    },
    {
      key: 'sharesOutstanding',
      label: '유통 주식 수',
      formatter: (val) => formatLargeNumber(val, currency),
    },
    {
      key: 'dividendRate',
      label: '연간 배당금',
      formatter: (val) => formatCurrency(val, currency),
    },
    {
      key: 'payoutRatio',
      label: '배당 성향',
      formatter: formatPercent,
    },
  ];

  return detailMapping
    .map((item) => {
      const rawValue = props.tickerInfo[item.key];
      const displayValue = item.formatter
        ? item.formatter(rawValue)
        : rawValue;

      const isMissing =
        rawValue === null ||
        rawValue === undefined ||
        rawValue === 'N/A' ||
        displayValue === 'N/A';

      return {
        key: item.key,
        label: item.label,
        value: isMissing ? '-' : displayValue,
        rawValue,
        alwaysShow: item.alwaysShow || false,
        changeInfo: props.tickerInfo.changes?.[item.key],
      };
    })
    .filter((item) => {
      // Always show designated fields (with '-' fallback)
      if (item.alwaysShow) return true;

      if (
        item.rawValue === null ||
        item.rawValue === undefined ||
        item.rawValue === 'N/A' ||
        item.value === '-'
      ) {
        return false;
      }

      if (
        item.key === 'sharesOutstanding' &&
        Number(item.rawValue) === 0
      ) {
        return false;
      }

      return true;
    });
});

const getChangeIcon = (change) =>
  ({ up: 'pi pi-arrow-up', down: 'pi pi-arrow-down' })[change] ||
  'pi pi-equals';
const getChangeSeverity = (change) =>
  ({ up: 'success', down: 'danger' })[change] || 'contrast';
</script>

<style scoped>
.asset-details-card {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.detail-item {
  position: relative;
}

.change-badge {
  display: inline-block;
}
</style>
