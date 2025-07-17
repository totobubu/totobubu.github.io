// stock/src/composables/useFilterState.js
import { ref } from 'vue';
import { FilterMatchMode } from '@primevue/core/api';

// 앱 전체에서 공유될 필터 상태
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS },
});

export function useFilterState() {
    return {
        filters
    };
}