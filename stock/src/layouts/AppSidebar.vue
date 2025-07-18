<!-- AppSidebar.vue -->
<script setup>
import { ref, onMounted, computed } from "vue"; // computed 추가
import { useRouter } from "vue-router";
import { joinURL } from "ufo";

import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import RadioButton from "primevue/radiobutton";
import { useFilterState } from "@/composables/useFilterState";
import { useBreakpoint } from "@/composables/useBreakpoint"; // Breakpoint import

const router = useRouter();
const etfList = ref([]);
const isLoading = ref(true);
const error = ref(null);

const { filters } = useFilterState();
const { isDesktop, isMobile } = useBreakpoint(); // isDesktop과 isMobile 가져오기

// --- [핵심 수정 1] 반응형 scrollHeight를 위한 computed 속성 ---
const tableScrollHeight = computed(() => {
  // AppTopbar의 Drawer 헤더 높이가 대략 60px, 테이블 헤더가 60px 정도라고 가정
  const topbarHeight = 60;
  const tableHeaderHeight = 60;
  const totalHeaderHeight = topbarHeight + tableHeaderHeight;

  if (isMobile.value) {
    // 모바일에서는 Drawer 헤더 높이만 고려
    return `calc(100vh - ${topbarHeight}px)`;
  } else {
    // 데스크톱 & 태블릿에서는 전체 높이를 고려 (Drawer가 아닐 수 있으므로)
    // 이 값은 Drawer가 열리는 AppTopbar의 높이와 관련있습니다.
    // 현재 AppTopbar에 있으므로, Drawer 헤더 높이만 빼주면 됩니다.
    return `calc(100vh - ${topbarHeight}px - 2rem)`; // 2rem은 card의 기본 padding
  }
});

const tableSize = computed(() => {
  if (isMobile.value) {
    return "small";
  }
  // 태블릿과 데스크톱은 기본 크기(null) 또는 'large'를 사용할 수 있습니다.
  // PrimeVue 기본값이 적절하므로, null을 반환하여 기본 크기를 사용하게 합니다.
  // 만약 더 크게 하고 싶다면 'large'를 반환하면 됩니다.
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
  const ticker = event.data.name;
  router.push(`/stock/${ticker.toLowerCase()}`);
};

const openFilterDialog = (filterName) => {
  dialogsVisible.value[filterName] = true;
};
// --- Tag 컴포넌트 스타일링을 위한 함수들 ---
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
      dataKey="name"
      selectionMode="single"
      @rowSelect="onRowSelect"
      :globalFilterFields="['name']"
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
        field="name"
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
              text
              rounded
              size="small"
              @click="openFilterDialog('company')"
              :class="{ 'p-button-text': !filters.company.value }"
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
              text
              rounded
              size="small"
              @click="openFilterDialog('frequency')"
              :class="{ 'p-button-text': !filters.frequency.value }"
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
              text
              rounded
              size="small"
              @click="openFilterDialog('group')"
              :class="{ 'p-button-text': !filters.group.value }"
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

    <!-- 독립적인 Dialog들 (변경 없음) -->
    <Dialog
      v-model:visible="dialogsVisible.company"
      modal
      header="운용사 필터"
      :style="{ width: '80vw' }"
      :breakpoints="{ '576px': '95vw' }"
    >
      <div class="filter-options">
        <div class="flex align-items-center">
          <RadioButton
            v-model="filters.company.value"
            inputId="companyAll"
            name="company"
            :value="null"
            @change="dialogsVisible.company = false"
          /><label for="companyAll" class="ml-2">전체</label>
        </div>
        <div
          v-for="company in companies"
          :key="company"
          class="flex align-items-center"
        >
          <RadioButton
            v-model="filters.company.value"
            :inputId="company"
            name="company"
            :value="company"
            @change="dialogsVisible.company = false"
          /><label :for="company" class="ml-2">{{ company }}</label>
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="dialogsVisible.frequency"
      modal
      header="지급주기 필터"
      :style="{ width: '80vw' }"
      :breakpoints="{ '576px': '95vw' }"
    >
      <div class="filter-options">
        <div class="flex align-items-center">
          <RadioButton
            v-model="filters.frequency.value"
            inputId="freqAll"
            name="frequency"
            :value="null"
            @change="dialogsVisible.frequency = false"
          /><label for="freqAll" class="ml-2">전체</label>
        </div>
        <div
          v-for="freq in frequencies"
          :key="freq"
          class="flex align-items-center"
        >
          <RadioButton
            v-model="filters.frequency.value"
            :inputId="freq"
            name="frequency"
            :value="freq"
            @change="dialogsVisible.frequency = false"
          /><label :for="freq" class="ml-2">{{ freq }}</label>
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="dialogsVisible.group"
      modal
      header="그룹 필터"
      :style="{ width: '80vw' }"
      :breakpoints="{ '576px': '95vw' }"
    >
      <div class="filter-options">
        <div class="flex align-items-center">
          <RadioButton
            v-model="filters.group.value"
            inputId="groupAll"
            name="group"
            :value="null"
            @change="dialogsVisible.group = false"
          /><label for="groupAll" class="ml-2">전체</label>
        </div>
        <div
          v-for="group in groups"
          :key="group"
          class="flex align-items-center"
        >
          <RadioButton
            v-model="filters.group.value"
            :inputId="group"
            name="group"
            :value="group"
            @change="dialogsVisible.group = false"
          /><label :for="group" class="ml-2">
            <Tag :value="group" :severity="getGroupSeverity(group)" />
          </label>
        </div>
      </div>
    </Dialog>
  </div>
</template>
