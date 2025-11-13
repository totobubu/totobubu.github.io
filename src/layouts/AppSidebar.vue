<!-- src/layouts/AppSidebar.vue -->

<script setup>
    import { computed, ref, watch } from 'vue';
    import { useSidebar } from '@/composables/useSidebar.js';
    import { useBreakpoint } from '@/composables/useBreakpoint.js';
    import { user } from '../store/auth';

    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Skeleton from 'primevue/skeleton';
    import Button from 'primevue/button';
    import Select from 'primevue/select';
    import CompanyLogo from '@/components/CompanyLogo.vue';
    import FilterInput from '@/components/FilterInput.vue';
    import WeekdayRotatingTag from '@/components/WeekdayRotatingTag.vue';

    const {
        isLoading,
        hasInitialLoadCompleted,
        error,
        selectedTicker,
        globalSearchQuery,
        mainFilterTab,
        isSearchActive,
        subFilterTab,
        myBookmarks,
        filteredTickers,
        handleStockBookmarkClick,
        onRowSelect,
        handleTickerRequest,
    } = useSidebar();

    const { isMobile } = useBreakpoint();
    const skeletonItems = ref(new Array(50));
    const tableSize = computed(() => (isMobile.value ? 'small' : null));

    const groupedMarketOptions = [
        {
            label: '미국',
            code: 'US',
            flagSrc: '/flags/us.svg',
            items: [
                {
                    label: '미국 ETF',
                    value: { main: '미국', sub: 'ETF' },
                },
                {
                    label: '미국 개별 주식',
                    value: { main: '미국', sub: '주식' },
                },
            ],
        },
        {
            label: '한국',
            code: 'KR',
            flagSrc: '/flags/kr.svg',
            items: [
                {
                    label: '한국 ETF',
                    value: { main: '한국', sub: 'ETF' },
                },
                {
                    label: '한국 개별 주식',
                    value: { main: '한국', sub: '주식' },
                },
            ],
        },
    ];

    const isBookmarkActive = computed(
        () => mainFilterTab.value === '북마크' && !!user.value
    );

    const selectedMarketOption = computed({
        get() {
            if (
                mainFilterTab.value === '미국' ||
                mainFilterTab.value === '한국'
            ) {
                const group = groupedMarketOptions.find(
                    (g) => g.label === mainFilterTab.value
                );
                if (!group) return null;
                return (
                    group.items.find(
                        (item) =>
                            item.value.sub === subFilterTab.value &&
                            item.value.main === mainFilterTab.value
                    ) || null
                );
            }
            return groupedMarketOptions[0].items[0];
        },
        set(option) {
            if (option && option.value) {
                mainFilterTab.value = option.value.main;
                subFilterTab.value = option.value.sub;
            }
        },
    });

    const handleBookmarkClick = () => {
        if (!user.value) {
            return;
        }
        mainFilterTab.value = '북마크';
        subFilterTab.value = groupedMarketOptions[0].items[0].value.sub;
    };

    // 로그아웃 시 북마크 탭에 있으면 미국 탭으로 전환
    watch(user, (newUser) => {
        if (!newUser && mainFilterTab.value === '북마크') {
            mainFilterTab.value = '미국';
        }
    });
</script>

<template>
    <div class="h-full flex flex-column gap-2">
        <div class="flex flex-column gap-2 p-0">
            <div class="filter-button-group">
                <Button
                    v-if="user"
                    label="북마크"
                    icon="pi pi-bookmark"
                    size="small"
                    :outlined="!isBookmarkActive"
                    :severity="isBookmarkActive ? 'primary' : 'secondary'"
                    class="bookmark-toggle"
                    @click="handleBookmarkClick" />
                <Select
                    v-model="selectedMarketOption"
                    :options="groupedMarketOptions"
                    :disabled="isSearchActive"
                    optionLabel="label"
                    optionGroupLabel="label"
                    optionGroupChildren="items"
                    placeholder="시장 / 자산군 선택"
                    class="market-select">
                    <template #optiongroup="slotProps">
                        <div class="select-option-group">
                            <img
                                v-if="slotProps.option.flagSrc"
                                :src="slotProps.option.flagSrc"
                                :alt="slotProps.option.label"
                                class="flag-icon" />
                            <span>{{ slotProps.option.label }}</span>
                        </div>
                    </template>
                </Select>
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
                id="t-search-datatable"
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
                        v-if="!hasInitialLoadCompleted || isLoading"
                        class="p-4">
                        <div class="flex flex-column gap-3">
                            <Skeleton height="1.5rem" />
                            <Skeleton height="1.5rem" />
                            <Skeleton height="1.5rem" />
                        </div>
                    </div>
                    <template v-else>
                        <div
                            v-if="mainFilterTab === '북마크'"
                            class="text-center p-4">
                            <p v-if="!user" class="mb-2">
                                로그인 후 종목을 북마크에 추가해 보세요.
                            </p>
                            <p
                                v-else-if="
                                    Object.keys(myBookmarks).length === 0
                                "
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
                </template>
                <Column frozen class="t-column-bookmark">
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
                                    ? 'pi-bookmark-fill'
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
                    class="font-bold t-column-ticker">
                    <template #header
                        ><span>{{ isMobile ? '' : '티커' }}</span></template
                    >
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <span v-else>{{ data.koName || data.symbol }}</span>
                    </template>
                </Column>
                <Column field="company" sortable class="t-column-company">
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
                <Column field="frequency" sortable class="t-column-frequency">
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
                    class="t-column-group"
                    sortField="groupOrder">
                    <template #header
                        ><span v-if="!isMobile">그룹</span></template
                    >
                    <template #body="{ data }">
                        <Skeleton v-if="isLoading"></Skeleton>
                        <WeekdayRotatingTag
                            v-else
                            :labels="data.groupLabels"
                            :fallback="data.group"
                            :interval="1600" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
