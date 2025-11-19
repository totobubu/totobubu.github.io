// src/composables/charts/useAnnualChart.js
import { parseYYMMDD } from '@/utils/date.js';
import { createNumericFormatter } from '@/utils/formatters.js';
import { parseDividendAmount } from '@/utils/dividendParser.js';

export function useAnnualChart(options) {
    const { data, theme, currency = 'USD' } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency);

    // 연도별로 그룹화하고 최종 계산값 사용
    const yearlyData = data.reduce((acc, item) => {
        const date = parseYYMMDD(item['배당락']);
        if (!date) return acc;
        const year = date.getFullYear().toString();
        
        // 차트 value 우선순위: 1. amountOriginal, 2. amountFixed, 3. amount
        let finalAmount = 0;
        let originalAmount = null;
        let adjustedAmount = null; // amountFixed or amount (툴팁 표시용)
        
        // 우선순위에 따라 차트에 그려질 값 선택
        if (item.amountOriginal !== undefined && item.amountOriginal !== null) {
            finalAmount = item.amountOriginal;
            // amountOriginal이 있으면 amountFixed 또는 amount를 툴팁용으로 저장
            adjustedAmount = item.amountFixed !== undefined && item.amountFixed !== null
                ? item.amountFixed
                : (item.amount !== undefined && item.amount !== null ? item.amount : null);
        } else {
            // amountOriginal이 없으면 amountFixed 또는 amount 사용
            if (item.amountFixed !== undefined && item.amountFixed !== null) {
                finalAmount = item.amountFixed;
            } else if (item.amount !== undefined && item.amount !== null) {
                finalAmount = item.amount;
            } else {
                // 배당금 필드가 문자열이면 파싱
                const parsed = parseDividendAmount(item['배당금']);
                finalAmount = parsed.finalAmount || 0;
            }
        }
        
        // 배당금 필드가 문자열이면 파싱해서 원래값 추출 (툴팁 표시용)
        const parsed = parseDividendAmount(item['배당금']);
        if (parsed.originalAmount !== null) {
            originalAmount = parsed.originalAmount;
        }
        
        if (!acc[year]) {
            acc[year] = {
                finalAmount: 0,
                originalAmount: null,
                adjustedAmount: null, // amountFixed or amount (툴팁용)
                displayText: null,
                items: [],
            };
        }
        acc[year].finalAmount += finalAmount;
        acc[year].items.push(item);
        // amountOriginal이 있는 경우 adjustedAmount 저장 (툴팁용)
        if (adjustedAmount !== null) {
            if (acc[year].adjustedAmount === null) {
                acc[year].adjustedAmount = 0;
            }
            acc[year].adjustedAmount += adjustedAmount;
        }
        // 원래 배당금이 있는 경우 저장 (툴팁용)
        if (originalAmount !== null) {
            if (acc[year].originalAmount === null) {
                acc[year].originalAmount = 0;
            }
            acc[year].originalAmount += originalAmount;
        }
        return acc;
    }, {});

    const years = Object.keys(yearlyData).sort(
        (a, b) => parseInt(a) - parseInt(b)
    );
    const dividendData = years.map((year) => yearlyData[year].finalAmount);
    const chartContainerHeight = `${Math.max(250, years.length * 40)}px`;

    const chartOptions = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const year = params[0].name;
                const yearData = yearlyData[year];
                // params[0].value는 finalAmount (차트에 그려진 값)
                const finalAmount = params[0].value;
                let tooltip = `${year}년<br/>배당금 : <strong>${formatCurrency(finalAmount)}</strong>`;
                // amountOriginal이 있는 경우: amountOriginal (= amountFixed or amount) 형식
                if (yearData.adjustedAmount !== null && yearData.adjustedAmount !== finalAmount) {
                    tooltip += ` (= ${formatCurrency(yearData.adjustedAmount)})`;
                }
                // amountOriginal이 없고 원래 배당금이 있는 경우 표시
                else if (yearData.originalAmount !== null && yearData.originalAmount !== finalAmount) {
                    tooltip += ` (= ${formatCurrency(yearData.originalAmount)})`;
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
            data: years,
            axisLabel: { color: textColorSecondary },
        },
        series: [
            {
                name: '연간 배당금',
                type: 'bar',
                data: dividendData,
                label: {
                    show: true,
                    position: 'right',
                    formatter: (params) => formatCurrency(params.value),
                    color: textColor,
                    fontWeight: 'bold',
                },
            },
        ],
    };

    return { chartOptions, chartContainerHeight };
}
