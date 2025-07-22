<!-- stock/src/components/CalendarGrid.vue -->
<template>
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
            <template v-if="entry.amount > 0"
              >${{ formatAmount(entry.amount) }}</template
            >
          </Tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import Tag from "primevue/tag";

const props = defineProps({
  dividendsByDate: Object,
});

const currentDate = ref(new Date());

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
