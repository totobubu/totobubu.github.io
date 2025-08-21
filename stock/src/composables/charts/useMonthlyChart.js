import { ref, computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

const generateDynamicTimeRangeOptions = (history) => {
    // 월간/주간 차트는 더 짧은 기간 옵션이 의미 없을 수 있습니다.
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

export function useMonthlyChart(options) {
    const { data: fullData, deviceType, group, theme } = options;
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

    const chartData = computed(() => {
        if (!data.value || data.value.length === 0) {
            return { labels: [], datasets: [] };
        }

        const { dividend: colorDividend, highlight: colorHighlight } =
            getChartColorsByGroup(group);
        const labels = data.value.map((item) => item['배당락']);
        const dividendData = data.value.map((item) =>
            parseFloat(item['배당금']?.replace('$', '') || 0)
        );
        const lastDataIndex = data.value.length - 1;
        const barLabelSize = getBarStackFontSize(
            labels.length,
            deviceType,
            'default'
        );

        return {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: '배당금',
                    backgroundColor: (context) =>
                        context.dataIndex === lastDataIndex
                            ? colorHighlight
                            : colorDividend,
                    data: dividendData,
                    datalabels: {
                        display: labels.length <= 15,
                        color: '#fff',
                        anchor: 'end',
                        align: 'end',
                        formatter: (value) =>
                            value > 0 ? `$${value.toFixed(4)}` : null,
                        font: { size: barLabelSize, weight: 'bold' },
                    },
                },
            ],
        };
    });

    const chartOptions = computed(() => {
        if (!data.value || data.value.length === 0) return {};

        const tickFontSize = getBarStackFontSize(
            data.value.length,
            deviceType,
            'axis'
        );
        const dividendData = chartData.value.datasets[0].data;
        const validDividends = dividendData.filter((d) => d > 0);
        const minAmount =
            validDividends.length > 0 ? Math.min(...validDividends) : 0;
        const maxAmount =
            validDividends.length > 0 ? Math.max(...validDividends) : 0;
        const yAxisMin = minAmount * 0.95;
        const yAxisMax = maxAmount * 1.05;

        return {
            maintainAspectRatio: false,
            aspectRatio: getChartAspectRatio(deviceType),
            plugins: getCommonPlugins({
                theme: { ...theme, tickFontSize },
                tooltipCallbacks: {
                    callbacks: {
                        label: (context) =>
                            `${context.dataset.label}: $${Number(context.raw).toFixed(4)}`,
                    },
                },
            }),
            scales: {
                x: {
                    ticks: {
                        color: textColorSecondary,
                        font: { size: tickFontSize },
                    },
                    grid: { color: surfaceBorder },
                },
                y: {
                    min: yAxisMin,
                    max: yAxisMax,
                    ticks: {
                        color: textColorSecondary,
                        font: { size: tickFontSize },
                    },
                    grid: { color: surfaceBorder },
                },
            },
        };
    });

    const chartContainerWidth = computed(() =>
        getDynamicChartWidth(data.value.length, deviceType, 45)
    );

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        selectedTimeRange,
    };
}
