<!-- REFACTORED: src/layouts/AppSidebar.vue -->

<script setup>
    import { ref, onMounted, computed, watch } from 'vue'; // watch 추가
    import { useRouter, useRoute } from 'vue-router';
    import { getGroupSeverity } from '@/utils/uiHelpers.js';
    import { useStockList } from '@/composables/useStockList';
    import { db } from '@/firebase';
    import { doc, updateDoc, increment } from 'firebase/firestore';

    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Tag from 'primevue/tag';
    import Skeleton from 'primevue/skeleton';
    import Button from 'primevue/button';
    import Dialog from 'primevue/dialog';
    import ToggleButton from 'primevue/togglebutton';
    import SelectButton from 'primevue/selectbutton';
    import { useFilterState } from '@/composables/useFilterState';
    import { user } from '../store/auth';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import CompanyLogo from '@/components/CompanyLogo.vue';

    const router = useRouter();
    const route = useRoute();
    const { stockList, isLoading, error } = useStockList();

    const selectedTicker = ref(null);
    const skeletonItems = ref(new Array(20));

    const categoryFilter = ref('KR');
    const categoryFilterOptions = ref([
        { label: '국내', value: 'KR' },
        { label: '해외', value: 'US' },
        { label: 'ETF', value: 'ETF' },
    ]);

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
        const filterHeight = 45;
        return isMobile.value
            ? `calc(100vh - ${topbarHeight + filterHeight}px)`
            : `calc(100vh - ${topbarHeight + filterHeight}px - 2rem)`;
    });

    const tableSize = computed(() => (isMobile.value ? 'small' : null));
    const dialogsVisible = ref({
        company: false,
        frequency: false,
        group: false,
    });

    const companies = computed(() => [
        ...new Set(stockList.value.map((item) => item.company).filter(Boolean)),
    ]);
    const frequencies = computed(() => [
        ...new Set(
            stockList.value.map((item) => item.frequency).filter(Boolean)
        ),
    ]);
    const groups = computed(() => [
        ...new Set(stockList.value.map((item) => item.group).filter(Boolean)),
    ]);

    const finalList = computed(() => {
        let list = stockList.value;

        if (showMyStocksOnly.value && user.value) {
            list = list.filter((item) => myBookmarks.value[item.symbol]);
        }

        const isKorean = (item) =>
            item.market === 'KOSPI' || item.market === 'KOSDAQ';
        const isEtf = (item) => !!item.company;

        if (categoryFilter.value === 'KR') {
            return list.filter((item) => isKorean(item));
        } else if (categoryFilter.value === 'ETF') {
            return list.filter((item) => !isKorean(item) && isEtf(item));
        } else if (categoryFilter.value === 'US') {
            return list.filter((item) => !isKorean(item) && !isEtf(item));
        }

        return list;
    });

    // --- [핵심 추가] 카테고리 필터 변경 시 회사 필터 초기화 ---
    watch(categoryFilter, (newCategory) => {
        // ETF 탭이 아닐 경우, 회사 필터를 초기화합니다.
        if (newCategory !== 'ETF' && filters.value.company.value) {
            filters.value.company.value = null;
        }
    });
    // --- // ---

    const handleBookmarkToggle = () => {
        if (!user.value) router.push('/login');
        else toggleShowMyStocksOnly();
    };

    const handleStockBookmarkClick = (symbol) => {
        if (user.value) toggleMyStock(symbol);
        else router.push('/login');
    };

    const onRowSelect = async (event) => {
        const ticker = event.data;
        if (!ticker || !ticker.symbol) return;
        try {
            const stockRef = doc(
                db,
                'stockPopularity',
                ticker.symbol.toUpperCase()
            );
            await updateDoc(stockRef, { viewCount: increment(1) });
        } catch (e) {
            console.error('Failed to update view count:', e);
        }
        router.push(`/${ticker.symbol.replace(/\./g, '-').toLowerCase()}`);
    };

    const openFilterDialog = (filterName) =>
        (dialogsVisible.value[filterName] = true);

    const selectFilter = (filterName, value) => {
        // 다른 필터는 초기화하지 않고, 현재 필터만 설정하도록 변경
        if (filters.value[filterName]) {
            filters.value[filterName].value = value;
        }
        dialogsVisible.value[filterName] = false;
    };

    onMounted(() => {
        const currentTickerSymbol = route.params.ticker
            ?.toUpperCase()
            .replace(/-/g, '.');
        if (currentTickerSymbol) {
            selectedTicker.value = { symbol: currentTickerSymbol };
        }
    });
</script>

<template>
    <div>
        <div v-if="error" class="text-red-500 p-4">{{ error }}</div>

        <div v-else>
            <div class="p-2">
                <SelectButton
                    v-model="categoryFilter"
                    :options="categoryFilterOptions"
                    optionLabel="label"
                    optionValue="value"
                    aria-labelledby="category-filter"
                    class="w-full" />
            </div>

            <DataTable
                id="toto-search-datatable"
                :value="isLoading ? skeletonItems : finalList"
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
                :class="{ 'p-datatable-loading': isLoading }"
                sortField="popularity"
                :sortOrder="-1"
                removableSort>
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
                        <div v-if="!isLoading">
                            <i
                                class="pi"
                                :class="
                                    user && myBookmarks[data.symbol]
                                        ? 'pi-bookmark-fill text-primary'
                                        : 'pi-bookmark'
                                "
                                @click.stop="
                                    handleStockBookmarkClick(data.symbol)
                                "></i>
                        </div>
                        <Skeleton
                            v-else
                            width="1rem"
                            height="1rem"
                            borderRadius="50%"></Skeleton>
                    </template>
                </Column>
                <Column
                    field="symbol"
                    sortable
                    frozen
                    class="font-bold toto-column-ticker"
                    header="티커">
                    <template #body="{ data }">
                        <div v-if="!isLoading">
                            <span
                                v-if="
                                    data.market === 'KOSPI' ||
                                    data.market === 'KOSDAQ'
                                ">
                                {{ data.longName || data.symbol }}
                            </span>
                            <span v-else>{{ data.symbol }}</span>
                        </div>
                        <Skeleton v-else></Skeleton>
                    </template>
                </Column>

                 <!-- [핵심 수정] :sortable에 조건부 바인딩 추가 -->
                <Column 
                    field="company" 
                    :sortable="categoryFilter === 'ETF'" 
                    class="toto-column-company" 
                    header="회사"
                >
                    <template #header>
                        <Button 
                            v-if="categoryFilter === 'ETF'"
                            type="button" 
                            icon="pi pi-filter-fill" 
                            size="small" 
                            :variant="filters.company.value ? 'filled' : 'text'" 
                            @click="openFilterDialog('company')" 
                            :severity="filters.company.value ? '' : 'secondary'" 
                        />
                    </template>
                    <template #body="{ data }">
                        <CompanyLogo v-if="!isLoading" :logo-src="data.logo" :company-name="data.company" />
                        <Skeleton v-else width="3rem" height="3rem"></Skeleton>
                    </template>
                </Column>

                <Column
                    field="frequency"
                    sortable
                    class="toto-column-frequency"
                    header="지급">
                    <template #header>
                        <Button
                            type="button"
                            icon="pi pi-filter-fill"
                            size="small"
                            :variant="
                                filters.frequency.value ? 'filled' : 'text'
                            "
                            @click="openFilterDialog('frequency')"
                            :severity="
                                filters.frequency.value ? '' : 'secondary'
                            " />
                    </template>
                    <template #body="{ data }">
                        <span v-if="!isLoading">{{ data.frequency }}</span>
                        <Skeleton v-else></Skeleton>
                    </template>
                </Column>

                <Column
                    field="yield"
                    sortable
                    class="toto-column-yield"
                    header="배당률">
                    <template #body="{ data }">
                        <span v-if="!isLoading" class="text-surface-500">{{
                            data.yield
                        }}</span>
                        <Skeleton v-else></Skeleton>
                    </template>
                </Column>

                <Column
                    field="group"
                    sortable
                    class="toto-column-group"
                    sortField="groupOrder"
                    header="그룹">
                    <template #body="{ data }">
                        <Tag
                            v-if="!isLoading && data.group"
                            :value="data.group"
                            :severity="getGroupSeverity(data.group)" />
                        <Skeleton v-else-if="isLoading"></Skeleton>
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
    </div>
</template>

<style scoped>
    :deep(.p-selectbutton .p-button) {
        flex-grow: 1;
    }
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
</style>
