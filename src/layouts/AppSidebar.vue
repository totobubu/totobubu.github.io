<!-- REFACTORED: src/layouts/AppSidebar.vue -->
<script setup>
    import { ref, onMounted, computed } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { getGroupSeverity } from '@/utils/uiHelpers.js';
    import { joinURL } from 'ufo';

    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Tag from 'primevue/tag';
    import Skeleton from 'primevue/skeleton';
    import Button from 'primevue/button';
    import Dialog from 'primevue/dialog';
    import ToggleButton from 'primevue/togglebutton';
    import { useFilterState } from '@/composables/useFilterState';
    import { user } from '../store/auth';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    import CompanyLogo from '@/components/CompanyLogo.vue';

    const router = useRouter();
    const route = useRoute();
    const etfList = ref([]);
    const isLoading = ref(true);
    const error = ref(null);
    const selectedTicker = ref(null);
    const skeletonItems = ref(new Array(15));

    const {
        filters,
        showMyStocksOnly,
        toggleShowMyStocksOnly,
        myBookmarks,
        toggleMyStock,
    } = useFilterState();
    const { deviceType, isMobile } = useBreakpoint();

    const tableScrollHeight = computed(() => {
        const topbarHeight = 60;
        if (isMobile.value) {
            return `calc(100vh - ${topbarHeight}px)`;
        } else {
            return `calc(100vh - ${topbarHeight}px - 2rem)`;
        }
    });
    const tableSize = computed(() => (isMobile.value ? 'small' : null));

    const dialogsVisible = ref({
        company: false,
        frequency: false,
        group: false,
    });
    const companies = ref([]);
    const frequencies = ref([]);
    const groups = ref([]);

    const filteredEtfList = computed(() => {
        if (showMyStocksOnly.value && user.value) {
            return etfList.value.filter(
                (item) => myBookmarks.value[item.symbol]
            );
        }
        return etfList.value;
    });

    const handleBookmarkToggle = () => {
        if (!user.value) router.push('/login');
        else toggleShowMyStocksOnly();
    };

    const handleStockBookmarkClick = (symbol) => {
        if (!user.value) router.push('/login');
        else toggleMyStock(symbol);
    };

    const onRowSelect = (event) => {
        const ticker = event.data.symbol;
        if (ticker && typeof ticker === 'string') {
            const sanitizedTicker = ticker.replace(/\./g, '-');
            router.push(`/${sanitizedTicker.toLowerCase()}`);
        }
    };

    const openFilterDialog = (filterName) => {
        dialogsVisible.value[filterName] = true;
    };

    const selectFilter = (filterName, value) => {
        filters.value[filterName].value = value;
        dialogsVisible.value[filterName] = false;
    };

    onMounted(async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch(
                joinURL(import.meta.env.BASE_URL, 'sidebar-tickers.json')
            );
            if (!response.ok)
                throw new Error('Sidebar data could not be loaded.');

            const data = await response.json();
            etfList.value = data;

            companies.value = [
                ...new Set(data.map((item) => item.company).filter(Boolean)),
            ];
            frequencies.value = [
                ...new Set(data.map((item) => item.frequency).filter(Boolean)),
            ];
            groups.value = [
                ...new Set(data.map((item) => item.group).filter(Boolean)),
            ];

            const currentTickerSymbol = route.params.ticker
                ?.toUpperCase()
                .replace(/-/g, '.');
            if (currentTickerSymbol) {
                selectedTicker.value = data.find(
                    (t) => t.symbol === currentTickerSymbol
                );
            }
        } catch (err) {
            console.error('사이드바 데이터 로딩 중 에러:', err);
            error.value = '티커 목록을 불러오는 데 실패했습니다.';
        } finally {
            isLoading.value = false;
        }
    });
</script>

<template>
    <div>
        <div v-if="error" class="text-red-500 p-4">{{ error }}</div>

        <DataTable
            v-else
            id="toto-search-datatable"
            :value="isLoading ? skeletonItems : filteredEtfList"
            v-model:filters="filters"
            v-model:selection="selectedTicker"
            dataKey="symbol"
            selectionMode="single"
            @rowSelect="onRowSelect"
            :globalFilterFields="['symbol', 'longName', 'company']"
            stripedRows
            scrollable
            :scrollHeight="tableScrollHeight"
            :size="tableSize"
            :class="{ 'p-datatable-loading': isLoading }">
            <template #empty>
                <div class="text-center p-4">검색 결과가 없습니다.</div>
            </template>

            <Column frozen class="toto-column-bookmark">
                <template #header>
                    <ToggleButton
                        :modelValue="showMyStocksOnly"
                        @click.stop="handleBookmarkToggle"
                        :disabled="!user"
                        onIcon="pi pi-bookmark-fill"
                        offIcon="pi pi-bookmark"
                        onLabel=""
                        offLabel=""
                        aria-label="내 종목만 보기" />
                </template>
                <template #body="{ data }">
                    <Skeleton
                        v-if="isLoading"
                        width="1rem"
                        height="1rem"
                        borderRadius="50%"></Skeleton>
                    <i
                        v-else
                        class="pi"
                        :class="
                            user && myBookmarks[data.symbol]
                                ? 'pi-bookmark-fill text-primary'
                                : 'pi-bookmark'
                        "
                        @click.stop="handleStockBookmarkClick(data.symbol)"></i>
                </template>
            </Column>

            <Column
                field="symbol"
                sortable
                frozen
                class="font-bold toto-column-ticker">
                <template #header>
                    <div class="column-header">
                        <span>{{ isMobile ? '' : '티커' }}</span>
                    </div>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isLoading"></Skeleton>
                    <span v-else>{{ data.symbol }}</span>
                </template>
            </Column>

            <Column field="company" sortable class="toto-column-company">
                <template #header>
                    <Button
                        type="button"
                        icon="pi pi-filter-fill"
                        size="small"
                        :variant="filters.company.value ? 'filled' : 'text'"
                        @click="openFilterDialog('company')"
                        :severity="filters.company.value ? '' : 'secondary'" />
                    <div class="column-header">
                        <span v-if="!isMobile">회사</span>
                    </div>
                </template>
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

            <Column field="frequency" sortable class="toto-column-frequency">
                <template #header>
                    <Button
                        type="button"
                        icon="pi pi-filter-fill"
                        size="small"
                        :variant="filters.frequency.value ? 'filled' : 'text'"
                        @click="openFilterDialog('frequency')"
                        :severity="
                            filters.frequency.value ? '' : 'secondary'
                        " />
                    <div class="column-header">
                        <span v-if="!isMobile">지급</span>
                    </div>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isLoading"></Skeleton>
                    <span v-else>{{ data.frequency }}</span>
                </template>
            </Column>

            <Column field="yield" sortable class="toto-column-yield">
                <template #header>
                    <div class="column-header">
                        <span v-if="!isMobile">배당률</span>
                    </div>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isLoading"></Skeleton>
                    <span v-else class="text-surface-500">{{
                        data.yield
                    }}</span>
                </template>
            </Column>

            <Column
                field="group"
                sortable
                class="toto-column-group"
                sortField="groupOrder">
                <template #header>
                    <div class="column-header">
                        <span v-if="!isMobile">그룹</span>
                    </div>
                </template>
                <template #body="{ data }">
                    <Skeleton v-if="isLoading"></Skeleton>
                    <Tag
                        v-else-if="data.group"
                        :value="data.group"
                        :severity="getGroupSeverity(data.group)" />
                </template>
            </Column>
        </DataTable>

        <Dialog
            v-model:visible="dialogsVisible.company"
            modal
            header="운용사 필터"
            :style="{ width: '600px' }"
            :breakpoints="{ '576px': '95vw' }">
            <div class="filter-button-group">
                <ToggleButton
                    onLabel="전체"
                    offLabel="전체"
                    :modelValue="filters.company.value === null"
                    @update:modelValue="selectFilter('company', null)"
                    class="p-button-sm" />
                <ToggleButton
                    v-for="company in companies"
                    :key="company"
                    :onLabel="company"
                    :offLabel="company"
                    :modelValue="filters.company.value === company"
                    @update:modelValue="selectFilter('company', company)"
                    class="p-button-sm" />
            </div>
        </Dialog>
        <Dialog
            v-model:visible="dialogsVisible.frequency"
            modal
            header="지급주기 필터"
            :style="{ width: '576px' }">
            <div class="filter-button-group">
                <ToggleButton
                    onLabel="전체"
                    offLabel="전체"
                    :modelValue="filters.frequency.value === null"
                    @update:modelValue="selectFilter('frequency', null)"
                    class="p-button-sm" />
                <ToggleButton
                    v-for="freq in frequencies"
                    :key="freq"
                    :onLabel="freq"
                    :offLabel="freq"
                    :modelValue="filters.frequency.value === freq"
                    @update:modelValue="selectFilter('frequency', freq)"
                    class="p-button-sm" />
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
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
</style>
