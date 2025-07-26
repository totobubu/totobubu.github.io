import { ref } from 'vue';
import { FilterMatchMode } from '@primevue/core/api';

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    calendarSearch: { value: null, matchMode: FilterMatchMode.CONTAINS },
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS }
});

export function useFilterState() {
    return { filters };
}