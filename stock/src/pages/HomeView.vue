<template>
  <div class="calendar-container">
    <!-- 상단 티커 선택 (PrimeVue MultiSelect) -->
    <div class="multiselect-wrapper">
      <MultiSelect
        v-model="selectedTickers"
        :options="allTickers"
        optionLabel="name"
        placeholder="표시할 티커를 선택하세요"
        :filter="true"
        :maxSelectedLabels="5"
        class="w-full"
      />
    </div>

    <!-- 캘린더 헤더 -->
    <div class="calendar-header">
      <button @click="changeMonth(-1)"><</button>
      <h2>{{ currentMonthLabel }}</h2>
      <button @click="changeMonth(1)">></button>
    </div>

    <!-- 요일 표시 -->
    <div class="weekdays">
      <span>MON</span>
      <span>TUE</span>
      <span>WED</span>
      <span>THU</span>
      <span>FRI</span>
    </div>

    <!-- 캘린더 그리드 -->
    <div class="calendar-grid">
      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="day-cell"
        :class="{ 'other-month': !day.isCurrentMonth }"
      >
        <div class="day-number">{{ day.day }}</div>

        <div v-if="dividendsByDate[day.date]" class="dividend-event">
          <span class="dividend-amount">
            ${{ dividendsByDate[day.date].totalAmount.toFixed(2) }}
          </span>
          <p class="dividend-tickers">
            {{ dividendsByDate[day.date].tickers.join(" • ") }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
// PrimeVue의 MultiSelect 컴포넌트를 임포트합니다.
import MultiSelect from "primevue/multiselect";

// --- 상태(State) 정의 (기존과 동일) ---
const currentDate = ref(new Date());
const allTickers = ref([]);
const selectedTickers = ref([]);
const allDividendData = ref([]);

/**
 * 컴포넌트 마운트 시 데이터 초기화 (기존과 거의 동일)
 */
onMounted(async () => {
  const navResponse = await fetch("/nav.json");
  const navData = await navResponse.json();
  // PrimeVue의 optionLabel을 위해 { name: 'JEPI' } 형태의 객체 배열로 만듭니다.
  allTickers.value = navData.nav.map((item) => ({ name: item.name }));

  const tickerNames = allTickers.value.map((t) => t.name);
  const tickerDataPromises = tickerNames.map((ticker) =>
    fetch(`/data/${ticker.toLowerCase()}.json`).then((res) => res.json())
  );
  const allData = await Promise.all(tickerDataPromises);

  const flatDividendList = [];
  allData.forEach((data) => {
    const tickerSymbol = data.tickerInfo.Symbol;
    if (data.dividendHistory) {
      data.dividendHistory.forEach((dividend) => {
        const parts = dividend.배당락.split(".").map((p) => p.trim());
        const dateStr = `20${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        const amount = parseFloat(dividend.배당금.replace("$", ""));

        flatDividendList.push({
          date: dateStr,
          amount: amount,
          ticker: tickerSymbol,
        });
      });
    }
  });
  allDividendData.value = flatDividendList;
});

/**
 * 선택된 티커들의 배당 정보만 필터링하고 그룹화 (기존과 동일, 완벽하게 재사용 가능)
 */
const dividendsByDate = computed(() => {
  // selectedTickers가 이제 [{name: 'TICKER'}] 형태의 객체 배열이므로, 이름만 추출합니다.
  const selectedNames = selectedTickers.value.map((t) => t.name);
  if (selectedNames.length === 0) return {};

  const filteredDividends = allDividendData.value.filter((div) =>
    selectedNames.includes(div.ticker)
  );

  const processed = {};
  filteredDividends.forEach((div) => {
    if (!processed[div.date]) {
      processed[div.date] = { totalAmount: 0, tickers: [] };
    }
    processed[div.date].totalAmount += div.amount;
    processed[div.date].tickers.push(div.ticker);
  });

  return processed;
});

// --- 기존 캘린더 로직 (변경 없음) ---

const currentMonthLabel = computed(() => {
  return currentDate.value.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
});

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

<style scoped>
.multiselect-wrapper {
  max-width: 600px;
  margin: 0 auto 2rem;
}
/* PrimeVue 컴포넌트의 너비를 조정하기 위한 클래스 */
.w-full {
  width: 100%;
}

/* 기존 스타일은 여기에 그대로 유지 */
.calendar-container {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  width: 100%;
  max-width: 900px;
  margin: 2rem auto;
  padding: 1rem;
}

/* ... (나머지 CSS는 이전과 동일하게 유지) ... */
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.calendar-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
}
.calendar-header button {
  background: none;
  border: 1px solid #ddd;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 1rem;
  color: #555;
  transition: background-color 0.2s;
}
.calendar-header button:hover {
  background-color: #f0f0f0;
}
.weekdays {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #888;
  text-align: center;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background-color: #e0e0e0;
  border: 1px solid #e0e0e0;
}
.day-cell {
  background-color: #fff;
  min-height: 120px;
  padding: 8px;
  position: relative;
}
.day-cell.other-month {
  background-color: #f7f7f7;
}
.day-cell.other-month .day-number {
  color: #ccc;
}
.day-number {
  font-size: 0.8rem;
  font-weight: 500;
  color: #555;
}
.dividend-event {
  margin-top: 8px;
}
.dividend-amount {
  display: inline-block;
  background-color: #4caf50;
  color: white;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 0.9rem;
  font-weight: 700;
}
.dividend-tickers {
  margin-top: 6px;
  font-size: 0.9rem;
  color: #333;
  font-weight: 500;
  word-break: break-word;
}
</style>
