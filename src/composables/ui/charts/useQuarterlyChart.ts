import { parseYYMMDD } from '@/utils/date';
import { createNumericFormatter } from '@/utils/formatters';
import { monthColors } from '@/utils/chartUtils';

export interface ChartTheme {
    textColor: string;
    textColorSecondary: string;
    surfaceBorder: string;
}

export interface QuarterlyChartOptions {
    data: any[];
    theme: ChartTheme;
    currency?: 'USD' | 'KRW';
    aggregation?: 'quarter' | 'month';
}

export function useQuarterlyChart(options: QuarterlyChartOptions) {
    const { data, theme, currency = 'USD', aggregation = 'quarter' } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency);
    const quarterColors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'];

    // 차트 value 우선순위: 1. amountOriginal, 2. amountFixed, 3. amount
    const yearlyData = data.reduce((acc: any, item: any) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const year = date.getFullYear().toString();
        const subCategory =
            aggregation === 'quarter'
                ? Math.floor(date.getMonth() / 3)
                : date.getMonth();
        if (!acc[year])
            acc[year] =
                aggregation === 'quarter' ? [0, 0, 0, 0] : Array(12).fill(0);
        
        // 우선순위에 따라 차트에 그려질 값 선택
        let finalAmount = 0;
        if (item.amountOriginal !== undefined && item.amountOriginal !== null) {
            finalAmount = item.amountOriginal;
        } else if (item.amountFixed !== undefined && item.amountFixed !== null) {
            finalAmount = item.amountFixed;
        } else {
            finalAmount = item.amount || 0;
        }
        
        acc[year][subCategory] += finalAmount;
        return acc;
    }, {});

    const years = Object.keys(yearlyData).sort(
        (a, b) => parseInt(a) - parseInt(b)
    );
    const chartContainerHeight = `${Math.max(250, years.length * 60)}px`;

    const subCategories =
        aggregation === 'quarter'
            ? [0, 1, 2, 3]
            : Array.from({ length: 12 }, (_, i) => i);
    const subCategoryLabels =
        aggregation === 'quarter'
            ? ['1분기', '2분기', '3분기', '4분기']
            : Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
    const colorMap =
        aggregation === 'quarter' ? quarterColors : Object.values(monthColors);

    const series = subCategories.map((sc, i) => ({
        name: subCategoryLabels[i],
        type: 'bar',
        stack: 'total',
        label: {
            show: true,
            formatter: (params: any) =>
                params.value > 0 ? formatCurrency(params.value) : '',
        },
        emphasis: { focus: 'series' },
        data: years.map((year) => yearlyData[year][sc]),
        itemStyle: { color: colorMap[i] },
    }));

    series.push({
        name: '연간 총액',
        type: 'bar',
        stack: 'total',
        label: {
            show: true,
            position: 'right',
            formatter: (params: any) => {
                const total = yearlyData[params.name].reduce(
                    (sum: number, val: number) => sum + val,
                    0
                );
                return total > 0 ? formatCurrency(total) : '';
            },
            color: textColor,
            fontWeight: 'bold',
        } as any,
        data: years.map(() => 0),
    } as any);

    const chartOptions = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const year = params[0].name;
                const total = yearlyData[year].reduce(
                    (sum: number, val: number) => sum + val,
                    0
                );
                let tooltip = `${year}년<br/>`;
                params
                    .filter((p: any) => p.seriesName !== '연간 총액' && p.value > 0)
                    .forEach((p: any) => {
                        tooltip += `${p.marker} ${p.seriesName}: <strong>${formatCurrency(p.value)}</strong><br/>`;
                    });
                tooltip += `<strong>총액: ${formatCurrency(total)}</strong>`;
                return tooltip;
            },
        },
        legend: { show: true, textStyle: { color: textColorSecondary } },
        grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: { color: textColorSecondary },
            splitLine: { lineStyle: { color: surfaceBorder, type: 'dashed' } },
        },
        yAxis: {
            type: 'category',
            data: years,
            axisLabel: { color: textColorSecondary },
        },
        series: series,
    };

    return { chartOptions, chartContainerHeight };
}
