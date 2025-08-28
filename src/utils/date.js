// src/utils/date.js
export const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map((part) => part.trim());
    if (parts.length !== 3) return null;
    return new Date(`20${parts[0]}`, parseInt(parts[1], 10) - 1, parts[2]);
};

// [신규] 중복 함수 이동
export const formatMonthsToYears = (totalMonths) => {
    if (totalMonths === -1) return '목표 달성'; // ReinvestmentCalculator용
    if (totalMonths === Infinity || isNaN(totalMonths) || totalMonths <= 0)
        return '계산 불가';
    const years = Math.floor(totalMonths / 12);
    const months = Math.round(totalMonths % 12);
    return years > 0 ? `${years}년 ${months}개월` : `${months}개월`;
};
