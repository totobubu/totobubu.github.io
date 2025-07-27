<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { joinURL } from "ufo";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import ToggleButton from "primevue/togglebutton";
import { useFilterState } from "@/composables/useFilterState";
import { useBreakpoint } from "@/composables/useBreakpoint";

const router = useRouter();
const route = useRoute();
const etfList = ref([]);
const isLoading = ref(true);
const error = ref(null);
const selectedTicker = ref(null);

const { filters } = useFilterState();
const { deviceType, isMobile } = useBreakpoint();

const tableScrollHeight = computed(() => {
    const topbarHeight = 60;
    if (isMobile.value) {
        return `calc(100vh - ${topbarHeight}px)`;
    } else {
        return `calc(100vh - ${topbarHeight}px - 2rem)`;
    }
});

const tableSize = computed(() => (isMobile.value ? "small" : null));

const dialogsVisible = ref({
    company: false,
    frequency: false,
    group: false,
});

const companies = ref([]);
const frequencies = ref([]);
const groups = ref([]);

onMounted(async () => {
    try {
        const url = joinURL(import.meta.env.BASE_URL, "nav.json");
        const response = await fetch(url);
        if (!response.ok) throw new Error("Navigation data not found");
        const data = await response.json();

        etfList.value = data.nav;

        companies.value = [...new Set(data.nav.map((item) => item.company))];
        frequencies.value = [...new Set(data.nav.map((item) => item.frequency))];
        groups.value = [...new Set(data.nav.map((item) => item.group).filter((g) => g))];
        
        // 현재 URL을 기반으로 선택된 티커 설정
        const currentTickerSymbol = route.params.ticker?.toUpperCase();
        if (currentTickerSymbol) {
            selectedTicker.value = etfList.value.find(t => t.symbol === currentTickerSymbol);
        }

    } catch (err) {
        error.value = "ETF 목록을 불러오는 데 실패했습니다.";
    } finally {
        isLoading.value = false;
    }
});

const onRowSelect = (event) => {
    const ticker = event.data.symbol;
    if (ticker && typeof ticker === "string") {
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
        case "A": return "danger";
        case "B": return "warn";
        case "C": return "success";
        case "D": return "info";
        case "월": return "mon";
        case "화": return "tue";
        case "수": return "wed";
        case "목": return "thu";
        case "금": return "fri";
        default: return "secondary";
    }
};
</script>

<template>
    <div v-if="isLoading" class="flex justify-center items-center h-48">
        <ProgressSpinner />
    </div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>

    <DataTable v-else 
        id="toto-search-datatable"
        :value="etfList" 
        v-model:filters="filters" 
        v-model:selection="selectedTicker"
        dataKey="symbol" 
        selectionMode="single"
        @rowSelect="onRowSelect" 
        :globalFilterFields="['symbol', 'longName']" 
        class="p-datatable-sm" 
        stripedRows
        scrollable 
        :scrollHeight="tableScrollHeight" 
        :size="tableSize">
        <template #empty>
            <div class="text-center p-4">검색 결과가 없습니다.</div>
        </template>

        <Column field="symbol" header="티커" sortable frozen class="font-bold toto-column-ticker">
            <template #body="{ data }">
                <span>{{ data.symbol }}</span>
            </template>
        </Column>
        <Column field="company" sortable class="toto-column-company">
            <template #header>
                <Button type="button" icon="pi pi-filter-fill" size="small"
                    :variant="filters.company.value ? 'filled' : 'text'" @click="openFilterDialog('company')"
                    :severity="filters.company.value ? '' : 'secondary'" />
                <div class="column-header">
                    <span>운용사</span>
                </div>
            </template>
            <template #body="{ data }">
                {{ data.company }}
            </template>
        </Column>

        <Column field="frequency" sortable class="toto-column-frequency">
            <template #header>
                <Button type="button" icon="pi pi-filter-fill" size="small"
                    :variant="filters.frequency.value ? 'filled' : 'text'" @click="openFilterDialog('frequency')"
                    :severity="filters.frequency.value ? '' : 'secondary'" />
                <div class="column-header">
                    <span>지급<br v-if="deviceType !== 'desktop'" />주기</span>
                </div>
            </template>
            <template #body="{ data }">{{ data.frequency }}
            </template>
        </Column>

        <Column field="group" sortable class="toto-column-group">
            <template #header>
                <div class="column-header">
                    <span>그룹</span>
                </div>
            </template>
            <template #body="{ data }">
                <Tag v-if="data.group" :value="data.group" :severity="getGroupSeverity(data.group)" />
            </template>
        </Column>
    </DataTable>

    <Dialog v-model:visible="dialogsVisible.company" modal header="운용사 필터" :style="{ width: '80vw' }"
        :breakpoints="{ '576px': '95vw' }">
        <div class="filter-button-group">
            <ToggleButton onLabel="전체" offLabel="전체" :modelValue="filters.company.value === null"
                @update:modelValue="selectFilter('company', null)" class="p-button-sm" />
            <ToggleButton v-for="company in companies" :key="company" :onLabel="company" :offLabel="company"
                :modelValue="filters.company.value === company" @update:modelValue="selectFilter('company', company)"
                class="p-button-sm" />
        </div>
    </Dialog>

    <Dialog v-model:visible="dialogsVisible.frequency" modal header="지급주기 필터" :style="{ width: '80vw' }"
        :breakpoints="{ '576px': '95vw' }">
        <div class="filter-button-group">
            <ToggleButton onLabel="전체" offLabel="전체" :modelValue="filters.frequency.value === null"
                @update:modelValue="selectFilter('frequency', null)" class="p-button-sm" />
            <ToggleButton v-for="freq in frequencies" :key="freq" :onLabel="freq" :offLabel="freq"
                :modelValue="filters.frequency.value === freq" @update:modelValue="selectFilter('frequency', freq)"
                class="p-button-sm" />
        </div>
    </Dialog>

    <Dialog v-model:visible="dialogsVisible.group" modal header="그룹 필터" :style="{ width: '80vw' }"
        :breakpoints="{ '576px': '95vw' }">
        <div class="filter-button-group">
            <ToggleButton onLabel="전체" offLabel="전체" :modelValue="filters.group.value === null"
                @update:modelValue="selectFilter('group', null)" class="p-button-sm" />
            <ToggleButton v-for="group in groups" :key="group" :onLabel="group" :offLabel="group"
                :modelValue="filters.group.value === group" @update:modelValue="selectFilter('group', group)"
                class="p-button-sm">
                <Tag :value="group" :severity="getGroupSeverity(group)" />
            </ToggleButton>
        </div>
    </Dialog>
</template>