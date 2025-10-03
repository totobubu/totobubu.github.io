import { ref, computed } from 'vue';
import { parseYYMMDD } from '@/utils/date.js';
import { getChartColorsByGroup } from '@/utils/chartColors.js';
import { formatCurrency } from '@/utils/numberFormat.js';
import {
    getDynamicChartWidth,
    getChartAspectRatio,
    getBarStackFontSize,
    getCommonPlugins,
} from '@/utils/chartUtils.js';

const generateDynamicTimeRangeOptions = (history) => {
    if (!history || history.length === 0) {
        return [{ label: '전체', value: 'ALL' }];
    }
    const dates = history
        .map((h) => parseYYMMDD(h['배당락']))
        .sort((a, b) => a - b);
    const lastDate = dates[dates.length - 1];
    const today = new Date();
    const options = [];
    if (lastDate >= new Date(new Date().setMonth(today.getMonth() - 1)))
        options.push({ label: '1M', value: '1M' });
    if (lastDate >= new Date(new Date().setMonth(today.getMonth() - 3)))
        options.push({ label: '3M', value: '3M' });
    if (lastDate >= new Date(new Date().setMonth(today.getMonth() - 6)))
        options.push({ label: '6M', value: '6M' });
    if (lastDate >= new Date(new Date().setFullYear(today.getFullYear() - 1)))
        options.push({ label: '1Y', value: '1Y' });
    options.push({ label: 'ALL', value: 'ALL' });
    return options.map((opt) => ({
        ...opt,
        label: opt.value === 'ALL' ? '전체' : opt.label,
    }));
};

export function useMonthlyChart(options) {
    const { data, deviceType, group, theme, currency } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const selectedTimeRange = ref('1Y');
    const timeRangeOptions = computed(() =>
        generateDynamicTimeRangeOptions(data)
    );

    const { dividend: colorDividend, highlight: colorHighlight } =
        getChartColorsByGroup(group);

    const labels = data.map((item) => item['배당락']);
    const chartContainerWidth = getDynamicChartWidth(
        labels.length,
        deviceType,
        45
    );
    const barLabelSize = getBarStackFontSize(
        labels.length,
        deviceType,
        'default'
    );
    const tickFontSize = getBarStackFontSize(labels.length, deviceType, 'axis');
    const newestDataIndex = 0;

    const dividendData = data.map((item) =>
        parseFloat(String(item['배당금'] || '').replace(/[$,₩]/g, ''))
    );

    const chartData = {
        labels,
        datasets: [
            {
                type: 'bar',
                label: '배당금',
                backgroundColor: (context) =>
                    context.dataIndex === newestDataIndex
                        ? colorHighlight
                        : colorDividend,
                data: dividendData,
                datalabels: {
                    display: labels.length <= 15,
                    color: '#fff',
                    anchor: 'end',
                    align: 'end',
                    formatter: (value) =>
                        value > 0 ? formatCurrency(value, currency) : null,
                    font: { size: barLabelSize, weight: 'bold' },
                },
            },
        ],
    };

    const validDividends = dividendData.filter((d) => d > 0);
    const minAmount =
        validDividends.length > 0 ? Math.min(...validDividends) : 0;
    const maxAmount =
        validDividends.length > 0 ? Math.max(...validDividends) : 0;
    const yAxisMin = minAmount * 0.95;
    const yAxisMax = maxAmount * 1.05;

    const chartOptions = {
        maintainAspectRatio: false,
        aspectRatio: getChartAspectRatio(deviceType),
        plugins: getCommonPlugins({
            theme: { ...theme, tickFontSize },
            tooltipCallbacks: {
                callbacks: {
                    label: (context) =>
                        `${context.dataset.label}: ${formatCurrency(context.raw, currency)}`,
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
                    callback: (value) => formatCurrency(value, currency),
                },
                grid: { color: surfaceBorder },
            },
        },
    };

    return {
        chartData,
        chartOptions,
        chartContainerWidth,
        timeRangeOptions,
        selectedTimeRange,
    };
}
