// src/utils/formatters.js

export function formatCurrency(value, currency = 'USD', options = {}) {
    if (value === null || typeof value === 'undefined' || isNaN(value)) {
        return options.defaultValue || 'N/A';
    }

    const { showSymbol = true, decimals = -1 } = options;

    const formatter = new Intl.NumberFormat(
        currency === 'KRW' ? 'ko-KR' : 'en-US',
        {
            style: 'currency',
            currency: currency,
            minimumFractionDigits:
                decimals === -1 ? (currency === 'KRW' ? 0 : 2) : decimals,
            maximumFractionDigits:
                decimals === -1 ? (currency === 'KRW' ? 0 : 6) : decimals,
        }
    );

    let formatted = formatter.format(value);

    if (!showSymbol) {
        formatted = formatted.replace(/[₩$]/g, '').trim();
    }

    // 불필요한 소수점 0 제거
    if (currency === 'USD' && formatted.includes('.')) {
        formatted = formatted.replace(/\.?0+$/, '');
    }

    return formatted;
}

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

    return formatCurrency(num, currency, { showSymbol: false });
}
