import { ref, computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
    createStackedBarDatasets,
} from '@/utils/chartUtils.js';

const generateDynamicTimeRangeOptions = (history) => {
    // 분기 차트는 긴 기간을 보는 것이 의미 있으므로, 1Y, ALL만 제공
    const options = [
        { label: '1Y', value: '1Y' },
        { label: 'ALL', value: 'ALL' },
    ];
    return options.map((opt) => ({
        ...opt,
        label: opt.value === 'ALL' ? '전체' : opt.label,
    }));
};

export function useQuarterlyChart(options) {
    const { data: fullData, deviceType, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const selectedTimeRange = ref('ALL'); // 분기 차트는 기본값을 'ALL'로
    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(fullData)
    );

    const data = computed(() => {
        if (
            !fullData ||
            !selectedTimeRange.value ||
            selectedTimeRange.value === 'ALL'
        ) {
            return fullData;
        }
        const now = new Date();
        const cutoffDate = new Date();
        const rangeValue = parseInt(selectedTimeRange.value);
        cutoffDate.setFullYear(now.getFullYear() - rangeValue);

        return fullData.filter((h) => parseYYMMDD(h['배당락']) >= cutoffDate);
    });

    const yearlyAggregated = computed(() => {
        if (!data.value) return {};
        return data.value.reduce((acc, item) => {
            const date = parseYYMMDD(item['배당락']);
            if (!date) return acc;
            const year = date.getFullYear().toString();
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
            if (!acc[year]) acc[year] = { total: 0, stacks: {} };
            if (!acc[year].stacks[quarter]) acc[year].stacks[quarter] = 0;
            acc[year].stacks[quarter] += amount;
            acc[year].total += amount;
            return acc;
        }, {});
    });

    const chartData = computed(() => {
        if (
            !yearlyAggregated.value ||
            Object.keys(yearlyAggregated.value).length === 0
        ) {
            return { labels: [], datasets: [] };
        }

        const labels = Object.keys(yearlyAggregated.value);
        const barLabelSize = getBarStackFontSize(
            labels.length,
            deviceType,
            'default'
        );
        const totalLabelSize = getBarStackFontSize(
            labels.length,
            deviceType,
            'total'
        );

        const quarterColors = {
            1: '#4285F4',
            2: '#EA4335',
            3: '#FBBC04',
            4: '#34A853',
        };

        const datasets = createStackedBarDatasets({
            aggregatedData: yearlyAggregated.value,
            primaryLabels: labels,
            colorMap: quarterColors,
            labelPrefix: '분기',
            dataLabelConfig: {
                display: (context) =>
                    (context.dataset.data[context.dataIndex] || 0) > 0.0001 &&
                    labels.length <= 11,
                formatter: (value) => `$${value.toFixed(2)}`,
                color: '#fff',
                font: { size: barLabelSize, weight: 'bold' },
                align: 'center',
                anchor: 'center',
            },
            totalLabelConfig: {
                display: labels.length <= 11,
                formatter: (value, context) => {
                    const total =
                        yearlyAggregated.value[labels[context.dataIndex]]
                            ?.total || 0;
                    return total > 0 ? `$${total.toFixed(2)}` : '';
                },
                color: textColor,
                anchor: 'end',
                align: 'end',
                offset: -4,
                font: { size: totalLabelSize, weight: 'bold' },
            },
        });

        return { labels, datasets };
    });

    const chartOptions = computed(() => {
        if (
            !yearlyAggregated.value ||
            Object.keys(yearlyAggregated.value).length === 0
        )
            return {};

        const labels = Object.keys(yearlyAggregated.value);
        const tickFontSize = getBarStackFontSize(
            labels.length,
            deviceType,
            'axis'
        );
        const maxTotal = Math.max(
            0,
            ...Object.values(yearlyAggregated.value).map((y) => y.total)
        );
        const yAxisMax = maxTotal > 0 ? maxTotal * 1.25 : undefined; // 0일 경우 자동 스케일링

        return {
            maintainAspectRatio: false,
            aspectRatio: getChartAspectRatio(deviceType),
            plugins: getCommonPlugins({
                theme: { ...theme, tickFontSize },
                tooltipCallbacks: {
                    callbacks: {
                        label: (item) =>
                            item.raw > 0 && item.dataset.label !== 'Total'
                                ? `${item.dataset.label}: $${Number(item.raw).toFixed(2)}`
                                : null,
                        footer: (items) => {
                            const valid = items.filter(
                                (i) => i.raw > 0 && i.dataset.label !== 'Total'
                            );
                            if (valid.length === 0) return '';
                            const sum = valid.reduce((t, c) => t + c.raw, 0);
                            return `Total: $${sum.toFixed(2)}`;
                        },
                    },
                },
            }),
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: textColorSecondary,
                        font: { size: tickFontSize },
                    },
                    grid: { color: surfaceBorder },
                },
                y: {
                    stacked: true,
                    ticks: {
                        color: textColorSecondary,
                        font: { size: tickFontSize },
                    },
                    grid: { color: surfaceBorder },
                    max: yAxisMax,
                },
            },
        };
    });

    const chartContainerWidth = computed(() => {
        if (!yearlyAggregated.value) return '100%';
        return getDynamicChartWidth(
            Object.keys(yearlyAggregated.value).length,
            deviceType,
            90
        );
    });

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        selectedTimeRange,
    };
}
