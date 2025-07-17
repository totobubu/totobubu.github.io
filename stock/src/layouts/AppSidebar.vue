<!-- AppSidebar.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { joinURL } from 'ufo';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button'; // 1. Button 컴포넌트 추가
import Dialog from 'primevue/dialog'; // 2. Dialog 컴포넌트 추가
import { FilterMatchMode } from '@primevue/core/api';
import { useBreakpoint } from '@/composables/useBreakpoint';

const { isDesktop } = useBreakpoint(); // isDesktop만 필요
const router = useRouter();
const etfList = ref([]);
const isLoading = ref(true);
const error = ref(null);

// --- [핵심 수정 1] 다이얼로그 표시 여부를 위한 상태 ---
const isFilterDialogVisible = ref(false);

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS },
});

const companies = ref([]);
const frequencies = ref([]);
const groups = ref([]);

// --- 데이터 로딩 ---
onMounted(async () => {
    try {
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        console.log('Fetching nav data from:', url); // 디버깅용 로그

        const response = await fetch(url); 
        if (!response.ok) throw new Error('Navigation data not found');
        const data = await response.json();

        etfList.value = data.nav;

        // 필터용 고유값 목록 생성 (group 추가)
        companies.value = [...new Set(data.nav.map(item => item.company))];
        frequencies.value = [...new Set(data.nav.map(item => item.frequency))];
        // 'group' 값이 비어있지 않은 경우에만 필터 옵션에 추가
        groups.value = [...new Set(data.nav.map(item => item.group).filter(g => g))];

    } catch (err) {
        console.error("Error fetching nav.json:", err);
        error.value = "ETF 목록을 불러오는 데 실패했습니다.";
    } finally {
        isLoading.value = false;
    }
});

// 행 클릭 시 페이지 이동 함수 (수정 없음)
const onRowSelect = (event) => {
    const ticker = event.data.name;
    router.push(`/stock/${ticker.toLowerCase()}`);
};


// --- Tag 컴포넌트 스타일링을 위한 함수들 ---
const getCompanySeverity = (company) => {
    switch (company) {
        case 'Roundhill': return 'secondary';
        case 'YieldMax': return 'secondary';
        case 'J.P. Morgan': return 'secondary';
        case 'GraniteShares': return 'secondary';
        // 필요한 만큼 운용사 추가
        default: return 'secondary';
    }
};

const getFrequencySeverity = (frequency) => {
    switch (frequency) {
        case 'Weekly': return 'secondary';
        case 'Monthly': return 'secondary';
        case 'Quarterly': return 'secondary';
        case 'Every 4 Week': return 'secondary';
        default: return 'secondary';
    }
};

// 1. Group을 위한 스타일링 함수 추가
const getGroupSeverity = (group) => {
    switch (group) {
        case 'A': return 'danger';
        case 'B': return 'warn';
        case 'C': return 'success';
        case 'D': return 'info';
        default: return 'secondary';
    }
};

// --- [핵심 수정 2] 필터 초기화 함수 ---
const clearFilters = () => {
    filters.value.name.value = null;
    filters.value.company.value = null;
    filters.value.frequency.value = null;
    filters.value.group.value = null;
};
</script>

<template>
    <div class="card">
        <div v-if="isLoading" class="flex justify-center items-center h-48">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-red-500">{{ error }}</div>

        <template v-else>
            <!-- 👇 [핵심 수정 3] 테이블 상단에 필터 버튼 추가 (모바일/태블릿 전용) -->
            <div class="table-header" v-if="!isDesktop">
                <Button label="필터" icon="pi pi-filter" @click="isFilterDialogVisible = true" />
            </div>

            <DataTable 
                :value="etfList" 
                v-model:filters="filters" 
                :filterDisplay="isDesktop ? 'row' : 'menu'" 
                dataKey="name"
                selectionMode="single" 
                @rowSelect="onRowSelect"
                :globalFilterFields="['name', 'company', 'frequency', 'group']" 
                class="p-datatable-sm" 
                stripedRows
                resizableColumns 
                columnResizeMode="fit" 
                scrollable 
                scrollHeight="calc(100vh - 120px)"
                tableStyle="max-width: 100%"
            >
                <template #empty>
                    <div class="text-center p-4">검색 결과가 없습니다.</div>
                </template>

                <!-- 👇 [핵심 수정 4] 컬럼 필터 템플릿을 isDesktop 조건으로 분기 -->
                <Column field="name" header="티커" sortable frozen class="font-bold text-center toto-column-ticker">
                    <template #body="{ data }">
                        <span class="font-bold">{{ data.name }}</span>
                    </template>
                    <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                        <InputText v-model="filterModel.value" @input="filterCallback()" placeholder="티커 검색" class="p-column-filter" />
                    </template>
                </Column>
                
                <Column field="company" header="운용사" sortable class="text-center toto-column-company">
                    <template #body="{ data }">
                        <Tag :value="data.company" :severity="getCompanySeverity(data.company)" />
                    </template>
                    <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                        <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="companies" placeholder="운용사 선택" showClear class="p-column-filter" />
                    </template>
                </Column>

                <Column field="frequency" header="지급주기" sortable class="text-center toto-column-frequency">
                    <template #body="{ data }">
                        <Tag :value="data.frequency" :severity="getFrequencySeverity(data.frequency)" />
                    </template>
                     <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                        <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="frequencies" placeholder="주기 선택" showClear class="p-column-filter" />
                    </template>
                </Column>

                <Column field="group" header="그룹" sortable class="text-center toto-column-group">
                     <template #body="{ data }">
                        <Tag v-if="data.group" :value="data.group" :severity="getGroupSeverity(data.group)" />
                     </template>
                     <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                         <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="groups" placeholder="그룹 선택" showClear class="p-column-filter">
                            <template #option="slotProps">
                                <Tag :value="slotProps.option" :severity="getGroupSeverity(slotProps.option)" />
                            </template>
                         </Dropdown>
                    </template>
                </Column>
            </DataTable>

            <!-- 👇 [핵심 수정 5] 필터 다이얼로그 (모바일/태블릿 전용) -->
            <Dialog 
                v-model:visible="isFilterDialogVisible" 
                modal 
                header="필터" 
                :style="{ width: '80vw' }" 
                :breakpoints="{ '576px': '95vw' }"
            >
                <div class="filter-dialog-content">
                    <div class="filter-item">
                        <label for="ticker-filter">티커</label>
                        <InputText id="ticker-filter" v-model="filters.name.value" placeholder="티커 검색" class="w-full" />
                    </div>
                    <div class="filter-item">
                        <label for="company-filter">운용사</label>
                        <Dropdown id="company-filter" v-model="filters.company.value" :options="companies" placeholder="운용사 선택" showClear class="w-full" />
                    </div>
                    <div class="filter-item">
                        <label for="frequency-filter">지급주기</label>
                        <Dropdown id="frequency-filter" v-model="filters.frequency.value" :options="frequencies" placeholder="주기 선택" showClear class="w-full" />
                    </div>
                    <div class="filter-item">
                        <label for="group-filter">그룹</label>
                        <Dropdown id="group-filter" v-model="filters.group.value" :options="groups" placeholder="그룹 선택" showClear class="w-full">
                            <template #option="slotProps">
                                <Tag :value="slotProps.option" :severity="getGroupSeverity(slotProps.option)" />
                            </template>
                        </Dropdown>
                    </div>
                </div>
                <template #footer>
                    <Button label="초기화" icon="pi pi-times" @click="clearFilters" text />
                    <Button label="적용" icon="pi pi-check" @click="isFilterDialogVisible = false" autofocus />
                </template>
            </Dialog>
        </template>
    </div>
</template>

<style scoped>
.table-header {
    padding: 1rem;
    text-align: right;
}
.filter-dialog-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}
.filter-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
</style>