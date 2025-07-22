<!-- stock/src/views/HomeView.vue -->
<template>
  <div class="card">
    <Panel id="p-calendar">
      <template #header>
        <div class="p-calendar-search">
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon">
              <i class="pi pi-search"></i>
            </span>
            <InputText
              v-model="groupFilter"
              placeholder="티커 검색"
              class="w-full"
            />
          </div>

          <ScrollPanel>
            <Accordion
              :multiple="false"
              :activeIndex="[0]"
              class="ticker-accordion"
            >
              <AccordionPanel
                v-for="group in filteredGroupedTickers"
                :key="group.company"
                :value="group.company"
              >
                <!-- 👇 [핵심 수정] AccordionHeader/Content를 올바른 슬롯으로 변경 -->
                <AccordionHeader>
                  {{ group.company }}
                  <span v-if="groupFilter">
                    ({{ getSelectedCountInGroup(group) }} /
                    {{ group.items.length }} / {{ group.originalItemCount }})
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

      <div class="calendar-container">
        <div class="calendar-header">
          <button @click="changeMonth(-1)">‹</button>
          <h2>{{ currentMonthLabel }}</h2>
          <button @click="changeMonth(1)">›</button>
        </div>
        <div class="weekdays">
          <span>MON</span><span>TUE</span><span>WED</span><span>THU</span
          ><span>FRI</span>
        </div>
        <div class="calendar-grid">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="day-cell"
            :class="{ 'other-month': !day.isCurrentMonth }"
          >
            <div class="day-number">{{ day.day }}</div>
            <div v-if="dividendsByDate[day.date]" class="dividend-event">
              <Tag
                v-for="entry in dividendsByDate[day.date].entries"
                :key="entry.ticker"
                :severity="getTickerSeverity(entry.ticker)"
              >
                {{ entry.ticker }}
                <template v-if="entry.amount > 0">
                  ${{ formatAmount(entry.amount) }}
                </template>
              </Tag>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import Panel from "primevue/panel";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import ToggleButton from "primevue/togglebutton";
import InputText from "primevue/inputtext";
import ScrollPanel from "primevue/scrollpanel";
import Tag from "primevue/tag";

const currentDate = ref(new Date());
const allTickers = ref([]);
const groupedTickers = ref([]);
const selectedTickers = ref([]);
const allDividendData = ref([]);
const groupFilter = ref("");

const filteredGroupedTickers = computed(() => {
  if (!groupFilter.value) {
    return groupedTickers.value.map((group) => ({
      ...group,
      originalItemCount: group.items.length,
    }));
  }

  const filterText = groupFilter.value.toLowerCase();

  return groupedTickers.value
    .map((group) => {
      const filteredItems = group.items.filter((ticker) =>
        ticker.symbol.toLowerCase().includes(filterText)
      );
      return {
        company: group.company,
        items: filteredItems,
        originalItemCount: group.items.length,
      };
    })
    .filter((group) => group.items.length > 0);
});

const isSelected = (ticker) => {
  return selectedTickers.value.some(
    (selected) => selected.symbol === ticker.symbol
  );
};

const toggleTickerSelection = (ticker) => {
  const index = selectedTickers.value.findIndex(
    (selected) => selected.symbol === ticker.symbol
  );
  if (index > -1) {
    selectedTickers.value.splice(index, 1);
  } else {
    selectedTickers.value.push(ticker);
  }
};

const getSelectedCountInGroup = (group) => {
  return group.items.filter(isSelected).length;
};

const severities = [
  "secondary",
  "success",
  "info",
  "warn",
  "danger",
  "contrast",
];
const tickerColors = new Map();

const getTickerSeverity = (ticker) => {
  if (!tickerColors.has(ticker)) {
    const colorIndex = tickerColors.size % severities.length;
    tickerColors.set(ticker, severities[colorIndex]);
  }
  return tickerColors.get(ticker);
};

const formatAmount = (amount) => {
  if (typeof amount !== "number" || isNaN(amount)) return "";
  const decimalPart = String(amount).split(".")[1] || "";
  if (decimalPart.length > 4) return amount.toFixed(4);
  if (decimalPart.length >= 2) return String(amount);
  return amount.toFixed(2);
};

onMounted(async () => {
  try {
    const navResponse = await fetch("/nav.json");
    const navData = await navResponse.json();
    allTickers.value = navData.nav.map((item) => ({
      symbol: item.symbol,
      longName: item.longName || item.symbol,
      company: item.company || "기타",
    }));
    const groups = allTickers.value.reduce((acc, ticker) => {
      const company = ticker.company;
      if (!acc[company]) {
        acc[company] = [];
      }
      acc[company].push(ticker);
      return acc;
    }, {});
    groupedTickers.value = Object.keys(groups).map((company) => ({
      company: company,
      items: groups[company],
    }));

    if (allTickers.value.length > 0) {
      selectedTickers.value = allTickers.value.slice(0, 8);
    }

    const tickerNames = allTickers.value.map((t) => t.symbol).filter(Boolean);
    const tickerDataPromises = tickerNames.map(async (ticker) => {
      if (!ticker) return null;
      try {
        const response = await fetch(`/data/${ticker.toLowerCase()}.json`);
        if (!response.ok) return null;
        return { tickerName: ticker, data: await response.json() };
      } catch (e) {
        return null;
      }
    });
    const allDataWithNames = (await Promise.all(tickerDataPromises)).filter(
      Boolean
    );
    const flatDividendList = [];
    allDataWithNames.forEach(({ tickerName, data }) => {
      if (data.dividendHistory && Array.isArray(data.dividendHistory)) {
        data.dividendHistory.forEach((dividend) => {
          if (dividend && dividend.배당락 && dividend.배당금) {
            try {
              const parts = dividend.배당락.split(".").map((p) => p.trim());
              const dateStr = `20${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
              const amount = parseFloat(dividend.배당금.replace("$", ""));
              if (!isNaN(amount)) {
                flatDividendList.push({
                  date: dateStr,
                  amount,
                  ticker: tickerName.toUpperCase(),
                });
              }
            } catch (e) {}
          }
        });
      }
    });
    allDividendData.value = flatDividendList;
  } catch (error) {
    console.error("데이터 로딩 중 심각한 오류 발생:", error);
  }
});

const dividendsByDate = computed(() => {
  if (!Array.isArray(selectedTickers.value)) return {};
  const masterData = allDividendData.value;

  const selectedSymbols = selectedTickers.value
    .filter((t) => t && t.symbol)
    .map((t) => t.symbol.toUpperCase());

  if (masterData.length === 0 || selectedSymbols.length === 0) return {};
  const filteredDividends = masterData.filter((div) =>
    selectedSymbols.includes(div.ticker)
  );
  const processed = {};
  filteredDividends.forEach((div) => {
    if (!processed[div.date]) {
      processed[div.date] = { entries: [] };
    }
    processed[div.date].entries.push({
      ticker: div.ticker,
      amount: div.amount,
    });
  });
  return processed;
});

const currentMonthLabel = computed(() =>
  currentDate.value.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  })
);
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();
  const days = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLastDay - i, isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
      });
    }
  }
  return days;
});

function changeMonth(direction) {
  currentDate.value = new Date(
    currentDate.value.setMonth(currentDate.value.getMonth() + direction)
  );
}
</script>
