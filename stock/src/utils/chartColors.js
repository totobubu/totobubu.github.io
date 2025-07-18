// stock/src/utils/chartColors.js

// 10가지 그룹 + 기본값에 대한 색상 팔레트를 정의합니다.
const colorPalettes = {
    'A': { dividend: '#F4CCCC', highlight: '#FE0000', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#FE0000' },
    'B': { dividend: '#fff2cd', highlight: '#fabd03', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#fabd03' },
    'C': { dividend: '#d8ead2', highlight: '#34a853', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#34a853' },
    'D': { dividend: '#cfe2f3', highlight: '#4a86e8', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#4a86e8' },

    '월요일': { dividend: '#E1D5E7', highlight: '#9900FF', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#9900FF' },
    '화요일': { dividend: '#D0E0E3', highlight: '#00B8D4', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#00B8D4' },
    '수요일': { dividend: '#C6D5F7', highlight: '#3D5AFE', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#3D5AFE' },
    '목요일': { dividend: '#FFE0B2', highlight: '#FF6D00', lineDividend: '#bbbbbb', prevPrice: '#666666', currentPrice: '#FF6D00' },
    '금요일': { dividend: '#F8BBD0', highlight: '#E91E63', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#E91E63' },

    'default': { dividend: '#BDBDBD', highlight: '#757575', lineDividend: '#5f5f5f', prevPrice: '#212121', currentPrice: '#757575' } 
};

// group 값을 받아 적절한 색상 팔레트를 반환하는 함수
export function getChartColorsByGroup(group) {
    // group 값이 팔레트에 존재하면 해당 팔레트를, 없으면 'default' 팔레트를 반환
    return colorPalettes[group] || colorPalettes['default'];
}