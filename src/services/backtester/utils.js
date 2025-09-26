// src\services\backtester\utils.js
export function addBusinessDays(utcDate, daysToAdd, holidays = []) {
    let currentDate = new Date(utcDate.getTime());
    let addedDays = 0;
    const holidaySet = new Set(holidays.map((h) => h.date));
    while (addedDays < daysToAdd) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        const dayOfWeek = currentDate.getUTCDay();
        const dateString = currentDate.toISOString().split('T')[0];
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateString)) {
            addedDays++;
        }
    }
    return currentDate;
}

export const calculateCAGR = (totalReturn, years) => {
    if (1 + totalReturn <= 0 || years <= 0) return -1;
    return Math.pow(1 + totalReturn, 1 / years) - 1;
};
