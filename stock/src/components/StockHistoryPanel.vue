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

const columns = computed(() => {
  if (!props.history || props.history.length === 0) return [];

  const allKeys = new Set();
  props.history.forEach((item) => {
    Object.keys(item).forEach((key) => allKeys.add(key));
  });

  const desiredOrder = ["배당락", "배당금", "전일종가", "당일종가"];
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
    <DataTable
      :value="history"
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
