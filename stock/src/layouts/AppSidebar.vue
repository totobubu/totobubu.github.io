<!-- stock\src\layouts\AppSidebar.vue -->
<script setup>
    import { ref, onMounted, computed } from 'vue';
    import { useRouter, useRoute } from 'vue-router';
    import { joinURL } from 'ufo';
    import { parseYYMMDD } from '@/utils/date.js';

    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Tag from 'primevue/tag';
    import ProgressSpinner from 'primevue/progressspinner';
    import Button from 'primevue/button';
    import Dialog from 'primevue/dialog';
    import ToggleButton from 'primevue/togglebutton';
    import { useFilterState } from '@/composables/useFilterState';
    import { user } from '../store/auth';
    import { useBreakpoint } from '@/composables/useBreakpoint';

    const router = useRouter();
    const route = useRoute();
    const etfList = ref([]);
    const isLoading = ref(true);
    const error = ref(null);
    const selectedTicker = ref(null);

    // 전역 스토어에서 필요한 모든 것을 가져옵니다.
    const {
        filters,
        showMyStocksOnly,
        toggleShowMyStocksOnly,
        myStockSymbols, // 전역 '내 종목' 목록
        toggleMyStock, // 전역 토글 함수
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

    // '내 종목' 여부를 확인하는 computed 속성 추가
    // const filteredEtfList = computed(() => {
    //     if (showMyStocksOnly.value) {
    //         return etfList.value.filter((item) =>
    //             myStockSymbols.value.includes(item.symbol)
    //         );
    //     }
    //     return etfList.value;
    // });

    const handleBookmarkToggle = () => {
        // 로그인 상태일 때만 작동하도록 방어 코드 추가
        if (!user.value) {
            // 이 버튼은 disabled 처리될 것이므로 사실상 호출되지 않지만,
            // 안전을 위해 추가합니다.
            router.push('/login');
            return;
        }
        toggleShowMyStocksOnly();
        selectedTicker.value = null;
    };

    // 개별 북마크 아이콘 클릭 시 호출될 함수
    const handleStockBookmarkClick = (symbol) => {
        if (user.value) {
            // 로그인 상태: 내 종목에 추가/삭제
            toggleMyStock(symbol);
        } else {
            // 로그아웃 상태: 로그인 페이지로 이동
            alert('로그인이 필요한 기능입니다.');
            router.push('/login');
        }
    };

    onMounted(async () => {
        try {
            const url = joinURL(import.meta.env.BASE_URL, 'nav.json');
            const response = await fetch(url);
            if (!response.ok) throw new Error('Navigation data not found');
            const rawData = await response.json();

            const tickerDetailsPromises = rawData.nav.map(async (item) => {
                try {
                    const res = await fetch(
                        joinURL(
                            import.meta.env.BASE_URL,
                            `data/${item.symbol.toLowerCase()}.json`
                        )
                    );
                    if (!res.ok) return { ...item, yield: 'N/A' };
                    const detailData = await res.json();
                    return {
                        ...item,
                        yield: detailData.tickerInfo?.Yield || 'N/A',
                    };
                } catch (e) {
                    return { ...item, yield: 'N/A' };
                }
            });

            const tickersWithYield = await Promise.all(tickerDetailsPromises);

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

            etfList.value = tickersWithYield.map((item) => ({
                ...item,
                groupOrder: dayOrder[item.group] ?? 999,
            }));

            companies.value = [
                ...new Set(etfList.value.map((item) => item.company)),
            ];
            frequencies.value = [
                ...new Set(etfList.value.map((item) => item.frequency)),
            ];
            groups.value = [
                ...new Set(
                    etfList.value.map((item) => item.group).filter((g) => g)
                ),
            ];

            const currentTickerSymbol = route.params.ticker?.toUpperCase();
            if (currentTickerSymbol) {
                selectedTicker.value = etfList.value.find(
                    (t) => t.symbol === currentTickerSymbol
                );
            }
        } catch (err) {
            error.value = 'ETF 목록을 불러오는 데 실패했습니다.';
        } finally {
            isLoading.value = false;
        }
    });

    const onRowSelect = (event) => {
        const ticker = event.data.symbol;
        if (ticker && typeof ticker === 'string') {
            router.push(`/stock/${ticker.toLowerCase()}`);
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

    const getGroupSeverity = (group) => {
        switch (group) {
            case 'A':
                return 'danger';
            case 'B':
                return 'warn';
            case 'C':
                return 'success';
            case 'D':
                return 'info';
            case '월':
                return 'mon';
            case '화':
                return 'tue';
            case '수':
                return 'wed';
            case '목':
                return 'thu';
            case '금':
                return 'fri';
            default:
                return 'secondary';
        }
    };
</script>

<template>
    <div>
        <div v-if="isLoading" class="flex justify-center items-center h-48">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-red-500">{{ error }}</div>

        <DataTable
            v-else
            id="toto-search-datatable"
            :value="etfList"
            v-model:filters="filters"
            v-model:selection="selectedTicker"
            dataKey="symbol"
            selectionMode="single"
            @rowSelect="onRowSelect"
            :globalFilterFields="['symbol', 'longName', 'company']"
            class="p-datatable-sm"
            stripedRows
            scrollable
            :scrollHeight="tableScrollHeight"
            :size="tableSize">
            <template #empty>
                <div class="text-center p-4">검색 결과가 없습니다.</div>
            </template>

            <!-- '내 종목' 토글 버튼을 위한 새로운 Column 추가 -->
            <Column frozen class="toto-column-bookmark">
                <template #header>
                    <!--
                    v-model 대신 @click.stop을 사용합니다.
                    v-model은 내부적으로 @update:modelValue 이벤트를 사용하는데,
                    여기에 .stop을 직접 붙이기 어렵기 때문입니다.
                    직접 클릭 이벤트를 제어하는 것이 더 명확합니다.
                -->
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
                    <!-- 개별 종목 북마크 아이콘에도 .stop을 추가합니다. -->
                    <i
                        class="pi"
                        :class="
                            user && myStockSymbols.includes(data.symbol)
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
                        <i v-if="deviceType === 'mobile'"></i>
                        <span v-else>티커</span>
                    </div>
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
                        <span v-else>운용사</span>
                    </div>
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
                        <span v-else
                            >지급<br
                                v-if="deviceType !== 'desktop'" />주기</span
                        >
                    </div>
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
                    <span
                        v-if="data.yield && data.yield !== 'N/A'"
                        class="text-surface-500"
                        >{{ data.yield }}
                    </span>
                    <span v-else class="text-surface-500">-</span>
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
                        v-if="data.group"
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
    /* 아이콘이 중앙에 오도록 스타일 추가 */
    .toto-column-bookmark .p-column-header-content,
    .toto-column-bookmark .p-column-content {
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .toto-column-bookmark .p-button {
        width: 2.5rem; /* 버튼 크기 조절 */
        height: 2.5rem;
    }
</style>
