// src/utils/formatters.js

/**
 * 숫자 값을 통화 형식의 문자열로 변환합니다.
 * @param {number | null | undefined} value - 포맷팅할 숫자
 * @param {string} currency - 'USD' 또는 'KRW'
 * @param {object} options - 추가 옵션 (showSymbol, decimals)
 * @returns {string} 포맷팅된 문자열
 */
export function formatCurrency(value, currency = 'USD', options = {}) {
    if (value === null || typeof value === 'undefined' || isNaN(value)) {
        return options.defaultValue || 'N/A';
    }

    const { showSymbol = true } = options;
    const numberValue = Number(value);

    const formatter = new Intl.NumberFormat(
        currency === 'KRW' ? 'ko-KR' : 'en-US',
        {
            style: 'currency',
            currency: currency,
            minimumFractionDigits:
                currency === 'KRW' || numberValue === Math.floor(numberValue)
                    ? 0
                    : 2,
            maximumFractionDigits: currency === 'KRW' ? 0 : 6,
        }
    );

    let formatted = formatter.format(numberValue);

    if (!showSymbol) {
        formatted = formatted.replace(/[₩$]/g, '').trim();
    }

    return formatted;
}

/**
 * 큰 숫자를 T, B, M, K 또는 조, 억, 만 단위로 축약합니다.
 * @param {number | null | undefined} value - 축약할 숫자
 * @param {string} currency - 'USD' 또는 'KRW'
 * @returns {string} 축약된 숫자 문자열 (통화 기호 없음)
 */
export function formatLargeNumber(value, currency = 'USD') {
    if (value === null || typeof value === 'undefined' || isNaN(value))
        return 'N/A';

    const num = Number(value);
    const units =
        currency === 'KRW'
            ? { 경: 1.0e16, 조: 1.0e12, 억: 1.0e8, 만: 1.0e4 }
            : { T: 1.0e12, B: 1.0e9, M: 1.0e6, K: 1.0e3 };

    for (const [unit, threshold] of Object.entries(units)) {
        if (Math.abs(num) >= threshold) {
            return `${(num / threshold).toFixed(2)}${unit}`;
        }
    }

    // 축약되지 않는 작은 숫자는 쉼표만 추가하여 반환
    return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'en-US').format(
        num
    );
}

/**
 * 숫자를 퍼센트 문자열로 변환합니다.
 * @param {number | null | undefined} value - 비율 값 (예: 0.05)
 * @returns {string} 퍼센트 문자열 (예: "5.00%")
 */
export function formatPercent(value) {
    if (value === null || typeof value === 'undefined' || isNaN(value))
        return 'N/A';
    // [수정] 0일 경우 0.00%를 반환하도록 함
    return `${(Number(value) * 100).toFixed(2)}%`;
}
