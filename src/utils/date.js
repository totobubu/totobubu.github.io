// src/utils/date.js
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
        // '달성 완료'의 경우 date는 null로 반환
        return { duration: '달성 완료', date: null };
    }
    if (!isFinite(totalMonths) || totalMonths <= 0) {
        // '계산 불가'의 경우 date는 null로 반환
        return { duration: '계산 불가', date: null };
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
        return { duration: durationString, date: null };
    }

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + Math.round(totalMonths));

    // --- [핵심 수정] ---
    // 년도를 4자리로, 월을 2자리로 포맷팅합니다.
    const futureYear = futureDate.getFullYear();
    const futureMonth = String(futureDate.getMonth() + 1).padStart(2, '0');
    const dateString = `${futureYear}. ${futureMonth}`;
    // --- // ---

    // 객체 형태로 반환합니다.
    return { duration: durationString, date: dateString };
}
