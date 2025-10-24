<!-- src/layouts/AppSidebar.vue -->

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

    // [핵심 수정] 깃발 아이콘(SVG)을 지원하도록 옵션 구조 변경
    const mainFilterOptions = ref([
        {
            type: 'icon',
            icon: 'pi pi-bookmark',
            value: '북마크',
            label: '북마크',
        },
        {
            type: 'flag',
            flagSrc: '/flags/us.svg',
            value: '미국',
            label: '미국 주식',
        },
        {
            type: 'flag',
            flagSrc: '/flags/kr.svg',
            value: '한국',
            label: '한국 주식',
        },
    ]);

    const subFilterOptions = ref(['ETF', '주식']);
</script>

<template>
    <div class="h-full flex flex-column gap-2">
        <div class="flex flex-column gap-2 p-0">
            <div class="filter-button-group">
                <SelectButton
                    v-model="mainFilterTab"
                    :options="mainFilterOptions"
                    size="small"
                    optionValue="value"
                    class="w-full"
                    :allowEmpty="false">
                    <template #option="{ option }">
                        <!-- [핵심 수정] type에 따라 아이콘 또는 깃발 이미지(img)를 렌더링 -->
                        <i
                            v-if="option.type === 'icon'"
                            :class="option.icon"
                            v-tooltip.top="option.label" />
                        <img
                            v-else-if="option.type === 'flag'"
                            :src="option.flagSrc"
                            :alt="option.label"
                            class="flag-icon"
                            v-tooltip.top="option.label" />
                    </template>
                </SelectButton>

                <SelectButton
                    v-if="mainFilterTab === '미국' || mainFilterTab === '한국'"
                    v-model="subFilterTab"
                    :options="subFilterOptions"
                    size="small"
                    class="w-full" />
            </div>

            <FilterInput
                v-if="mainFilterTab !== '북마크'"
                v-model="globalSearchQuery"
                title="전체 주식 검색" />
        </div>

        <div v-if="error" class="text-red-500 p-4">{{ error }}</div>

        <div class="flex-grow-1 overflow-hidden">
            <DataTable
                v-if="!error"
                id="toto-search-datatable"
                :value="isLoading ? skeletonItems : filteredTickers"
                v-model:selection="selectedTicker"
                dataKey="symbol"
                selectionMode="single"
                @rowSelect="onRowSelect"
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
    :deep(.p-selectbutton .p-togglebutton) {
        flex: 1;
        justify-content: center;
    }
    :deep(.p-selectbutton .p-button-label) {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
    }

    /* [핵심 추가] 깃발 아이콘 스타일링 */
    .flag-icon {
        height: 1.25rem; /* 버튼 높이에 맞게 조절 */
        width: auto;
        border-radius: 3px;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.3); /* 살짝 그림자 효과 */
    }

    /* ... 이하 스타일은 동일 ... */
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
