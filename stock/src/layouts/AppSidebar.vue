<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { joinURL } from 'ufo'; // ufo 유틸리티를 사용하면 더 안전합니다.

// PrimeVue 컴포넌트 임포트
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import { FilterMatchMode } from '@primevue/core/api';

const router = useRouter();
const etfList = ref([]);
const isLoading = ref(true);
const error = ref(null);

// --- 필터링을 위한 상태 (group 필터 추가) ---
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS }, // 'group' 필터 상태 추가
});

// 드롭다운 필터를 위한 고유값 목록 (group 추가)
const companies = ref([]);
const frequencies = ref([]);
const groups = ref([]); // 'group' 목록 추가

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
</script>

<template>
    <div class="card">
        <div v-if="isLoading" class="flex justify-center items-center h-48">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-red-500">{{ error }}</div>

        <DataTable v-else :value="etfList" v-model:filters="filters" filterDisplay="row" dataKey="name"
            selectionMode="single" @rowSelect="onRowSelect"
            :globalFilterFields="['name', 'company', 'frequency', 'group']" class="p-datatable-sm" stripedRows
            resizableColumns columnResizeMode="fit" scrollable scrollHeight="calc(100vh - 120px)"
            tableStyle="max-width: 100%">

            <template #empty>
                <div class="text-center p-4">검색 결과가 없습니다.</div>
            </template>

            <Column field="name" header="티커" :showFilterMenu="false" sortable frozen class="font-bold">
                <template #body="{ data }">
                    <span class="font-bold">{{ data.name }}</span>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <InputText v-model="filterModel.value" @input="filterCallback()" placeholder="티커 검색"
                        class="p-column-filter" />
                </template>
            </Column>

            <!-- 1. 운용사 컬럼 스타일 수정 -->
            <Column field="company" header="운용사" :showFilterMenu="false" sortable>
                <template #body="{ data }">
                    <Tag :value="data.company" :severity="getCompanySeverity(data.company)" />
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="companies"
                        placeholder="운용사 선택" showClear class="p-column-filter" />
                </template>
            </Column>

            <Column field="frequency" header="지급주기" :showFilterMenu="false" sortable>
                <template #body="{ data }">
                    <Tag :value="data.frequency" :severity="getFrequencySeverity(data.frequency)" />
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="frequencies"
                        placeholder="주기 선택" showClear class="p-column-filter" />
                </template>
            </Column>

            <!-- 2. Group 컬럼 및 필터 (스타일링 적용) -->
            <Column field="group" header="그룹" :showFilterMenu="false" sortable>
                 <template #body="{ data }">
                    <!-- 본문에도 그룹 태그를 표시하고 싶다면, 이 주석을 해제하세요 -->
                    <Tag v-if="data.group" :value="data.group" :severity="getGroupSeverity(data.group)" />
                 </template>
                 <template #filter="{ filterModel, filterCallback }">
                     <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="groups" placeholder="그룹 선택" showClear class="p-column-filter">
                        <!-- 드롭다운의 각 옵션을 Tag로 표시 -->
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" :severity="getGroupSeverity(slotProps.option)" />
                        </template>
                     </Dropdown>
                </template>
            </Column>
        </DataTable>
    </div>
</template>