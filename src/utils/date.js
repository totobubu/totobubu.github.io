// REFACTORED: src/utils/date.js
export const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map((part) => parseInt(part.trim(), 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    let [year, month, day] = parts;

    const currentYearLastTwoDigits = new Date().getFullYear() % 100;
    if (year > currentYearLastTwoDigits + 1) {
        year += 1900;
    } else {
        year += 2000;
    }

    return new Date(year, month - 1, day);
};

export function formatMonthsToYears(totalMonths, includeFutureDate = false) {
    if (totalMonths === -1) {
        return '달성 완료';
    }
    if (!isFinite(totalMonths) || totalMonths <= 0) {
        return '계산 불가';
    }

    const years = Math.floor(totalMonths / 12);
    const months = Math.round(totalMonths % 12);

    let durationString = '';
    if (years > 0 && months > 0) {
        durationString = `${years}년 ${months}개월`;
    } else if (years > 0) {
        durationString = `${years}년`;
    } else {
        durationString = `${months}개월`;
    }

    if (!includeFutureDate) {
        return durationString;
    }

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + Math.round(totalMonths));

    const futureYear = futureDate.getFullYear().toString().slice(-2);
    const futureMonth = futureDate.getMonth() + 1;

    return `${durationString} | ${futureYear}년 ${futureMonth}월`;
}