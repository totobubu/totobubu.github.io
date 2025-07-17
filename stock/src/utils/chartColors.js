// stock/src/utils/chartColors.js

// 10가지 그룹 + 기본값에 대한 색상 팔레트를 정의합니다.
const colorPalettes = {
    'A': { dividend: '#42A5F5', highlight: '#1E88E5', lineDividend: '#1565C0', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Blue
    'B': { dividend: '#66BB6A', highlight: '#43A047', lineDividend: '#2E7D32', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Green
    'C': { dividend: '#FFA726', highlight: '#FB8C00', lineDividend: '#E65100', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Orange
    'D': { dividend: '#AB47BC', highlight: '#8E24AA', lineDividend: '#6A1B9A', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Purple
    '월요일': { dividend: '#EF5350', highlight: '#E53935', lineDividend: '#C62828', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Red
    '화요일': { dividend: '#26A69A', highlight: '#00897B', lineDividend: '#00695C', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Teal
    '수요일': { dividend: '#7E57C2', highlight: '#5E35B1', lineDividend: '#4527A0', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Deep Purple
    '목요일': { dividend: '#5C6BC0', highlight: '#3F51B5', lineDividend: '#303F9F', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Indigo
    '금요일': { dividend: '#FF7043', highlight: '#F4511E', lineDividend: '#D84315', prevPrice: '#BDBDBD', currentPrice: '#424242' }, // Deep Orange
    'default': { dividend: '#FFC107', highlight: '#FB8C00', lineDividend: '#5f5f5f', prevPrice: '#9E9E9E', currentPrice: '#212121' } // 기본값 (기존 색상)
};

// group 값을 받아 적절한 색상 팔레트를 반환하는 함수
export function getChartColorsByGroup(group) {
    // group 값이 팔레트에 존재하면 해당 팔레트를, 없으면 'default' 팔레트를 반환
    return colorPalettes[group] || colorPalettes['default'];
}