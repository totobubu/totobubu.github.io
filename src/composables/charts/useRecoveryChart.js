// src/composables/charts/useRecoveryChart.js
import { computed } from 'vue';
import { formatMonthsToYears } from '@/utils/date.js';
import { createNumericFormatter } from '@/utils/formatters.js';

export function useRecoveryChart(options) {
    const {
        avgPrice,
        quantity,
        accumulatedDividend,
        dividendStats,
        payoutsPerYear,
        applyTax,
        currentPrice,
        theme,
        currency,
    } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;
    const formatCurrency = createNumericFormatter(currency.value);

    const investmentPrincipal = computed(
        () => (avgPrice.value || 0) * (quantity.value || 0)
    );
    const remainingPrincipal = computed(
        () => investmentPrincipal.value - (accumulatedDividend.value || 0)
    );

    const recoveryTimes = computed(() => {
        if (
            !dividendStats?.value ||
            !payoutsPerYear?.value ||
            !currentPrice?.value
        )
            return {};
        const results = {};
        const scenarios = { hope: 'max', avg: 'avg', despair: 'min' };
        for (const [scenario, statKey] of Object.entries(scenarios)) {
            const dividendPerShare = dividendStats.value[statKey];
            if (
                !quantity.value ||
                dividendPerShare <= 0 ||
                !payoutsPerYear.value ||
                remainingPrincipal.value <= 0
            ) {
                results[`${scenario}_reinvest`] = results[
                    `${scenario}_no_reinvest`
                ] = -1;
                continue;
            }
            const finalDividend = applyTax.value
                ? dividendPerShare * 0.85
                : dividendPerShare;
            if (finalDividend <= 0) {
                results[`${scenario}_reinvest`] = results[
                    `${scenario}_no_reinvest`
                ] = Infinity;
                continue;
            }
            const payoutsNoReinvest =
                remainingPrincipal.value / (quantity.value * finalDividend);
            results[`${scenario}_no_reinvest`] =
                (payoutsNoReinvest * 12) / payoutsPerYear.value;
            let currentShares = quantity.value,
                recoveredAmount = 0,
                payoutsReinvest = 0;
            while (recoveredAmount < remainingPrincipal.value) {
                if (payoutsReinvest > payoutsPerYear.value * 100) {
                    payoutsReinvest = Infinity;
                    break;
                }
                const dividendReceived = currentShares * finalDividend;
                recoveredAmount += dividendReceived;
                currentShares += dividendReceived / currentPrice.value;
                payoutsReinvest++;
            }
            results[`${scenario}_reinvest`] =
                (payoutsReinvest * 12) / payoutsPerYear.value;
        }
        return results;
    });

    const chartOptions = computed(() => {
        const times = recoveryTimes.value || {};
        const maxTime = Math.max(
            0,
            ...Object.values(times).filter((t) => isFinite(t) && t > 0)
        );

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) =>
                    `${params[0].name}<br/>${params.map((p) => `${p.marker} ${p.seriesName}: <strong>${formatMonthsToYears(p.value)}</strong>`).join('<br/>')}`,
            },
            legend: {
                data: ['재투자 O', '재투자 X'],
                textStyle: { color: textColorSecondary },
                bottom: 0,
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
                containLabel: true,
            },
            xAxis: [
                {
                    type: 'category',
                    data: ['희망', '평균', '절망'],
                    axisLabel: { color: textColorSecondary },
                },
            ],
            yAxis: [
                {
                    type: 'value',
                    axisLabel: {
                        color: textColorSecondary,
                        formatter: '{value} 개월',
                    },
                    splitLine: {
                        lineStyle: { color: surfaceBorder, type: 'dashed' },
                    },
                    max: maxTime > 0 ? Math.ceil(maxTime / 6) * 6 : 12,
                },
            ],
            series: [
                {
                    name: '재투자 O',
                    type: 'bar',
                    barGap: 0,
                    data: [
                        times.hope_reinvest,
                        times.avg_reinvest,
                        times.despair_reinvest,
                    ].map((t) => (isFinite(t) && t > 0 ? t : 0)),
                    itemStyle: {
                        color: (params) =>
                            ['#22c55e', '#eab308', '#ef4444'][params.dataIndex],
                    },
                    label: {
                        show: true,
                        position: 'top',
                        formatter: (params) =>
                            formatMonthsToYears(params.value),
                        color: textColor,
                        fontWeight: 'bold',
                    },
                },
                {
                    name: '재투자 X',
                    type: 'bar',
                    data: [
                        times.hope_no_reinvest,
                        times.avg_no_reinvest,
                        times.despair_no_reinvest,
                    ].map((t) => (isFinite(t) && t > 0 ? t : 0)),
                    itemStyle: {
                        color: (params) =>
                            ['#22c55e80', '#eab30880', '#ef444480'][
                                params.dataIndex
                            ],
                    },
                    label: {
                        show: true,
                        position: 'top',
                        formatter: (params) =>
                            formatMonthsToYears(params.value),
                        color: textColorSecondary,
                    },
                },
            ],
        };
    });

    return { recoveryTimes, chartOptions };
}
