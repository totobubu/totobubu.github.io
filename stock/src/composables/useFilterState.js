import { ref } from 'vue';
import { FilterMatchMode } from '@primevue/core/api';

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    calendarSearch: { value: null, matchMode: FilterMatchMode.CONTAINS },
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS },
    yield: { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO } // [핵심] yield 필터 추가
});

export function useFilterState() {
    return { filters };
}