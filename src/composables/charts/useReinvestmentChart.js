import { computed, ref } from 'vue'; // ref 추가, watch 제거 (이 파일에서는 직접적인 side effect 없음)
import { formatLargeNumber } from '@/utils/numberFormat.js';
import Annotation from 'chartjs-plugin-annotation';

// Vue 3.4+ 에서는 options 객체 전체를 reactive하게 참조하는 것이 더 안정적입니다.
export function useReinvestmentChart(options) {
    // 구조 분해 할당 대신, options 객체를 직접 사용합니다.
    const {
        currentAssets,
        targetAmount,
        payoutsPerYear,
        dividendStats,
        annualGrowthRateScenario,
        currentPrice,
        goalAchievementTimes,
        theme,
    } = options;
    const { textColor, textColorSecondary, surfaceBorder } = theme;

    const calculateGrowthPath = (
        dividendPerShare,
        maxMonths,
        continueOnGoal = false
    ) => {
        // 이 함수는 ref의 .value에 접근해야 합니다.
        if (
            currentAssets.value <= 0 ||
            dividendPerShare <= 0 ||
            currentPrice.value <= 0 ||
            payoutsPerYear.value <= 0
        ) {
            return [];
        }
        let assetValue = currentAssets.value;
        let months = 0;
        const monthlyGrowthRate =
            (1 + annualGrowthRateScenario.value) ** (1 / 12) - 1;
        const monthlyPayouts = payoutsPerYear.value / 12;
        const path = [{ x: 0, y: assetValue }];

        while (months < maxMonths) {
            months++;
            assetValue *= 1 + monthlyGrowthRate;
            const currentShares = assetValue / currentPrice.value;
            const dividendReceived =
                currentShares * dividendPerShare * monthlyPayouts;
            assetValue += dividendReceived;
            path.push({ x: months, y: assetValue });

            if (!continueOnGoal && assetValue >= targetAmount.value) break;
        }
        return path;
    };

    const reinvestmentChartData = computed(() => {
        // --- 핵심 수정 1: 데이터 준비 상태 확인 ---
        // 의존하는 computed 값들이 유효한지 먼저 확인합니다.
        if (!dividendStats.value || !goalAchievementTimes.value) {
            return { datasets: [] }; // 데이터가 준비되지 않았으면 빈 차트 반환
        }

        const avgMonths = Math.ceil(goalAchievementTimes.value.avg);
        // 계산 불가 상태일 경우 빈 차트 반환
        if (!isFinite(avgMonths) || avgMonths <= 0) {
            return { datasets: [] };
        }

        const hopePath = calculateGrowthPath(
            dividendStats.value.max,
            avgMonths,
            true
        );
        const avgPath = calculateGrowthPath(
            dividendStats.value.avg,
            avgMonths,
            false
        );
        const despairPath = calculateGrowthPath(
            dividendStats.value.min,
            avgMonths,
            false
        );

        return {
            datasets: [
                {
                    label: '희망',
                    data: hopePath,
                    borderColor: '#22c55e',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0,
                },
                {
                    label: '평균',
                    data: avgPath,
                    borderColor: '#eab308',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0,
                },
                {
                    label: '절망',
                    data: despairPath,
                    borderColor: '#ef4444',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0,
                },
            ],
        };
    });

    const reinvestmentChartOptions = computed(() => {
        // --- 핵심 수정 2: 데이터 준비 상태 확인 ---
        if (
            !goalAchievementTimes.value ||
            !isFinite(goalAchievementTimes.value.avg)
        ) {
            // 계산이 불가능할 때 기본 차트 옵션 반환
            return {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
            };
        }

        const hopeTime = goalAchievementTimes.value.hope;
        const avgTime = goalAchievementTimes.value.avg;

        // xAxis의 min, max 값이 유효한 숫자인지 확인
        const xAxisMin =
            isFinite(hopeTime) && hopeTime > 1 ? Math.floor(hopeTime) - 1 : 0;
        const xAxisMax = isFinite(avgTime) ? Math.ceil(avgTime) : 120; // 평균이 무한대일 경우 10년으로 제한

        return {
            maintainAspectRatio: false,
            aspectRatio: 1.5,
            parsing: { xAxisKey: 'x', yAxisKey: 'y' },
            plugins: {
                datalabels: { display: false },
                legend: { position: 'bottom', labels: { color: textColor } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: (tooltipItems) =>
                            `${tooltipItems[0].raw.x}개월 후`,
                        label: (context) =>
                            `${context.dataset.label}: ${formatLargeNumber(context.raw.y)}`,
                    },
                },
                annotation: {
                    annotations: {
                        targetLine: {
                            type: 'line',
                            yMin: targetAmount.value,
                            yMax: targetAmount.value,
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            label: {
                                content: `목표: ${formatLargeNumber(targetAmount.value)}`,
                                display: true,
                                position: 'end',
                                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                            },
                        },
                        hopeTargetPoint: {
                            type: 'point',
                            xValue: goalAchievementTimes.value.hope,
                            yValue: targetAmount.value,
                            backgroundColor: 'rgba(34, 197, 94, 0.8)',
                            radius: 8,
                            borderColor: 'rgba(255, 255, 255, 0.8)',
                            borderWidth: 2,
                        },
                        avgTargetPoint: {
                            type: 'point',
                            xValue: goalAchievementTimes.value.avg,
                            yValue: targetAmount.value,
                            backgroundColor: 'rgba(234, 179, 8, 0.8)',
                            radius: 8,
                            borderColor: 'rgba(255, 255, 255, 0.8)',
                            borderWidth: 2,
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    min: xAxisMin,
                    max: xAxisMax,
                    ticks: {
                        color: theme.textColorSecondary,
                        stepSize: Math.max(1, Math.ceil(xAxisMax / 5)),
                        callback: (value) => `${value}개월`,
                    },
                    grid: { color: theme.surfaceBorder },
                },
                y: {
                    type: 'logarithmic',
                    ticks: {
                        color: textColorSecondary,
                        callback: (value, index, ticks) => {
                            if (value === 0) return '0';
                            const log10 = Math.log10(value);
                            if (log10 === Math.floor(log10)) {
                                return formatLargeNumber(value);
                            }
                            return '';
                        },
                    },
                    grid: { color: surfaceBorder },
                },
            },
        };
    });

    return { reinvestmentChartData, reinvestmentChartOptions };
}
