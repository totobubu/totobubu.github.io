// src/composables/charts/useMonthlyChart.js
import { createNumericFormatter } from '@/utils/formatters.js';
import { parseDividendAmount } from '@/utils/dividendParser.js';

export function useMonthlyChart(options) {
    const { data, theme, currency = 'USD' } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency, {
        maximumFractionDigits: 4,
    });

    const reversedData = [...data].reverse();
    const labels = reversedData.map((item) => item['배당락']);
    // 차트 value 우선순위: 1. amountOriginal, 2. amountFixed, 3. amount
    const parsedData = reversedData.map((item) => {
        // 우선순위에 따라 차트에 그려질 값 선택
        let finalAmount = 0;
        let adjustedAmount = null; // amountFixed or amount (툴팁 표시용)
        
        if (item.amountOriginal !== undefined && item.amountOriginal !== null) {
            finalAmount = item.amountOriginal;
            // amountOriginal이 있으면 amountFixed 또는 amount를 툴팁용으로 저장
            adjustedAmount = item.amountFixed !== undefined && item.amountFixed !== null
                ? item.amountFixed
                : item.amount;
        } else if (item.amountFixed !== undefined && item.amountFixed !== null) {
            finalAmount = item.amountFixed;
        } else {
            finalAmount = item.amount || 0;
        }
        
        // 배당금 필드가 문자열이면 파싱해서 원래값 추출 (툴팁 표시용)
        const parsed = parseDividendAmount(item['배당금']);
        return {
            ...item,
            finalAmount,
            adjustedAmount,
            originalAmount: parsed.originalAmount,
            displayText: parsed.displayText,
        };
    });
    const dividendData = parsedData.map((item) => item.finalAmount);
    const chartContainerHeight = `${Math.max(250, data.length * 40)}px`;

    const chartOptions = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const index = params[0].dataIndex;
                const item = parsedData[index];
                let tooltip = `${params[0].name}<br/>배당금 : <strong>${formatCurrency(params[0].value)}</strong>`;
                // amountOriginal이 있는 경우: amountOriginal (= amountFixed or amount) 형식
                if (item.adjustedAmount !== null && item.adjustedAmount !== params[0].value) {
                    tooltip += ` (= ${formatCurrency(item.adjustedAmount)})`;
                }
                // amountOriginal이 없고 원래 배당금이 있는 경우 표시
                else if (item.displayText) {
                    tooltip += ` ${item.displayText}`;
                }
                return tooltip;
            },
        },
        grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: {
                color: textColorSecondary,
                formatter: (val) => formatCurrency(val).replace(/[$,₩]/, ''),
            },
            splitLine: { lineStyle: { color: surfaceBorder, type: 'dashed' } },
        },
        yAxis: {
            type: 'category',
            data: labels,
            axisLabel: { color: textColorSecondary },
        },
        series: [
            {
                name: '배당금',
                type: 'bar',
                data: dividendData,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (params) => formatCurrency(params.value),
                    color: textColor,
                },
            },
        ],
    };

    return { chartOptions, chartContainerHeight };
}
