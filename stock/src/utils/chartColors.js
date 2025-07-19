// stock/src/utils/chartColors.js

const colorPalettes = {
    'A': { dividend: '#F4CCCC', highlight: '#FE0000', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#FE0000', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },
    'B': { dividend: '#FFF2CD', highlight: '#FABD03', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#FABD03', dividendText: '#212121', highlightText: '#212121', prevPriceText: '#FFFFFF', currentPriceText: '#212121' },
    'C': { dividend: '#D8EAD2', highlight: '#34A853', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#34A853', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },
    'D': { dividend: '#CFE2F3', highlight: '#4A86E8', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#4A86E8', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },

    '월요일': { dividend: '#E1D5E7', highlight: '#9900FF', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#9900FF', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },
    '화요일': { dividend: '#D0E0E3', highlight: '#00B8D4', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#00B8D4', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },
    '수요일': { dividend: '#C6D5F7', highlight: '#3D5AFE', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#3D5AFE', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },
    '목요일': { dividend: '#FFE0B2', highlight: '#FF6D00', lineDividend: '#bbbbbb', prevPrice: '#BDBDBD', currentPrice: '#FF6D00', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },
    '금요일': { dividend: '#F8BBD0', highlight: '#E91E63', lineDividend: '#5f5f5f', prevPrice: '#BDBDBD', currentPrice: '#E91E63', dividendText: '#212121', highlightText: '#FFFFFF', prevPriceText: '#FFFFFF', currentPriceText: '#FFFFFF' },

    'default': { dividend: '#757575', highlight: '#BDBDBD', lineDividend: '#5f5f5f', prevPrice: '#9E9E9E', currentPrice: '#FAFAFA', dividendText: '#FFFFFF', highlightText: '#212121', prevPriceText: '#FFFFFF', currentPriceText: '#212121' }
};

export function getChartColorsByGroup(group) {
    return colorPalettes[group] || colorPalettes['default'];
}