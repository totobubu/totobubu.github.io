<!-- stock/src/components/CalendarTickerSelector.vue -->
<template>
  <div class="p-calendar-search">
    <div class="p-inputgroup">
      <span class="p-inputgroup-addon"><i class="pi pi-search"></i></span>
      <InputText v-model="groupFilter" placeholder="티커 검색" class="w-full" />
    </div>

    <ScrollPanel style="width: 100%; height: 400px">
      <Accordion :multiple="true" :activeIndex="[0]" class="ticker-accordion">
        <AccordionPanel
          v-for="group in filteredGroupedTickers"
          :key="group.company"
          :value="group.company"
        >
          <AccordionHeader>
            {{ group.company }}
            <span v-if="groupFilter">
              ({{ getSelectedCountInGroup(group) }} / {{ group.items.length }} /
              {{ group.originalItemCount }})
            </span>
            <span v-else>
              ({{ getSelectedCountInGroup(group) }} /
              {{ group.originalItemCount }})
            </span>
          </AccordionHeader>
          <AccordionContent>
            <div class="p-calendar-ticker">
              <ToggleButton
                v-for="ticker in group.items"
                :key="ticker.symbol"
                :modelValue="isSelected(ticker)"
                @update:modelValue="toggleTickerSelection(ticker)"
                :onLabel="ticker.symbol"
                :offLabel="ticker.symbol"
              />
            </div>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </ScrollPanel>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import ToggleButton from "primevue/togglebutton";
import InputText from "primevue/inputtext";
import ScrollPanel from "primevue/scrollpanel";

const props = defineProps({
  groupedTickers: Array,
  modelValue: Array, // v-model for selectedTickers
});
const emit = defineEmits(["update:modelValue"]);

const groupFilter = ref("");

const filteredGroupedTickers = computed(() => {
  const localSelectedTickers = props.modelValue;
  if (!groupFilter.value) {
    return props.groupedTickers.map((group) => ({
      ...group,
      originalItemCount: group.items.length,
    }));
  }
  const filterText = groupFilter.value.toLowerCase();
  return props.groupedTickers
    .map((group) => ({
      ...group,
      items: group.items.filter((ticker) =>
        ticker.symbol.toLowerCase().includes(filterText)
      ),
      originalItemCount: group.items.length,
    }))
    .filter((group) => group.items.length > 0);
});

const isSelected = (ticker) => {
  return props.modelValue.some((selected) => selected.symbol === ticker.symbol);
};

const toggleTickerSelection = (ticker) => {
  const localSelectedTickers = [...props.modelValue];
  const index = localSelectedTickers.findIndex(
    (selected) => selected.symbol === ticker.symbol
  );
  if (index > -1) {
    localSelectedTickers.splice(index, 1);
  } else {
    localSelectedTickers.push(ticker);
  }
  emit("update:modelValue", localSelectedTickers);
};

const getSelectedCountInGroup = (group) => {
  return group.items.filter(isSelected).length;
};
</script>
