// src/utils/numberFormat.js

export function formatLargeNumber(value) {
    // 입력값이 문자열일 경우, 숫자 변환을 위해 '$'나 ',' 같은 문자를 제거합니다.
    const num =
        typeof value === 'string'
            ? parseFloat(value.replace(/[^0-9.-]+/g, ''))
            : value;

    if (isNaN(num) || num === null) {
        return value; // 숫자로 변환할 수 없으면 원본 값을 반환
    }

    const absNum = Math.abs(num);

    if (absNum >= 1.0e12) {
        return (num / 1.0e12).toFixed(2) + 'T'; // Trillion
    }
    if (absNum >= 1.0e9) {
        return (num / 1.0e9).toFixed(2) + 'B'; // Billion
    }
    if (absNum >= 1.0e6) {
        return (num / 1.0e6).toFixed(2) + 'M'; // Million
    }
    if (absNum >= 1.0e3) {
        return (num / 1.0e3).toFixed(2) + 'K'; // Thousand
    }

    // 1000 미만의 숫자는 그대로 반환
    return num.toString();
}
