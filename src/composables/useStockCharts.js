// src/composables/useStockCharts.js

import { computed } from 'vue';
// [핵심 수정] index.js를 통해 한번에 import
import {
    useWeeklyChart,
    useQuarterlyChart,
    useMonthlyChart,
    useAnnualChart,
    // usePriceChart, // 이 라인을 삭제합니다.
} from '@/composables/charts';
import { monthColors } from '@/utils/chartUtils.js';

export function useStockCharts(options) {
    const { tickerInfo, displayData, currentView, deviceType } = options;
    const documentStyle = computed(() =>
        getComputedStyle(document.documentElement)
    );

    const chartComposableResult = computed(() => {
        if (
            !tickerInfo.value ||
            !displayData.value ||
            displayData.value.length === 0
        ) {
            return {};
        }

        const themeOptions = {
            textColor: documentStyle.value.getPropertyValue('--p-text-color'),
            textColorSecondary: documentStyle.value.getPropertyValue(
                '--p-text-muted-color'
            ),
            surfaceBorder: documentStyle.value.getPropertyValue(
                '--p-content-border-color'
            ),
        };
        const sharedOptions = {
            data: displayData.value,
            deviceType: deviceType.value,
            group: tickerInfo.value?.group,
            theme: themeOptions,
            currency: tickerInfo.value.currency,
        };

        // [핵심 수정] '주가' 뷰일 때 빈 객체를 반환하여 오류를 막습니다.
        if (currentView.value === '주가') {
            return {};
        }

        if (currentView.value === '배당') {
            const freq = tickerInfo.value.frequency;
            if (freq === '매년') return useAnnualChart(sharedOptions);
            if (freq === '매주') return useWeeklyChart(sharedOptions);
            if (freq === '분기')
                return useQuarterlyChart({
                    ...sharedOptions,
                    aggregation: 'quarter',
                });
            if (freq === '매월' && displayData.value.length > 59) {
                return useQuarterlyChart({
                    ...sharedOptions,
                    aggregation: 'month',
                    colorMap: monthColors,
                });
            }
            if (freq === '매월') return useMonthlyChart(sharedOptions);
        }
        // 기본값으로 빈 객체 반환
        return {};
    });

    const chartOptions = computed(
        () => chartComposableResult.value.chartOptions
    );
    const chartContainerHeight = computed(
        () => chartComposableResult.value.chartContainerHeight
    );

    // [핵심 수정] chartData는 ECharts에서 더 이상 필요 없으므로 반환하지 않습니다.
    return { chartOptions, chartContainerHeight };
}
