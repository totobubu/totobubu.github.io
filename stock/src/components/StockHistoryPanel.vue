<!-- stock/src/components/StockHistoryPanel.vue -->
<script setup>
import { computed } from "vue";
import Panel from "primevue/panel";
import DataTable from "primevue/datatable";
import Column from "primevue/column";

const props = defineProps({
  history: Array,
  updateTime: String,
  isDesktop: Boolean,
});

// 👇 [핵심 수정 1] 불완전한 데이터를 필터링하는 새로운 computed 속성
const filteredHistory = computed(() => {
  if (!props.history) return [];

  return props.history.filter((item) => {
    // Object.keys(item)은 ["배당락", "배당금", "전일종가", ...] 와 같은 배열을 반환합니다.
    // 이 배열의 길이가 1보다 크다는 것은 '배당락' 외에 다른 데이터가 최소 하나 이상 존재한다는 의미입니다.
    return Object.keys(item).length > 1;
  });
});

const columns = computed(() => {
  // 이제 컬럼 생성은 필터링된 데이터를 기준으로 합니다.
  if (!filteredHistory.value || filteredHistory.value.length === 0) return [];

  const allKeys = new Set();
  // 필터링된 데이터를 순회합니다.
  filteredHistory.value.forEach((item) => {
    Object.keys(item).forEach((key) => allKeys.add(key));
  });

  const desiredOrder = [
    "배당락",
    "배당금",
    "전일종가",
    "당일시가",
    "당일종가",
    "익일종가",
  ];
  const sortedKeys = Array.from(allKeys).sort((a, b) => {
    const indexA = desiredOrder.indexOf(a);
    const indexB = desiredOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return sortedKeys.map((key) => ({ field: key, header: key }));
});
</script>

<template>
  <Panel header="배당금 상세 정보" class="toto-history">
    <template #icons>
      <span class="text-surface-500 dark:text-surface-400">{{
        updateTime
      }}</span>
    </template>
    <!-- 👈 [핵심 수정 2] props.history 대신 filteredHistory를 사용 -->
    <DataTable
      :value="filteredHistory"
      responsiveLayout="scroll"
      stripedRows
      :rows="10"
      paginator
      :paginatorTemplate="
        isDesktop
          ? 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink'
          : 'PrevPageLink CurrentPageReport NextPageLink'
      "
      currentPageReportTemplate="{first} - {last} of {totalRecords}"
    >
      <Column
        v-for="col in columns"
        :key="col.field"
        :field="col.field"
        :header="col.header"
        sortable
      ></Column>
    </DataTable>
  </Panel>
</template>
