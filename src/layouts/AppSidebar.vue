<!-- stock\src\layouts\AppSidebar.vue -->
<script setup>
    import { ref, onMounted, computed } from 'vue'; // ref, onMounted, computed 추가
    import { useRouter, useRoute } from 'vue-router';
    import { getGroupSeverity } from '@/utils/uiHelpers.js'; // [수정] 중앙 유틸리티 import
    import { joinURL } from 'ufo';

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

    const {
        filters,
        showMyStocksOnly,
        toggleShowMyStocksOnly,
        myBookmarks,
        toggleMyStock,
    } = useFilterState();
    const { deviceType, isMobile } = useBreakpoint();

    // --- UI 관련 computed 속성 (변경 없음) ---
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

    // --- UI 이벤트 핸들러 (변경 없음) ---

    // --- 핵심: 필터링된 목록을 계산하는 computed 속성 추가 ---
    const filteredEtfList = computed(() => {
        // "내 종목만 보기"가 켜져 있고, 로그인 상태일 때
        if (showMyStocksOnly.value && user.value) {
            // 전체 목록(etfList)에서 내 북마크(myBookmarks)에 포함된 종목만 필터링
            return etfList.value.filter(
                (item) => myBookmarks.value[item.symbol]
            );
        }
        // 그 외의 경우(토글이 꺼져있거나 로그아웃 상태)에는 전체 목록을 반환
        return etfList.value;
    });

    const handleBookmarkToggle = () => {
        // 로그인 상태일 때만 작동하도록 방어 코드 추가
        if (!user.value) {
            // 이 버튼은 disabled 처리될 것이므로 사실상 호출되지 않지만,
            // 안전을 위해 추가합니다.
            router.push('/login');
            return;
        }
        toggleShowMyStocksOnly();
        // selectedTicker.value = null;
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

    const onRowSelect = (event) => {
        const ticker = event.data.symbol;
        if (ticker && typeof ticker === 'string') {
            router.push(`/${ticker.toLowerCase()}`);
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

    // --- 데이터 로딩 로직 (핵심 변경) ---
    onMounted(async () => {
        isLoading.value = true;
        error.value = null;
        try {
            // 1. 기본 정보 로드
            const navUrl = joinURL(import.meta.env.BASE_URL, 'nav.json');
            const navResponse = await fetch(navUrl);
            if (!navResponse.ok)
                throw new Error('Navigation data could not be loaded.');
            const navData = await navResponse.json();
            const allSymbols = navData.nav
                .map((item) => item.symbol)
                .filter(Boolean);

            if (allSymbols.length === 0) {
                etfList.value = [];
                isLoading.value = false;
                return;
            }

            // 2. 실시간 데이터 로드 (Vite 프록시를 통해 Vercel API 호출)
            const apiUrl = `/api/getStockData?tickers=${allSymbols.join(',')}`;
            const apiResponse = await fetch(apiUrl);
            if (!apiResponse.ok)
                throw new Error('Failed to fetch live stock data from API');

            // --- 핵심: JSON 파싱 에러 방지를 위한 디버깅 추가 ---
            const responseText = await apiResponse.text();
            let liveDataArray;
            try {
                liveDataArray = JSON.parse(responseText);
            } catch (e) {
                console.error(
                    'API 응답이 유효한 JSON이 아닙니다:',
                    responseText
                );
                throw new Error('API로부터 잘못된 형식의 응답을 받았습니다.');
            }
            // ---------------------------------------------

            const liveDataMap = new Map(
                liveDataArray.map((item) => [item.symbol, item])
            );

            // 3. 데이터 병합
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
            etfList.value = navData.nav.map((item) => {
                const liveData = liveDataMap.get(item.symbol);
                return {
                    ...item, // symbol, longName, company, frequency, group, upcoming 등
                    yield: liveData?.regularMarketChangePercent
                        ? `${(liveData.regularMarketChangePercent * 100).toFixed(2)}%`
                        : 'N/A',
                    price: liveData?.regularMarketPrice || 'N/A',
                    groupOrder: dayOrder[item.group] ?? 999,
                };
            });

            // 4. 필터 목록 생성
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

            // 5. 현재 티커 선택
            const currentTickerSymbol = route.params.ticker?.toUpperCase();
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
        <div v-if="isLoading" class="flex justify-center items-center h-48">
            <ProgressSpinner />
        </div>
        <div v-else-if="error" class="text-red-500">{{ error }}</div>

        <DataTable
            v-else
            id="toto-search-datatable"
            :value="filteredEtfList"
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
                    <i
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
                    <!-- 1. upcoming 플래그가 true이면 "예정" 태그를 표시합니다. -->
                    <Tag v-if="data.upcoming" value="예정" severity="info" />

                    <!-- 2. upcoming이 아닐 경우에만, 기존처럼 그룹 태그를 표시합니다. -->
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
