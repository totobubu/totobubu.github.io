<!-- src/pages/StockView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { ref, computed, watch } from 'vue';
    import { useRoute } from 'vue-router';
    import { useStockData } from '@/composables/data/useStockData';
    import { useFilterState } from '@/composables/portfolio/useFilterState';
    import { useBreakpoint } from '@/composables/shared/useBreakpoint';
    import { useStockCharts } from '@/composables/shared/useStockCharts';
    import { parseYYMMDD, generateTimeRangeOptions } from '@/utils';
    import {
        buildSymbolFromRouteParams,
        buildSanitizedTickerFromRouteParams,
        stripTickerSuffix,
    } from '@/utils/tickerRoute';
    import VChart from 'vue-echarts';

    import Skeleton from 'primevue/skeleton';
    import StockHeader from '@/components/StockHeader.vue';
    
    // New Redesign Components
    import AssetDetails from '@/components/stock/AssetDetails.vue';
    import DividendsSummary from '@/components/stock/DividendsSummary.vue';
    import AnnualPayoutHistory from '@/components/stock/AnnualPayoutHistory.vue';
    import AnalysisGauges from '@/components/stock/AnalysisGauges.vue';
    import SimilarAssets from '@/components/stock/SimilarAssets.vue';
    import StockHoldingsChart from '@/components/charts/StockHoldingsChart.vue';

    const route = useRoute();
    const { myBookmarks } = useFilterState();
    const { isDesktop, deviceType } = useBreakpoint();

    const {
        tickerInfo,
        dividendHistory,
        backtestData,
        holdingsData,
        forecastedDividends,
        isLoading,
        error,
        loadData,
        isUpcoming,
    } = useStockData();

    const marketSlug = computed(() =>
        (route.params.market || '').toString().toLowerCase()
    );
    const tickerParam = computed(() => (route.params.ticker || '').toString());
    const tickerSymbol = computed(() =>
        buildSymbolFromRouteParams(marketSlug.value, tickerParam.value)
    );
    const sanitizedTicker = computed(() =>
        buildSanitizedTickerFromRouteParams(marketSlug.value, tickerParam.value)
    );
    const pageTitle = computed(() => {
        const upperTicker = tickerSymbol.value.toUpperCase();
        if (isLoading.value) return '종목 정보 로딩 중...';
        return tickerInfo.value?.longName
            ? `${tickerInfo.value.longName} (${upperTicker}) | 정보`
            : `${upperTicker} | 정보`;
    });
    useHead({ title: pageTitle });



    const selectedTimeRange = ref(null);

    const timeRangeOptions = computed(() => {
        return generateTimeRangeOptions(tickerInfo.value?.periods);
    });

    // tickerInfo가 로드되면 periods의 첫 번째 값을 기본값으로 설정
    // 티커 전환 시 현재 선택된 기간이 새 티커의 periods에 없으면 최소 기간으로 변경
    watch(
        tickerInfo,
        (info) => {
            if (!info) {
                selectedTimeRange.value = null;
                return;
            }

            const options = generateTimeRangeOptions(info.periods);
            const availableValues = options.map((opt) => opt.value);

            // periods가 없으면 'ALL'로 설정
            if (!info.periods || info.periods.length === 0) {
                selectedTimeRange.value = 'ALL';
                return;
            }

            // 현재 선택된 값이 새 티커의 옵션에 있는지 확인
            if (selectedTimeRange.value && availableValues.includes(selectedTimeRange.value)) {
                // 유효한 값이면 그대로 유지
                return;
            }

            // 현재 선택된 값이 없거나 유효하지 않으면 최소 기간(첫 번째 period)으로 설정
            const preferred =
                info.periods.find(
                    (period) =>
                        period &&
                        period.toString().toUpperCase().includes('5Y')
                ) || info.periods[0];
            selectedTimeRange.value = preferred;
        },
        { immediate: true }
    );

    const displayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0)
            return [];
        const range = selectedTimeRange.value;
        if (!range || range === 'ALL') return dividendHistory.value;

        const now = new Date();
        const val = parseInt(range);
        const unit = range.slice(-1);
        let cutoffDate;

        // --- [핵심 수정] ---
        // 주 단위 배당일 경우, 오늘 날짜 기준 '월(M)' 단위로 필터링
        const frequencyValue = tickerInfo.value?.frequency || '';
        const isWeeklyDividend =
            typeof frequencyValue === 'string' && frequencyValue.includes('주');
        if (isWeeklyDividend) {
            cutoffDate = new Date();
            let monthsToSubtract = 0;
            if (unit === 'M') {
                monthsToSubtract = val;
            } else if (unit === 'Y') {
                monthsToSubtract = val * 12;
            }
            cutoffDate.setMonth(now.getMonth() - monthsToSubtract);
        }
        // 그 외(매월, 분기, 매년)는 '연도' 기준으로 필터링
        else {
            const currentYear = now.getFullYear();
            let startYear;

            if (unit === 'Y') {
                startYear = currentYear - val + 1;
            } else {
                // 6M 같은 경우는 현재 연도만 표시
                startYear = currentYear;
            }
            cutoffDate = new Date(startYear, 0, 1); // 해당 연도의 1월 1일
        }
        // --- // ---

        return dividendHistory.value.filter(
            (item) => parseYYMMDD(item['배당락']) >= cutoffDate
        );
    });

    const { chartOptions, chartContainerHeight } = useStockCharts({
        tickerInfo,
        displayData,
        deviceType,
    });

    watch(
        () => sanitizedTicker.value,
        (newSanitized) => {
            if (newSanitized) {
                loadData(newSanitized).then(() => {

                    // [디버그 로그 추가]
                    console.log(
                        '[디버그] StockView -> 계산기로 전달할 Props:',
                        {
                            tickerInfo: tickerInfo.value,
                            dividendHistory: dividendHistory.value,
                            userBookmark: currentUserBookmark.value,
                        }
                    );
                });
            }
        },
        { immediate: true }
    );

    const currentUserBookmark = computed(() => {
        const isin = tickerInfo.value?.isin;
        if (isin && myBookmarks.value[isin]) {
            return myBookmarks.value[isin];
        }
        const symbol = tickerSymbol.value.toUpperCase();
        const baseSymbol = stripTickerSuffix(symbol);
        return (
            Object.values(myBookmarks.value || {}).find((entry) => {
                const entrySymbol = entry?.symbol
                    ? entry.symbol.toUpperCase()
                    : null;
                if (!entrySymbol) return false;
                if (entrySymbol === symbol) return true;
                return stripTickerSuffix(entrySymbol) === baseSymbol;
            }) || null
        );
    });
</script>

<template>
    <!-- 템플릿 부분은 변경 없이 그대로 유지됩니다 -->
    <div>
        <!-- Skeleton UI removed and moved to AssetDetails -->
        <!-- Error UI -->
        <div v-if="error" class="text-center mt-8">
            <i class="pi pi-exclamation-triangle text-5xl text-red-500" />
            <p class="text-xl mt-4 text-red-500">{{ error }}</p>
        </div>
        <!-- Upcoming UI -->
        <div
            v-else-if="isUpcoming && tickerInfo"
            class="flex flex-column gap-5">
            <StockHeader :info="tickerInfo" />
            <div class="text-center my-8">
                <i class="pi pi-box text-5xl" />
                <p class="text-xl mt-4">출시 예정 종목입니다.</p>
                <p>데이터가 집계되면 차트와 상세 정보가 표시됩니다.</p>
            </div>
        </div>
        <div v-else-if="isLoading || tickerInfo" class="flex flex-column gap-5">
            <!-- StockHeader is mostly the breadcrumbs/basic title -->
            <StockHeader v-if="tickerInfo" :info="tickerInfo" />

            <!-- Redesigned UI Components -->
            <AssetDetails 
              :is-loading="isLoading"
              :ticker-info="tickerInfo" 
              :backtest-data="backtestData" 
            />

            <template v-if="!isLoading && tickerInfo">
              <DividendsSummary 
                :ticker-info="tickerInfo" 
                :dividend-history="dividendHistory"
                :forecasted-dividends="forecastedDividends"
              />

              <AnnualPayoutHistory 
                :dividend-history="dividendHistory" 
              />

              <AnalysisGauges />

              <div class="holdings-card surface-card border-round-xl p-4 mb-4" v-if="holdingsData && holdingsData.length > 0">
                  <h3 class="text-xl font-bold mb-4 text-900">Asset Holdings (자산 구성)</h3>
                  <StockHoldingsChart :holdings-data="holdingsData" />
              </div>

              <SimilarAssets :ticker-info="tickerInfo" />

              <span v-if="tickerInfo.Update" class="text-center">
                  업데이트: {{ tickerInfo.Update }}
              </span>
            </template>
        </div>
        <div v-else class="text-center mt-8">
            <i class="pi pi-inbox text-5xl" />
            <p class="text-xl mt-4">표시할 데이터가 없습니다.</p>
        </div>
    </div>
</template>

<style scoped>
.holdings-card {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}
:deep(.surface-card) {
  background-color: #f4fcf6 !important;
  border-color: #e5f3e9 !important;
}
</style>
