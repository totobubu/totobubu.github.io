<!-- AppSidebar.vue (또는 해당 테이블이 있는 컴포넌트) -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { joinURL } from 'ufo';

// 필요한 PrimeVue 컴포넌트들
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button';
import OverlayPanel from 'primevue/overlaypanel';
import AutoComplete from 'primevue/autocomplete';
import RadioButton from 'primevue/radiobutton';
import { FilterMatchMode } from '@primevue/core/api';
import { useBreakpoint } from '@/composables/useBreakpoint';

// isDesktop 상태를 가져와 UI 분기에 사용
const { isDesktop } = useBreakpoint();
const router = useRouter();
const etfList = ref([]);
const isLoading = ref(true);
const error = ref(null);

const filters = ref({
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS },
});

// 모든 필터 타입에서 공용으로 사용할 상태들
const tickerSuggestions = ref([]);
const allTickers = ref([]);
const companies = ref([]);
const frequencies = ref([]);
const groups = ref([]);

// OverlayPanel을 제어하기 위한 ref들 (모바일/태블릿용)
const opTicker = ref();
const opCompany = ref();
const opFrequency = ref();
const opGroup = ref();

onMounted(async () => {
    try {
        const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Navigation data not found');
        const data = await response.json();
        etfList.value = data.nav;

        allTickers.value = data.nav.map(item => item.name);
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

const searchTicker = (event) => {
    tickerSuggestions.value = allTickers.value.filter(t => t.toLowerCase().includes(event.query.toLowerCase()));
};

// OverlayPanel 토글 함수들
const toggleTickerFilter = (event) => opTicker.value.toggle(event);
const toggleCompanyFilter = (event) => opCompany.value.toggle(event);
const toggleFrequencyFilter = (event) => opFrequency.value.toggle(event);
const toggleGroupFilter = (event) => opGroup.value.toggle(event);

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
    <div class="card">
        <div v-if="isLoading" class="flex justify-center items-center h-48">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-red-500">{{ error }}</div>

        <DataTable 
            v-else 
            :value="etfList" 
            v-model:filters="filters" 
            :filterDisplay="isDesktop ? 'row' : 'menu'"
            dataKey="name"
            selectionMode="single" 
            @rowSelect="onRowSelect"
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
            
            <!-- 👇 각 컬럼의 헤더와 필터 부분을 isDesktop으로 분기 처리 -->
            <Column field="name" sortable frozen class="font-bold text-center toto-column-ticker">
                <template #header>
                    <div class="column-header">
                        <span>티커</span>
                        <Button v-if="!isDesktop" type="button" icon="pi pi-filter" text rounded @click="toggleTickerFilter" />
                    </div>
                </template>
                <template #body="{ data }"><span class="font-bold">{{ data.name }}</span></template>
                <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                    <InputText v-model="filterModel.value" @input="filterCallback()" placeholder="티커 검색" class="p-column-filter" />
                </template>
            </Column>

            <Column field="company" sortable class="text-center toto-column-company">
                <template #header>
                    <div class="column-header">
                        <span>운용사</span>
                        <Button v-if="!isDesktop" type="button" icon="pi pi-filter" text rounded @click="toggleCompanyFilter" />
                    </div>
                </template>
                <template #body="{ data }"><Tag :value="data.company" :severity="getCompanySeverity(data.company)" /></template>
                <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                    <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="companies" placeholder="운용사 선택" showClear class="p-column-filter" />
                </template>
            </Column>

            <Column field="frequency" sortable class="text-center toto-column-frequency">
                <template #header>
                    <div class="column-header">
                        <span>지급주기</span>
                        <Button v-if="!isDesktop" type="button" icon="pi pi-filter" text rounded @click="toggleFrequencyFilter" />
                    </div>
                </template>
                <template #body="{ data }"><Tag :value="data.frequency" :severity="getFrequencySeverity(data.frequency)" /></template>
                <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                    <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="frequencies" placeholder="주기 선택" showClear class="p-column-filter" />
                </template>
            </Column>

            <Column field="group" sortable class="text-center toto-column-group">
                <template #header>
                    <div class="column-header">
                        <span>그룹</span>
                        <Button v-if="!isDesktop" type="button" icon="pi pi-filter" text rounded @click="toggleGroupFilter" />
                    </div>
                </template>
                 <template #body="{ data }"><Tag v-if="data.group" :value="data.group" :severity="getGroupSeverity(data.group)" /></template>
                 <template #filter="{ filterModel, filterCallback }" v-if="isDesktop">
                     <Dropdown v-model="filterModel.value" @change="filterCallback()" :options="groups" placeholder="그룹 선택" showClear class="p-column-filter">
                        <template #option="slotProps"><Tag :value="slotProps.option" :severity="getGroupSeverity(slotProps.option)" /></template>
                     </Dropdown>
                </template>
            </Column>
        </DataTable>

        <!-- 👇 OverlayPanel들은 모바일/태블릿에서만 사용되지만, 항상 DOM에 존재하도록 둡니다. -->
        <OverlayPanel ref="opTicker" class="p-fluid"><AutoComplete v-model="filters.name.value" :suggestions="tickerSuggestions" @complete="searchTicker" placeholder="티커 검색" autofocus /></OverlayPanel>
        <OverlayPanel ref="opCompany" class="p-fluid"><div class="filter-options">
            <div v-for="company in companies" :key="company" class="flex align-items-center"><RadioButton v-model="filters.company.value" :inputId="company" name="company" :value="company" /><label :for="company" class="ml-2">{{ company }}</label></div>
            <div class="flex align-items-center"><RadioButton v-model="filters.company.value" inputId="companyAll" name="company" :value="null" /><label for="companyAll" class="ml-2">전체</label></div>
        </div></OverlayPanel>
        <OverlayPanel ref="opFrequency" class="p-fluid"><div class="filter-options">
            <div v-for="freq in frequencies" :key="freq" class="flex align-items-center"><RadioButton v-model="filters.frequency.value" :inputId="freq" name="frequency" :value="freq" /><label :for="freq" class="ml-2">{{ freq }}</label></div>
            <div class="flex align-items-center"><RadioButton v-model="filters.frequency.value" inputId="freqAll" name="frequency" :value="null" /><label for="freqAll" class="ml-2">전체</label></div>
        </div></OverlayPanel>
        <OverlayPanel ref="opGroup" class="p-fluid"><div class="filter-options">
            <div v-for="group in groups" :key="group" class="flex align-items-center"><RadioButton v-model="filters.group.value" :inputId="group" name="group" :value="group" /><label :for="group" class="ml-2"><Tag :value="group" :severity="getGroupSeverity(group)" /></label></div>
            <div class="flex align-items-center"><RadioButton v-model="filters.group.value" inputId="groupAll" name="group" :value="null" /><label for="groupAll" class="ml-2">전체</label></div>
        </div></OverlayPanel>
    </div>
</template>

<style scoped>
.column-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}
.filter-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.5rem;
}
</style>