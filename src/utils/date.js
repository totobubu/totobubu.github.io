// src/utils/date.js
export const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map((part) => parseInt(part.trim(), 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    let [year, month, day] = parts;

    // [핵심 수정] Y2K 문제 해결 로직
    // 두 자리 연도가 현재 연도(두 자리) + 1 보다 크면 1900년대로 간주
    // 예: 현재 2024년. '89'는 25보다 크므로 1989년. '15'는 25보다 작으므로 2015년.
    const currentYearLastTwoDigits = new Date().getFullYear() % 100;
    if (year > currentYearLastTwoDigits + 1) {
        year += 1900;
    } else {
        year += 2000;
    }

    // Date 객체 생성 시 월은 0부터 시작하므로 1을 빼줍니다.
    return new Date(year, month - 1, day);
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
