// REFACTORED: src/utils/uiHelpers.js
export const getGroupSeverity = (group) => {
    switch (group) {
        case '월':
            return 'mon';
        case '화':
            return 'tue';
        case '수':
            return 'wed';
        case '목':
            return 'thu';
        case '금':
            return 'fri';
        default:
            return 'secondary';
    }
};
