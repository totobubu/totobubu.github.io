<template>
  <div class="calendar-container">
    <!-- 디버깅을 위해 선택된 티커와 최종 데이터를 화면에 직접 출력 -->
    <div
      style="
        background: #eee;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 8px;
      "
    >
      <p><strong>[디버깅 정보]</strong></p>
      <p>선택된 티커: {{ selectedTickers.map((t) => t.name) }}</p>
      <p>
        캘린더에 표시될 데이터 (아래에 내용이 없다면 데이터가 없는 것입니다):
      </p>
      <pre style="white-space: pre-wrap; word-break: break-all">{{
        dividendsByDate
      }}</pre>
    </div>

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

    <!-- 이하 캘린더 UI는 동일 -->
    <div class="calendar-header">
      <button @click="changeMonth(-1)"><</button>
      <h2>{{ currentMonthLabel }}</h2>
      <button @click="changeMonth(1)">></button>
    </div>
    <div class="weekdays">
      <span>MON</span>
      <span>TUE</span>
      <span>WED</span>
      <span>THU</span>
      <span>FRI</span>
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
          <span class="dividend-amount"
            >${{ dividendsByDate[day.date].totalAmount.toFixed(2) }}</span
          >
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
import MultiSelect from "primevue/multiselect";

const currentDate = ref(new Date());
const allTickers = ref([]);
const selectedTickers = ref([]); // 초기값은 비어있음
const allDividendData = ref([]);

onMounted(async () => {
  try {
    const navResponse = await fetch("/nav.json");
    const navData = await navResponse.json();
    allTickers.value = navData.nav.map((item) => ({ name: item.name }));

    // ★★★★★ 핵심 수정 부분 ★★★★★
    // 전체 티커 목록을 가져온 후, 처음 5개를 기본 선택값으로 설정합니다.
    if (allTickers.value.length > 0) {
      selectedTickers.value = allTickers.value.slice(0, 5);
    }
    // ★★★★★★★★★★★★★★★★★★★

    const tickerNames = allTickers.value.map((t) => t.name);
    const tickerDataPromises = tickerNames.map((ticker) =>
      fetch(`/data/${ticker.toLowerCase()}.json`).then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${ticker}.json`);
        return res.json();
      })
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
  } catch (error) {
    console.error("데이터 로딩 중 심각한 오류 발생:", error);
  }
});

// `dividendsByDate` computed 속성은 수정할 필요 없이 완벽합니다.
const dividendsByDate = computed(() => {
  const masterData = allDividendData.value;
  const selectedNames = selectedTickers.value.map((t) => t.name);

  if (masterData.length === 0 || selectedNames.length === 0) {
    return {};
  }

  const filteredDividends = masterData.filter((div) =>
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

// --- 이하 캘린더 로직은 변경 없음 ---
// (기존 코드 그대로 두시면 됩니다)
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

<style scoped>
.multiselect-wrapper {
  max-width: 600px;
  margin: 0 auto 2rem;
}
.w-full {
  width: 100%;
}
.calendar-container {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  width: 100%;
  max-width: 900px;
  margin: 2rem auto;
  padding: 1rem;
}
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
  color: #fff;
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
