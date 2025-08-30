// src/utils/date.js
export const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map((part) => part.trim());
    if (parts.length !== 3) return null;
    return new Date(`20${parts[0]}`, parseInt(parts[1], 10) - 1, parts[2]);
};

export function formatMonthsToYears(totalMonths) {
    // 목표 달성 완료 (음수 값으로 체크)
    if (totalMonths === -1) {
        return '달성 완료';
    }
    // Infinity, NaN, 0 이하 등 계산 불가능한 경우
    if (!isFinite(totalMonths) || totalMonths <= 0) {
        return '계산 불가';
    }

    const years = Math.floor(totalMonths / 12);
    const months = Math.round(totalMonths % 12);

    if (years > 0 && months > 0) {
        return `${years}년 ${months}개월`;
    }
    if (years > 0) {
        return `${years}년`;
    }
    return `${months}개월`;
}
