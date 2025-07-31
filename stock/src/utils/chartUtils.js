// src/utils/chartUtils.js

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

export function getCommonPlugins(options) {
    const { 
        deviceType, 
        theme, 
        tooltipCallbacks = {},
        legendDisplay = false 
    } = options;
    
    const { textColor, tickFontSize, zoomOptions } = theme;

    return {
        title: { display: false },
        legend: {
            display: legendDisplay,
            position: 'top',
            labels: {
                color: textColor,
                font: { size: tickFontSize }
            }
        },
        tooltip: {
            mode: "index",
            intersect: false,
            ...tooltipCallbacks
        },
        zoom: zoomOptions,
    };
}