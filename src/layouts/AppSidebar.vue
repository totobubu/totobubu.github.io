<!-- src\layouts\AppSidebar.vue -->
<script setup>
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
    import CompanyLogo from '@/components/CompanyLogo.vue';
    import FilterInput from '@/components/FilterInput.vue';

    const {
        isLoading,
        error,
        selectedTicker,
        globalSearchQuery,
        mainFilterTab,
        subFilterTab,
        myBookmarks,
        filteredTickers,
        handleStockBookmarkClick,
        onRowSelect,
        handleTickerRequest,
    } = useSidebar();

    const { isMobile } = useBreakpoint();
    const skeletonItems = ref(new Array(25));
    const tableSize = computed(() => (isMobile.value ? 'small' : null));

    // [수정] 옵션을 단순 문자열 배열로 변경
    const mainFilterOptions = ref(['북마크', '미국', '한국']);
    const subFilterOptions = ref(['ETF', '주식']);
</script>

<template>
    <div class="h-full">
        <div class="flex flex-column gap-3 p-3">
            <!-- [수정] v-model을 mainFilterTab에 직접 연결하고 템플릿 단순화 -->
            <SelectButton
                v-model="mainFilterTab"
                :options="mainFilterOptions"
                class="w-full" />

            <SelectButton
                v-if="mainFilterTab === '미국' || mainFilterTab === '한국'"
                v-model="subFilterTab"
                :options="subFilterOptions"
                class="w-full" />

            <FilterInput v-model="globalSearchQuery" title="전체 주식 검색" />
        </div>

        <div v-if="error" class="text-red-500 p-4">{{ error }}</div>

        <div class="flex-grow-1 overflow-hidden">
            <DataTable
                v-if="!error"
                id="toto-search-datatable"
                :value="isLoading ? skeletonItems : filteredTickers"
                v-model:selection="selectedTicker"
                :globalFilter="globalSearchQuery"
                dataKey="symbol"
                selectionMode="single"
                @rowSelect="onRowSelect"
                :globalFilterFields="[
                    'symbol',
                    'longName',
                    'koName',
                    'company',
                ]"
                stripedRows
                scrollable
                scrollHeight="flex"
                :size="tableSize"
                :class="{ 'p-datatable-loading': isLoading }"
                class="h-full">
                <template #empty>
                    <div
                        v-if="mainFilterTab === '북마크'"
                        class="text-center p-4">
                        <p v-if="!user" class="mb-2">
                            로그인 후 종목을 북마크에 추가해 보세요.
                        </p>
                        <p
                            v-else-if="Object.keys(myBookmarks).length === 0"
                            class="mb-2">
                            아직 추가된 북마크가 없습니다.<br />종목 왼쪽의
                            아이콘을 클릭하여 추가하세요.
                        </p>
                        <p v-else>검색 결과가 없습니다.</p>
                    </div>
                    <div v-else class="text-center p-4">
                        검색 결과가 없습니다.
                    </div>
                </template>
                <Column frozen class="toto-column-bookmark">
                    <template #body="{ data }">
                        <Skeleton
                            v-if="isLoading"
                            shape="circle"
                            size="1rem"></Skeleton>
                        <i
                            v-else
                            class="pi"
                            :class="
                                user && myBookmarks[data.symbol]
                                    ? 'pi-bookmark-fill text-primary'
                                    : 'pi-bookmark'
                            "
                            @click.stop="
                                handleStockBookmarkClick(data.symbol)
                            "></i>
                    </template>
                </Column>
                <Column
                    field="symbol"
                    sortable
                    frozen
                    class="font-bold toto-column-ticker">
                    <template #header
                        ><span>{{ isMobile ? '' : '티커' }}</span></template
                    >
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <span v-else>{{ data.koName || data.symbol }}</span>
                    </template>
                </Column>
                <Column field="company" sortable class="toto-column-company">
                    <template #header
                        ><span v-if="!isMobile">회사</span></template
                    >
                    <template #body="{ data }">
                        <Skeleton
                            v-if="isLoading"
                            width="3rem"
                            height="3rem"></Skeleton>
                        <CompanyLogo
                            v-else
                            :logo-src="data.logo"
                            :company-name="data.company" />
                    </template>
                </Column>
                <Column
                    field="frequency"
                    sortable
                    class="toto-column-frequency">
                    <template #header
                        ><span v-if="!isMobile">지급</span></template
                    >
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <span v-else>{{ data.frequency }}</span>
                    </template>
                </Column>
                <Column
                    field="group"
                    sortable
                    class="toto-column-group"
                    sortField="groupOrder">
                    <template #header
                        ><span v-if="!isMobile">그룹</span></template
                    >
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <Tag
                            v-else-if="data.group"
                            :value="data.group"
                            :severity="getGroupSeverity(data.group)" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
    :deep(.p-selectbutton) {
        display: flex;
    }
    :deep(.p-selectbutton .p-button) {
        flex: 1;
        font-size: 0.875rem;
        justify-content: center;
    }
    :deep(.p-selectbutton .p-button .pi) {
        margin-right: 0.5rem;
    }
    .toto-column-bookmark .p-column-header-content,
    .toto-column-bookmark .p-column-content {
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .p-datatable-loading :deep(.p-datatable-tbody > tr > td) {
        text-align: center;
    }
    .p-column-header-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
</style>
