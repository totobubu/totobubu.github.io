<script setup>
// ... (script 부분은 변경 없음)
import { computed, ref } from 'vue';
import { useSidebar } from '@/composables/useSidebar.js';
import { useBreakpoint } from '@/composables/useBreakpoint.js';
import { getGroupSeverity } from '@/utils/uiHelpers.js';
import { user } from '../store/auth';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import SelectButton from 'primevue/selectbutton';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import ToggleButton from 'primevue/togglebutton';
import CompanyLogo from '@/components/CompanyLogo.vue';
import FilterInput from '@/components/FilterInput.vue';

const {
    isLoading, error, selectedTicker, filters, showMyStocksOnly, myBookmarks,
    marketTypeOptions, filteredTickers, dialogsVisible, companies, frequencies, groups,
    handleBookmarkToggle, handleStockBookmarkClick, onRowSelect, openFilterDialog, selectFilter,
} = useSidebar();

const { isMobile } = useBreakpoint();
const skeletonItems = ref(new Array(15));
const tableSize = computed(() => (isMobile.value ? 'small' : null));

</script>

<template>
    <div class="flex flex-column  h-full">
        <div class="flex flex-column gap-3 p-3">
            <SelectButton 
                v-model="filters.marketType.value" 
                :options="marketTypeOptions" 
                class="w-full"
            />
            <FilterInput
                v-model="filters.global.value"
                title="전체 티커 검색"
                filter-type="global" />
        </div>

        <div v-if="error" class="text-red-500 p-4">{{ error }}</div>

        <!-- [핵심 수정] 부모 div에 스크롤을 적용하고, DataTable의 높이 관련 속성을 제거합니다. -->
        <div class="flex-grow-1 overflow-y-auto">
            <DataTable
                v-if="!error"
                id="toto-search-datatable"
                :value="isLoading ? skeletonItems : filteredTickers"
                v-model:filters="filters"
                v-model:selection="selectedTicker"
                dataKey="symbol"
                selectionMode="single"
                @rowSelect="onRowSelect"
                :globalFilterFields="['symbol', 'longName', 'company']"
                stripedRows
                :size="tableSize"
                :class="{ 'p-datatable-loading': isLoading }">
                <template #empty>
                    <div class="text-center p-4">검색 결과가 없습니다.</div>
                </template>
                <!-- ... 이하 Column 정의는 모두 동일 ... -->
                <Column frozen class="toto-column-bookmark">
                    <template #header>
                        <ToggleButton
                            :modelValue="showMyStocksOnly"
                            @click.stop="handleBookmarkToggle"
                            :disabled="!user"
                            onIcon="pi pi-bookmark-fill"
                            offIcon="pi pi-bookmark"
                            onLabel="" offLabel="" aria-label="내 종목만 보기" />
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading" shape="circle" size="1rem"></Skeleton>
                        <i v-else class="pi" :class="user && myBookmarks[data.symbol] ? 'pi-bookmark-fill text-primary' : 'pi-bookmark'"
                            @click.stop="handleStockBookmarkClick(data.symbol)"></i>
                    </template>
                </Column>
                <Column field="symbol" sortable frozen class="font-bold toto-column-ticker">
                    <template #header>
                        <span>{{ isMobile ? '' : '티커' }}</span>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <span v-else>{{ data.symbol }}</span>
                    </template>
                </Column>
                <Column field="company" sortable class="toto-column-company">
                    <template #header>
                        <Button type="button" icon="pi pi-filter-fill" size="small" :variant="filters.company.value ? 'filled' : 'text'"
                            @click="openFilterDialog('company')" :severity="filters.company.value ? '' : 'secondary'" />
                        <span v-if="!isMobile">회사</span>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading" width="3rem" height="3rem"></Skeleton>
                        <CompanyLogo v-else :logo-src="data.logo" :company-name="data.company" />
                    </template>
                </Column>
                <Column field="frequency" sortable class="toto-column-frequency">
                    <template #header>
                        <Button type="button" icon="pi pi-filter-fill" size="small" :variant="filters.frequency.value ? 'filled' : 'text'"
                            @click="openFilterDialog('frequency')" :severity="filters.frequency.value ? '' : 'secondary'" />
                        <span v-if="!isMobile">지급</span>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <span v-else>{{ data.frequency }}</span>
                    </template>
                </Column>
                <Column field="yield" sortable class="toto-column-yield">
                    <template #header>
                        <span v-if="!isMobile">배당률</span>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <span v-else class="text-surface-500">{{ data.yield }}</span>
                    </template>
                </Column>
                <Column field="group" sortable class="toto-column-group" sortField="groupOrder">
                    <template #header>
                        <span v-if="!isMobile">그룹</span>
                    </template>
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <Tag v-else-if="data.group" :value="data.group" :severity="getGroupSeverity(data.group)" />
                    </template>
                </Column>
            </DataTable>
        </div>
        
        <!-- ... 이하 Dialog 정의는 모두 동일 ... -->
        <Dialog v-model:visible="dialogsVisible.company" modal header="운용사 필터" :style="{ width: '600px' }" :breakpoints="{ '576px': '95vw' }">
            <div class="filter-button-group">
                <ToggleButton onLabel="전체" offLabel="전체" :modelValue="filters.company.value === null" @update:modelValue="selectFilter('company', null)" class="p-button-sm" />
                <ToggleButton v-for="company in companies" :key="company" :onLabel="company" :offLabel="company" :modelValue="filters.company.value === company" @update:modelValue="selectFilter('company', company)" class="p-button-sm" />
            </div>
        </Dialog>
        <Dialog v-model:visible="dialogsVisible.frequency" modal header="지급주기 필터" :style="{ width: '576px' }">
            <div class="filter-button-group">
                <ToggleButton onLabel="전체" offLabel="전체" :modelValue="filters.frequency.value === null" @update:modelValue="selectFilter('frequency', null)" class="p-button-sm" />
                <ToggleButton v-for="freq in frequencies" :key="freq" :onLabel="freq" :offLabel="freq" :modelValue="filters.frequency.value === freq" @update:modelValue="selectFilter('frequency', freq)" class="p-button-sm" />
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
/* ... (style 부분은 이전과 동일) ... */
.toto-column-bookmark .p-column-header-content,
.toto-column-bookmark .p-column-content {
    display: flex;
    justify-content: center;
    align-items: center;
}
.toto-column-bookmark .p-button {
    width: 2.5rem;
    height: 2.5rem;
}
.p-datatable-loading :deep(.p-datatable-tbody > tr > td) {
    text-align: center;
}
.p-column-header-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
:deep(.p-selectbutton) {
    display: flex;
}
:deep(.p-selectbutton .p-button) {
    flex: 1;
}
</style>