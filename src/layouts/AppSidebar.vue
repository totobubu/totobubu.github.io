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
        return isMobile.value
            ? `calc(100vh - ${topbarHeight}px)`
            : `calc(100vh - ${topbarHeight}px - 2rem)`;
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
        return showMyStocksOnly.value && user.value
            ? etfList.value.filter((item) => myBookmarks.value[item.symbol])
            : etfList.value;
    });

    const handleBookmarkToggle = () => {
        if (!user.value) router.push('/login');
        else toggleShowMyStocksOnly();
    };

    const handleStockBookmarkClick = (symbol) => {
        if (user.value) toggleMyStock(symbol);
        else router.push('/login');
    };

    const onRowSelect = (event) => {
        const ticker = event.data.symbol;
        if (ticker && typeof ticker === 'string') {
            router.push(`/${ticker.replace(/\./g, '-').toLowerCase()}`);
        }
    };

    const openFilterDialog = (filterName) => {
        dialogsVisible.value[filterName] = true;
    };

    const selectFilter = (filterName, value) => {
        filters.value.company.value = null;
        filters.value.frequency.value = null;
        filters.value.group.value = null;
        if (filters.value[filterName]) {
            filters.value[filterName].value = value;
        }
        dialogsVisible.value[filterName] = false;
    };

    onMounted(async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const navUrl = joinURL(import.meta.env.BASE_URL, 'nav.json');
            const navResponse = await fetch(navUrl);
            if (!navResponse.ok)
                throw new Error('Navigation data could not be loaded.');
            const navData = await navResponse.json();

            const activeNavItems = navData.nav.filter((item) => !item.upcoming);
            const allSymbols = activeNavItems
                .map((item) => item.symbol)
                .filter(Boolean);

            if (allSymbols.length === 0) {
                etfList.value = [];
                isLoading.value = false;
                return;
            }

            const apiUrl = `/api/getStockData?tickers=${allSymbols.join(',')}`;
            const apiResponse = await fetch(apiUrl);
            if (!apiResponse.ok)
                throw new Error('Failed to fetch live stock data from API');

            // 이전 버전과 동일하게, JSON 파싱을 먼저 시도합니다.
            // NaN 이슈는 서버에서 해결했으므로 여기서 에러가 나면 다른 문제입니다.
            const liveDataArray = await apiResponse.json();
            const liveDataMap = new Map(
                liveDataArray.map((item) => [item.symbol, item])
            );

            const dayOrder = {
                월: 1,
                화: 2,
                수: 3,
                목: 4,
                금: 5,
                A: 6,
                B: 7,
                C: 8,
                D: 9,
            };

            etfList.value = activeNavItems.map((item) => {
                const liveData = liveDataMap.get(item.symbol);
                const baseData = {
                    ...item,
                    groupOrder: dayOrder[item.group] ?? 999,
                };

                if (!liveData) {
                    return { ...baseData, yield: '-', price: '-' };
                }

                // --- [핵심 수정] ---
                // liveData의 각 속성을 사용하기 전에 유효한 숫자인지 확인합니다.
                const changePercent = liveData.regularMarketChangePercent;
                const price = liveData.regularMarketPrice;

                return {
                    ...baseData,
                    yield:
                        typeof changePercent === 'number' &&
                        !isNaN(changePercent)
                            ? `${(changePercent * 100).toFixed(2)}%`
                            : '-',
                    price:
                        typeof price === 'number' && !isNaN(price)
                            ? price
                            : '-',
                };
                // --- // ---
            });

            const uniqueValues = (key) => [
                ...new Set(
                    etfList.value.map((item) => item[key]).filter(Boolean)
                ),
            ];
            companies.value = uniqueValues('company');
            frequencies.value = uniqueValues('frequency');
            groups.value = uniqueValues('group');

            const currentTickerSymbol = route.params.ticker
                ?.toUpperCase()
                .replace(/-/g, '.');
            if (currentTickerSymbol) {
                selectedTicker.value = etfList.value.find(
                    (t) => t.symbol === currentTickerSymbol
                );
            }
        } catch (err) {
            console.error('사이드바 데이터 로딩 중 에러:', err);
            error.value = 'ETF 목록을 불러오는 데 실패했습니다.';
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
                    <div v-if="!isLoading">
                        <i
                            class="pi"
                            :class="
                                user && myBookmarks[data.symbol]
                                    ? 'pi-bookmark-fill text-primary'
                                    : 'pi-bookmark'
                            "
                            @click.stop="handleStockBookmarkClick(data.symbol)">
                        </i>
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
                class="font-bold toto-column-ticker">
                <template #header>
                    <div class="column-header">
                        <i v-if="deviceType === 'mobile'"></i>
                        <span v-else>티커</span>
                    </div>
                </template>
                <template #body="{ data }">
                    <span v-if="!isLoading">{{ data.symbol }}</span>
                    <Skeleton v-else></Skeleton>
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
                        <i v-if="deviceType === 'mobile'"></i>
                        <span v-else>회사</span>
                    </div>
                </template>
                <template #body="{ data }">
                    <CompanyLogo
                        v-if="!isLoading"
                        :logo-src="data.logo"
                        :company-name="data.company" />
                    <Skeleton v-else width="3rem" height="3rem"></Skeleton>
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
                        <i v-if="deviceType === 'mobile'"></i>
                        <span v-else>지급</span>
                    </div>
                </template>
                <template #body="{ data }">
                    <span v-if="!isLoading">{{ data.frequency }}</span>
                    <Skeleton v-else></Skeleton>
                </template>
            </Column>

            <Column field="yield" sortable class="toto-column-yield">
                <template #header>
                    <div class="column-header">
                        <i v-if="deviceType === 'mobile'"></i>
                        <span v-else>배당률</span>
                    </div>
                </template>
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
                sortField="groupOrder">
                <template #header>
                    <div class="column-header">
                        <i v-if="deviceType === 'mobile'"></i>
                        <span v-else>그룹</span>
                    </div>
                </template>
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
</style>
