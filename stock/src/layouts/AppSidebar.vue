<!-- AppSidebar.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { joinURL } from 'ufo';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import RadioButton from 'primevue/radiobutton';
import { useFilterState } from '@/composables/useFilterState'; // 1. 전역 필터 상태 import

const router = useRouter();
const etfList = ref([]);
const isLoading = ref(true);
const error = ref(null);

const { filters } = useFilterState(); // 2. 전역 필터 상태 가져오기

const dialogsVisible = ref({
    company: false,
    frequency: false,
    group: false,
});

const companies = ref([]);
const frequencies = ref([]);
const groups = ref([]);

onMounted(async () => {
    try {
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Navigation data not found');
        const data = await response.json();
        etfList.value = data.nav;

        companies.value = [...new Set(data.nav.map(item => item.company))];
        frequencies.value = [...new Set(data.nav.map(item => item.frequency))];
        groups.value = [...new Set(data.nav.map(item => item.group).filter(g => g))];
    } catch (err) {
        error.value = "ETF 목록을 불러오는 데 실패했습니다.";
    } finally {
        isLoading.value = false;
    }
});

const onRowSelect = (event) => {
    const ticker = event.data.name;
    router.push(`/stock/${ticker.toLowerCase()}`);
};

const openFilterDialog = (filterName) => { dialogsVisible.value[filterName] = true; };
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
    <div class="card p-0">
        <div v-if="isLoading" class="flex justify-center items-center h-48">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-red-500">{{ error }}</div>

        <!-- 👇 3. DataTable은 이제 #header 슬롯이 없고, 전역 필터 상태를 사용합니다. -->
        <DataTable 
            v-else 
            :value="etfList" 
            v-model:filters="filters" 
            dataKey="name"
            selectionMode="single" 
            @rowSelect="onRowSelect"
            :globalFilterFields="['name', 'fullname']"
            class="p-datatable-sm" 
            stripedRows
            scrollable 
            scrollHeight="calc(100vh - 120px)"
        >
            <template #empty>
                <div class="text-center p-4">검색 결과가 없습니다.</div>
            </template>
            
            <Column field="name" header="티커" sortable frozen class="font-bold text-center"></Column>
            <Column field="company" sortable>
                <template #header>
                    <div class="column-header">
                        <Button type="button" icon="pi pi-filter-fill" text rounded size="small" @click="openFilterDialog('company')" :class="{ 'p-button-text': !filters.company.value }" />
                        <span>운용사</span>
                        
                    </div>
                </template>
                <template #body="{ data }"><Tag :value="data.company" /></template>
            </Column>
            
            <Column field="frequency" sortable>
                <template #header>
                    <div class="column-header">
                        <Button type="button" icon="pi pi-filter-fill" text rounded size="small" @click="openFilterDialog('frequency')" :class="{ 'p-button-text': !filters.frequency.value }" />
                        <span>지급주기</span>
                        
                    </div>
                </template>
                <template #body="{ data }"><Tag :value="data.frequency" /></template>
            </Column>
            
            <Column field="group" sortable>
                 <template #header>
                    <div class="column-header">
                        <Button type="button" icon="pi pi-filter-fill" text rounded size="small" @click="openFilterDialog('group')" :class="{ 'p-button-text': !filters.group.value }" />
                        <span>그룹</span>
                        
                    </div>
                 </template>
                 <template #body="{ data }"><Tag v-if="data.group" :value="data.group" :severity="getGroupSeverity(data.group)" /></template>
            </Column>
        </DataTable>

        <!-- 독립적인 Dialog들 (변경 없음) -->
        <Dialog v-model:visible="dialogsVisible.company" modal header="운용사 필터" :style="{ width: '80vw' }" :breakpoints="{ '576px': '95vw' }">
            <div class="filter-options">
                <div class="flex align-items-center"><RadioButton v-model="filters.company.value" inputId="companyAll" name="company" :value="null" @change="dialogsVisible.company = false" /><label for="companyAll" class="ml-2">전체</label></div>
                <div v-for="company in companies" :key="company" class="flex align-items-center"><RadioButton v-model="filters.company.value" :inputId="company" name="company" :value="company" @change="dialogsVisible.company = false" /><label :for="company" class="ml-2">{{ company }}</label></div>
            </div>
        </Dialog>
        
        <Dialog v-model:visible="dialogsVisible.frequency" modal header="지급주기 필터" :style="{ width: '80vw' }" :breakpoints="{ '576px': '95vw' }">
             <div class="filter-options">
                <div class="flex align-items-center"><RadioButton v-model="filters.frequency.value" inputId="freqAll" name="frequency" :value="null" @change="dialogsVisible.frequency = false" /><label for="freqAll" class="ml-2">전체</label></div>
                <div v-for="freq in frequencies" :key="freq" class="flex align-items-center"><RadioButton v-model="filters.frequency.value" :inputId="freq" name="frequency" :value="freq" @change="dialogsVisible.frequency = false" /><label :for="freq" class="ml-2">{{ freq }}</label></div>
            </div>
        </Dialog>

        <Dialog v-model:visible="dialogsVisible.group" modal header="그룹 필터" :style="{ width: '80vw' }" :breakpoints="{ '576px': '95vw' }">
             <div class="filter-options">
                <div class="flex align-items-center"><RadioButton v-model="filters.group.value" inputId="groupAll" name="group" :value="null" @change="dialogsVisible.group = false" /><label for="groupAll" class="ml-2">전체</label></div>
                <div v-for="group in groups" :key="group" class="flex align-items-center"><RadioButton v-model="filters.group.value" :inputId="group" name="group" :value="group" @change="dialogsVisible.group = false" /><label :for="group" class="ml-2"><Tag :value="group" :severity="getGroupSeverity(group)" /></label></div>
            </div>
        </Dialog>
    </div>
</template>