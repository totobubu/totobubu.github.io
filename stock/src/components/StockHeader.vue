<!-- stock/src/components/StockHeader.vue -->
<script setup>
import { computed } from "vue";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";

const props = defineProps({
  info: {
    type: Object,
    required: true,
  },
});

const stats = computed(() => {
  if (!props.info) return [];
  return [
    { title: "시가총액", value: props.info.Volume },
    { title: "52주", value: props.info["52Week"] },
    { title: "NAV", value: props.info.NAV },
    { title: "Total Return", value: props.info.TotalReturn },
  ];
});
</script>

<template>
  <div id="tickerInfo">
    <Accordion>
      <AccordionPanel value="0">
        <AccordionHeader>
          <div class="tickerInfo__header">
            <div class="tickerInfo__brand">
              {{ info.company }} · {{ info.frequency }} · {{ info.group }}
            </div>
            <h2 class="tickerInfo__title">
              {{ info.symbol }} <i>·</i> <small>{{ info.longname }}</small>
            </h2>
          </div>
        </AccordionHeader>
        <AccordionContent>
          <div class="tickerInfo__status">
            <div class="stats">
              <div
                v-for="(stat, index) in stats"
                :key="index"
                class="layout-card"
              >
                <div class="stats-content">
                  <div class="stats-value">{{ stat.value }}</div>
                </div>
                <div class="stats-header">
                  <span class="stats-title">{{ stat.title }}</span>
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>
  </div>
</template>
