// stock/src/composables/useStockChart.js

import { ref, computed } from 'vue';
import { useWeeklyChart } from './charts/useWeeklyChart';
import { usePriceChart } from './charts/usePriceChart';
import { useBreakpoint } from '@/composables/useBreakpoint';
import { parseYYMMDD } from '@/utils/date.js';

export function useStockChart(dividendHistory, tickerInfo, isPriceChartMode, selectedTimeRange) {
    const chartData = ref(null);
    const chartOptions = ref(null);

    const { deviceType, isDesktop } = useBreakpoint();

    const chartDisplayData = computed(() => {
        if (!dividendHistory.value || dividendHistory.value.length === 0) return [];

        const now = new Date();
        // 👇 [핵심 수정 1] 오늘 날짜를 기준으로 미래 데이터를 필터링하는 로직을 먼저 적용합니다.
        // 시간을 0으로 설정하여 날짜만 비교하도록 합니다.
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const pastAndPresentData = dividendHistory.value.filter(item => {
            const itemDate = parseYYMMDD(item["배당락"]);
            return itemDate && itemDate <= today;
        });

        // 기간 선택 필터링
        if (selectedTimeRange.value === 'Max' || !selectedTimeRange.value) {
            // Max 또는 사용자 줌/팬 상태일 경우, 필터링된 과거/현재 데이터 전체를 사용
            return [...pastAndPresentData].reverse();
        }

        let cutoffDate;
        const rangeValue = parseInt(selectedTimeRange.value);
        const rangeUnit = selectedTimeRange.value.slice(-1);

        if (tickerInfo.value?.frequency === 'Weekly' && !isPriceChartMode.value) {
            let startDate = new Date(now);
            if (rangeUnit === 'M') {
                startDate.setMonth(now.getMonth() - rangeValue);
            } else {
                startDate.setFullYear(now.getFullYear() - rangeValue);
            }
            cutoffDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        } else {
            if (rangeUnit === 'M') {
                cutoffDate = new Date(new Date().setMonth(now.getMonth() - rangeValue));
            } else {
                cutoffDate = new Date(new Date().setFullYear(now.getFullYear() - rangeValue));
            }
        }
        
        // 👇 [핵심 수정 2] 필터링 대상을 원본(dividendHistory)이 아닌, 미래가 제거된 데이터(pastAndPresentData)로 변경
        return pastAndPresentData
            .filter((item) => parseYYMMDD(item["배당락"]) >= cutoffDate)
            .reverse();
    });

    const updateChart = () => {
        const data = chartDisplayData.value;
        const frequency = tickerInfo.value?.frequency;
        
        if (!data || data.length === 0) {
            chartData.value = null; chartOptions.value = null; return;
        }

        const documentStyle = getComputedStyle(document.documentElement);
       const themeOptions = {
      textColor: documentStyle.getPropertyValue("--p-text-color"),
      textColorSecondary: documentStyle.getPropertyValue(
        "--p-text-muted-color"
      ),
      surfaceBorder: documentStyle.getPropertyValue("--p-content-border-color"),
      zoomOptions: {
        pan: {
          enabled: true,
          mode: "x",
          onPanComplete: () => {
            selectedTimeRange.value = null;
          },
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "x",
          onZoomComplete: () => {
            selectedTimeRange.value = null;
          },
        },
      },
    };
        const sharedOptions = {
      data,
      deviceType: deviceType.value,
      group: tickerInfo.value?.group,
      theme: themeOptions,
    };

if (isPriceChartMode.value) {
      const { priceChartData, priceChartOptions } =
        usePriceChart(sharedOptions);
      chartData.value = priceChartData;
      chartOptions.value = priceChartOptions;
    } else {
      if (frequency === "Weekly") {
        const { weeklyChartData, weeklyChartOptions } =
          useWeeklyChart(sharedOptions);
        chartData.value = weeklyChartData;
        chartOptions.value = weeklyChartOptions;
      } else {
        const { priceChartData, priceChartOptions } =
          usePriceChart(sharedOptions);
        chartData.value = priceChartData;
        chartOptions.value = priceChartOptions;
      }
    }
    };

    return { chartData, chartOptions, updateChart };
}