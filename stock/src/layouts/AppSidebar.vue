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
  const ticker = event.data.Symbol;
  router.push(`/stock/${ticker.toLowerCase()}`);
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
      dataKey="Symbol"
      selectionMode="single"
      @rowSelect="onRowSelect"
      :globalFilterFields="['Symbol', 'longName']"
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
        field="Symbol"
        header="티커"
        sortable
        frozen
        class="font-bold toto-column-ticker"
      ></Column>
      <Column field="company" sortable class="toto-column-company">
        <template #header>
          <div class="column-header">
            <Button
              type="button"
              icon="pi pi-filter-fill"
              size="small"
              :variant="filters.company.value ? 'filled' : 'text'"
              @click="openFilterDialog('company')"
              :severity="filters.company.value ? 'info' : 'secondary'"
            />
            <span>운용사</span>
          </div>
        </template>
        <template #body="{ data }">
          <Tag :value="data.company" />
        </template>
      </Column>

      <Column field="frequency" sortable class="toto-column-frequency">
        <template #header>
          <div class="column-header">
            <Button
              type="button"
              icon="pi pi-filter-fill"
              size="small"
              :variant="filters.frequency.value ? 'filled' : 'text'"
              @click="openFilterDialog('frequency')"
              :severity="filters.frequency.value ? 'info' : 'secondary'"
            />
            <span>지급주기</span>
          </div>
        </template>
        <template #body="{ data }">
          <Tag :value="data.frequency" />
        </template>
      </Column>

      <Column field="group" sortable class="toto-column-group">
        <template #header>
          <div class="column-header">
            <Button
              type="button"
              icon="pi pi-filter-fill"
              size="small"
              :variant="filters.group.value ? 'filled' : 'text'"
              @click="openFilterDialog('group')"
              :severity="filters.group.value ? 'info' : 'secondary'"
            />
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

<style scoped>
.filter-button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem 0;
}
.column-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}
</style>
