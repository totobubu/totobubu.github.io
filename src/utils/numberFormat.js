export function formatCurrency(value, currency = 'USD') {
    const num =
        typeof value === 'string'
            ? parseFloat(value.replace(/[^0-9.-]+/g, ''))
            : value;
    if (isNaN(num) || num === null) return value;

    const locale = currency === 'KRW' ? 'ko-KR' : 'en-US';
    const fractionDigits = currency === 'KRW' ? 0 : 2;

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(num);
}

export function formatLargeNumber(value, currency = 'USD') {
    const num =
        typeof value === 'string'
            ? parseFloat(value.replace(/[^0-9.-]+/g, ''))
            : value;
    if (isNaN(num) || num === null) return value;

    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    const prefix = currency === 'KRW' ? '₩' : '$';

    if (absNum >= 1.0e12) {
        return `${sign}${prefix}${(absNum / 1.0e12).toFixed(2)}T`;
    }
    if (absNum >= 1.0e9) {
        return `${sign}${prefix}${(absNum / 1.0e9).toFixed(2)}B`;
    }
    if (absNum >= 1.0e6) {
        return `${sign}${prefix}${(absNum / 1.0e6).toFixed(2)}M`;
    }
    if (absNum >= 1.0e3) {
        return `${sign}${prefix}${(absNum / 1.0e3).toFixed(2)}K`;
    }

    return `${sign}${prefix}${absNum}`;
}
