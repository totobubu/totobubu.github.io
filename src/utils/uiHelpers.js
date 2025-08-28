// [신규] 중복 함수 이동
export const getGroupSeverity = (group) => {
    switch (group) {
        case 'A':
            return 'danger';
        case 'B':
            return 'warning';
        case 'C':
            return 'success';
        case 'D':
            return 'info';
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
