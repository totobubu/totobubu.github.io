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
    // 주간/4주 차트는 월간과 유사하게 짧은 기간 옵션이 의미 없을 수 있음
    const options = [
        { label: '6M', value: '6M' },
        { label: '1Y', value: '1Y' },
        { label: 'ALL', value: 'ALL' },
    ];
    return options.map((opt) => ({
        ...opt,
        label: opt.value === 'ALL' ? '전체' : opt.label,
    }));
};

// 함수 이름을 useWeeklyChart로 수정
export function useWeeklyChart(options) {
    const { data: fullData, deviceType, theme } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const selectedTimeRange = ref('1Y');
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
        const rangeUnit = selectedTimeRange.value.slice(-1);

        if (rangeUnit === 'M') cutoffDate.setMonth(now.getMonth() - rangeValue);
        else if (rangeUnit === 'Y')
            cutoffDate.setFullYear(now.getFullYear() - rangeValue);

        return fullData.filter((h) => parseYYMMDD(h['배당락']) >= cutoffDate);
    });

    const monthlyAggregated = computed(() => {
        if (!data.value) return {};
        return data.value.reduce((acc, item) => {
            const date = parseYYMMDD(item['배당락']);
            if (!date) return acc;
            const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const amount = parseFloat(item['배당금']?.replace('$', '') || 0);
            const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
            if (!acc[yearMonth]) acc[yearMonth] = { total: 0, stacks: {} };
            if (!acc[yearMonth].stacks[weekOfMonth])
                acc[yearMonth].stacks[weekOfMonth] = 0;
            acc[yearMonth].stacks[weekOfMonth] += amount;
            acc[yearMonth].total += amount;
            return acc;
        }, {});
    });

    const chartData = computed(() => {
        if (
            !monthlyAggregated.value ||
            Object.keys(monthlyAggregated.value).length === 0
        ) {
            return { labels: [], datasets: [] };
        }

        const labels = Object.keys(monthlyAggregated.value);
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
        const weekColors = {
            1: '#4285F4',
            2: '#EA4335',
            3: '#FBBC04',
            4: '#34A853',
            5: '#FF6D01',
        };

        const datasets = createStackedBarDatasets({
            aggregatedData: monthlyAggregated.value,
            primaryLabels: labels,
            colorMap: weekColors,
            labelPrefix: '주차',
            dataLabelConfig: {
                display: (context) =>
                    (context.dataset.data[context.dataIndex] || 0) > 0.0001 &&
                    labels.length <= 15,
                formatter: (value) => `$${value.toFixed(4)}`,
                color: '#fff',
                font: { size: barLabelSize, weight: 'bold' },
                align: 'center',
                anchor: 'center',
            },
            totalLabelConfig: {
                display: labels.length <= 15,
                formatter: (value, context) => {
                    const total =
                        monthlyAggregated.value[labels[context.dataIndex]]
                            ?.total || 0;
                    return total > 0 ? `$${total.toFixed(4)}` : '';
                },
                color: textColor,
                anchor: 'end',
                align: 'end',
                offset: (context) =>
                    (context.chart.options.plugins.datalabels.font.size ||
                        totalLabelSize) /
                        -2 +
                    2,
                font: { size: totalLabelSize, weight: 'bold' },
            },
        });

        return { labels, datasets };
    });

    const chartOptions = computed(() => {
        if (
            !monthlyAggregated.value ||
            Object.keys(monthlyAggregated.value).length === 0
        )
            return {};

        const labels = Object.keys(monthlyAggregated.value);
        const tickFontSize = getBarStackFontSize(
            labels.length,
            deviceType,
            'axis'
        );
        const maxTotal = Math.max(
            0,
            ...Object.values(monthlyAggregated.value).map((m) => m.total)
        );
        const yAxisMax = maxTotal > 0 ? maxTotal * 1.25 : undefined;

        return {
            maintainAspectRatio: false,
            aspectRatio: getChartAspectRatio(deviceType),
            plugins: getCommonPlugins({
                theme: { ...theme, tickFontSize },
                tooltipCallbacks: {
                    callbacks: {
                        label: (item) =>
                            item.raw > 0 && item.dataset.label !== 'Total'
                                ? `${item.dataset.label}: $${Number(item.raw).toFixed(4)}`
                                : null,
                        footer: (items) => {
                            const valid = items.filter(
                                (i) => i.raw > 0 && i.dataset.label !== 'Total'
                            );
                            if (valid.length === 0) return '';
                            const sum = valid.reduce((t, c) => t + c.raw, 0);
                            return `Total: $${sum.toFixed(4)}`;
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
        if (!monthlyAggregated.value) return '100%';
        return getDynamicChartWidth(
            Object.keys(monthlyAggregated.value).length,
            deviceType,
            45
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
