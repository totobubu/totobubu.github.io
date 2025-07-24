<!-- AppSidebar.vue -->
<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
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
const etfList = ref([]);
const isLoading = ref(true);
const error = ref(null);

const { filters } = useFilterState();
const { isMobile } = useBreakpoint();

const tableScrollHeight = computed(() => {
  const topbarHeight = 60;
  const tableHeaderHeight = 60;
  const totalHeaderHeight = topbarHeight + tableHeaderHeight;
  if (isMobile.value) {
    return `calc(100vh - ${topbarHeight}px)`;
  } else {
    return `calc(100vh - ${topbarHeight}px - 2rem)`;
  }
});

const tableSize = computed(() => {
  if (isMobile.value) {
    return "small";
  }
  return null;
});

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

    // 👇 [핵심 수정] 더 이상 map 변환이 필요 없습니다. 원본 데이터를 그대로 사용합니다.
    etfList.value = data.nav;

    companies.value = [...new Set(data.nav.map((item) => item.company))];
    frequencies.value = [...new Set(data.nav.map((item) => item.frequency))];
    groups.value = [
      ...new Set(data.nav.map((item) => item.group).filter((g) => g)),
    ];
  } catch (err) {
    error.value = "ETF 목록을 불러오는 데 실패했습니다.";
  } finally {
    isLoading.value = false;
  }
});

const onRowSelect = (event) => {
  // 👇 키 이름이 소문자 'symbol'로 바뀌었는지 다시 한번 확인합니다.
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
const getCompanySeverity = (company) => {
  switch (company) {
    case "Roundhill":
      return "secondary";
    case "YieldMax":
      return "secondary";
    case "J.P. Morgan":
      return "secondary";
    case "GraniteShares":
      return "secondary";
    // 필요한 만큼 운용사 추가
    default:
      return "secondary";
  }
};
const getFrequencySeverity = (frequency) => {
  switch (frequency) {
    case "Weekly":
      return "secondary";
    case "Monthly":
      return "secondary";
    case "Quarterly":
      return "secondary";
    case "Every 4 Week":
      return "secondary";
    default:
      return "secondary";
  }
};
const getGroupSeverity = (group) => {
  switch (group) {
    case "A":
      return "danger";
    case "B":
      return "warn";
    case "C":
      return "success";
    case "D":
      return "info";
    case "월요일":
      return "mon";
    case "화요일":
      return "tue";
    case "수요일":
      return "wed";
    case "목요일":
      return "thu";
    case "금요일":
      return "fri";
    default:
      return "secondary";
  }
};
</script>

<template>
  <div class="card p-0">
    <div v-if="isLoading" class="flex justify-center items-center h-48">
      <ProgressSpinner />
    </div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>

    <DataTable
      v-else
      :value="etfList"
      v-model:filters="filters"
      dataKey="symbol"
      selectionMode="single"
      @rowSelect="onRowSelect"
      :globalFilterFields="['symbol', 'longName']"
      class="p-datatable-sm"
      stripedRows
      scrollable
      :scrollHeight="tableScrollHeight"
      :size="tableSize"
    >
      <template #empty>
        <div class="text-center p-4">검색 결과가 없습니다.</div>
      </template>

      <Column
        field="symbol"
        header="티커"
        sortable
        frozen
        class="font-bold toto-column-ticker"
      >
        <template #body="{ data }">
          <span>{{ data.symbol }}</span>
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
              :severity="filters.company.value ? '' : 'secondary'"
            />
          <div class="column-header">
            
            <span>운용사</span>
          </div>
        </template>
        <template #body="{ data }">
          <Tag :value="data.company" />
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
              :severity="filters.frequency.value ? '' : 'secondary'"
            />
          <div class="column-header">
            
            <span>지급주기</span>
          </div>
        </template>
        <template #body="{ data }">
          <Tag :value="data.frequency" />
        </template>
      </Column>

      <Column field="group" sortable class="toto-column-group">
        <template #header>
          <Button
              type="button"
              icon="pi pi-filter-fill"
              size="small"
              :variant="filters.group.value ? 'filled' : 'text'"
              @click="openFilterDialog('group')"
              :severity="filters.group.value ? '' : 'secondary'"
            />
          <div class="column-header">
            
            <span>그룹</span>
          </div>
        </template>
        <template #body="{ data }">
          <Tag
            v-if="data.group"
            :value="data.group"
            :severity="getGroupSeverity(data.group)"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="dialogsVisible.company"
      modal
      header="운용사 필터"
      :style="{ width: '80vw' }"
      :breakpoints="{ '576px': '95vw' }"
    >
      <div class="filter-button-group">
        <ToggleButton
          onLabel="전체"
          offLabel="전체"
          :modelValue="filters.company.value === null"
          @update:modelValue="selectFilter('company', null)"
          class="p-button-sm"
        />
        <ToggleButton
          v-for="company in companies"
          :key="company"
          :onLabel="company"
          :offLabel="company"
          :modelValue="filters.company.value === company"
          @update:modelValue="selectFilter('company', company)"
          class="p-button-sm"
        />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="dialogsVisible.frequency"
      modal
      header="지급주기 필터"
      :style="{ width: '80vw' }"
      :breakpoints="{ '576px': '95vw' }"
    >
      <div class="filter-button-group">
        <ToggleButton
          onLabel="전체"
          offLabel="전체"
          :modelValue="filters.frequency.value === null"
          @update:modelValue="selectFilter('frequency', null)"
          class="p-button-sm"
        />
        <ToggleButton
          v-for="freq in frequencies"
          :key="freq"
          :onLabel="freq"
          :offLabel="freq"
          :modelValue="filters.frequency.value === freq"
          @update:modelValue="selectFilter('frequency', freq)"
          class="p-button-sm"
        />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="dialogsVisible.group"
      modal
      header="그룹 필터"
      :style="{ width: '80vw' }"
      :breakpoints="{ '576px': '95vw' }"
    >
      <div class="filter-button-group">
        <ToggleButton
          onLabel="전체"
          offLabel="전체"
          :modelValue="filters.group.value === null"
          @update:modelValue="selectFilter('group', null)"
          class="p-button-sm"
        />
        <ToggleButton
          v-for="group in groups"
          :key="group"
          :onLabel="group"
          :offLabel="group"
          :modelValue="filters.group.value === group"
          @update:modelValue="selectFilter('group', group)"
          class="p-button-sm"
        >
          <Tag :value="group" :severity="getGroupSeverity(group)" />
        </ToggleButton>
      </div>
    </Dialog>
  </div>
</template>
