// src/utils/chartUtils.js
import { parseYYMMDD } from '@/utils/date.js'; // [추가] parseYYMMDD 함수를 import 합니다.

/**
 * nav.json의 period 문자열을 기반으로 차트 기간 옵션 배열을 생성합니다.
 * @param {string | undefined} periodString - nav.json에서 가져온 기간 문자열 (예: "1M, 3M, 1Y")
 * @returns {Array<{label: string, value: string}>} PrimeVue SelectButton/Dropdown용 옵션 배열
 */
export const generateOptionsFromPeriodString = (periodString) => {
    // period 문자열이 없거나 비어있으면 '전체' 옵션만 반환
    if (!periodString) {
        return [{ label: '전체', value: 'ALL' }];
    }

    // "ALL"을 임시로 제거하고, 쉼표로 분리하여 옵션 객체 배열 생성
    const options = periodString
        .replace(/,?\s*ALL\s*/, '') // "ALL"과 그 주변 공백, 쉼표 제거
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0) // 빈 문자열 제거
        .map((part) => ({ label: part, value: part }));

    // 마지막에 '전체' 옵션을 항상 추가 (필수 사항)
    options.push({ label: '전체', value: 'ALL' });

    return options;
};

// --- 동적 스타일 계산 함수 ---

export function getDynamicChartWidth(itemCount, deviceType, itemWidth = 45) {
    if (deviceType !== 'mobile') return '100%';
    if (itemCount <= 6) return '100%';
    return `${itemCount * itemWidth}px`;
}

export function getChartAspectRatio(deviceType) {
    if (deviceType === 'mobile') return null;
    if (deviceType === 'desktop') return 16 / 10;
    if (deviceType === 'tablet') return 3 / 2;
    return 16 / 10;
}

// --- 폰트 크기 계산 함수 ---

export function getBarStackFontSize(itemCount, deviceType, type = 'default') {
    let baseSize = type === 'total' ? 18 : 18;
    let finalSize;

    if (itemCount == 1) finalSize = baseSize + 12;
    else if (itemCount == 2) finalSize = baseSize + 6;
    else if (itemCount == 3) finalSize = baseSize + 6;
    else if (itemCount == 4) finalSize = baseSize + 5;
    else if (itemCount == 5) finalSize = baseSize + 5;
    else if (itemCount == 6) finalSize = baseSize + 3;
    else if (itemCount == 7) finalSize = baseSize + 2;
    else if (itemCount == 8) finalSize = baseSize + 1;
    else if (itemCount == 9) finalSize = baseSize + 0;
    else if (itemCount == 10) finalSize = baseSize - 4;
    else if (itemCount == 11) finalSize = baseSize - 5;
    else if (itemCount == 12) finalSize = baseSize - 5;
    else if (itemCount == 13) finalSize = baseSize - 6;
    else if (itemCount == 14) finalSize = baseSize - 6;
    else if (itemCount <= 15) finalSize = baseSize;
    else finalSize = baseSize - 7;
    if (deviceType === 'tablet') finalSize *= 0.75;
    if (deviceType === 'mobile') finalSize *= 0.4;
    return Math.max(8, Math.round(finalSize));
}

export function getPriceChartFontSize(itemCount, deviceType, type = 'default') {
    let baseSize = type === 'line' ? 13 : type === 'axis' ? 12 : 14;
    let finalSize;
    if (itemCount <= 7) finalSize = baseSize + 2;
    else if (itemCount <= 15) finalSize = baseSize;
    else if (itemCount <= 30) finalSize = baseSize - 2;
    else if (itemCount <= 60) finalSize = baseSize - 3;
    else finalSize = baseSize - 4;
    if (deviceType === 'tablet') finalSize *= 0.9;
    if (deviceType === 'mobile') finalSize *= 0.8;
    return Math.max(9, Math.round(finalSize));
}

// --- 차트 옵션 및 데이터셋 생성 헬퍼 함수 ---

export function getCommonPlugins(options) {
    const { theme, tooltipCallbacks = {}, legendDisplay = false } = options;
    const { textColor, tickFontSize, zoomOptions } = theme;
    return {
        title: { display: false },
        legend: {
            display: legendDisplay,
            position: 'top',
            labels: { color: textColor, font: { size: tickFontSize } },
        },
        tooltip: { mode: 'index', intersect: false, ...tooltipCallbacks },
        zoom: zoomOptions,
    };
}

export function createStackedBarDatasets(config) {
    const {
        aggregatedData,
        primaryLabels,
        colorMap,
        labelPrefix,
        dataLabelConfig,
        totalLabelConfig,
    } = config;

    const secondaryKeys = [
        ...new Set(
            Object.values(aggregatedData).flatMap((m) => Object.keys(m.stacks))
        ),
    ]
        .map(Number)
        .sort();

    const datasets = secondaryKeys.map((key) => ({
        type: 'bar',
        label: `${key}${labelPrefix}`,
        backgroundColor: colorMap[key],
        data: primaryLabels.map(
            (label) => aggregatedData[label].stacks[key] || 0
        ),
        datalabels: dataLabelConfig,
    }));

    datasets.push({
        type: 'bar',
        label: 'Total',
        data: new Array(primaryLabels.length).fill(0),
        backgroundColor: 'transparent',
        datalabels: totalLabelConfig,
    });

    return datasets;
}
