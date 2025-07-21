<template>
  <div class="calendar-container">
    <!-- 디버깅을 위해 선택된 티커와 최종 데이터를 화면에 직접 출력 -->
    <!-- <div
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
    </div> -->

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
      <!-- <template>의 .day-cell 내부만 수정하면 됩니다. -->

      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="day-cell"
        :class="{ 'other-month': !day.isCurrentMonth }"
      >
        <div class="day-number">{{ day.day }}</div>

        <!-- ★★★★★ 핵심 수정 부분 ★★★★★ -->
        <div v-if="dividendsByDate[day.date]" class="dividend-event">
          <!-- v-for를 사용해 각 배당 항목을 <Tag> 컴포넌트로 렌더링 -->
          <Tag
            v-for="entry in dividendsByDate[day.date].entries"
            :key="entry.ticker"
            :severity="getTickerSeverity(entry.ticker)"
          >
            {{ entry.ticker }}
            <!-- ★★★★★ 핵심 수정 부분 ★★★★★ -->
            <template v-if="entry.amount > 0">
              ${{ formatAmount(entry.amount) }}
            </template>
            <!-- ★★★★★★★★★★★★★★★★★★★ -->
          </Tag>
        </div>
        <!-- ★★★★★★★★★★★★★★★★★★★ -->
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import MultiSelect from "primevue/multiselect";
import Tag from "primevue/tag"; // Tag 컴포넌트 임포트

// --- ★★★★★ 새로운 헬퍼 함수 추가 ★★★★★ ---
// PrimeVue Tag 컴포넌트의 severity 옵션들
const severities = [
  "secondary",
  "success",
  "info",
  "warn",
  "danger",
  "contrast",
];
const tickerColors = new Map(); // 각 티커의 색상을 저장할 Map

/**
 * 티커 이름에 고유한 색상(severity)을 할당하는 함수
 * @param {string} ticker - 티커 이름
 * @returns {string} - PrimeVue Tag의 severity 값
 */
const getTickerSeverity = (ticker) => {
  if (!tickerColors.has(ticker)) {
    // 새로운 티커가 들어오면, 사용 가능한 색상을 순환하며 할당
    const colorIndex = tickerColors.size % severities.length;
    tickerColors.set(ticker, severities[colorIndex]);
  }
  return tickerColors.get(ticker);
};
// --- ★★★★★★★★★★★★★★★★★★★★★★★★★★★ ---
const currentDate = ref(new Date());
const allTickers = ref([]);
const selectedTickers = ref([]);
const allDividendData = ref([]);

// <script setup> 블록에 다음 함수를 추가합니다.
// (기존의 getTickerSeverity 함수 위나 아래 등 적당한 곳에 추가)

/**
 * 배당금 숫자를 규칙에 맞게 포맷팅하는 함수
 * @param {number} amount - 배당금 숫자
 * @returns {string} - 포맷팅된 문자열 (예: "0.3333", "70.00")
 */
const formatAmount = (amount) => {
  if (typeof amount !== "number" || isNaN(amount)) {
    return ""; // 숫자가 아니면 빈 문자열 반환
  }

  // 소수점 아래 부분을 문자열로 추출
  const decimalPart = String(amount).split(".")[1] || "";

  if (decimalPart.length > 4) {
    // 4자리보다 길면 4자리에서 반올림
    return amount.toFixed(4);
  }

  // 2~4자리 사이면 그대로 두어도 되지만, toFixed(2)보다 우선순위를 두기 위해
  // 명시적으로 처리하는 것보다 toFixed(2)와 비교하는 것이 더 간단합니다.
  // 하지만 아래 로직이 더 명확합니다.

  if (decimalPart.length >= 2) {
    // 2자리 이상이면 (그리고 4자리 이하이면) 그대로 반환
    return String(amount);
  } else {
    // 2자리 미만이면 2자리로 고정
    return amount.toFixed(2);
  }
};

// onMounted 부분만 수정된 코드입니다.
onMounted(async () => {
  try {
    const navResponse = await fetch("/nav.json");
    const navData = await navResponse.json();
    allTickers.value = navData.nav.map((item) => ({ name: item.name }));

    if (allTickers.value.length > 0) {
      selectedTickers.value = allTickers.value.slice(0, 8); // 기본 8개 선택
    }

    const tickerNames = allTickers.value.map((t) => t.name);

    // ★★★★★ 핵심 수정 부분 ★★★★★
    const tickerDataPromises = tickerNames.map(async (ticker) => {
      // async 추가
      const response = await fetch(`/data/${ticker.toLowerCase()}.json`);
      if (!response.ok) {
        console.error(`'${ticker}.json' 파일 로드 실패!`);
        return null;
      }
      const jsonData = await response.json();
      // jsonData와 함께 ticker 이름도 반환
      return { tickerName: ticker, data: jsonData };
    });
    // ★★★★★★★★★★★★★★★★★★★

    const allDataWithNames = (await Promise.all(tickerDataPromises)).filter(
      Boolean
    );

    const flatDividendList = [];
    allDataWithNames.forEach(({ tickerName, data }) => {
      // 구조 분해 할당으로 tickerName과 data를 받음
      // data.tickerInfo.Symbol 대신, 우리가 이미 아는 tickerName을 사용합니다.
      const tickerSymbol = tickerName;

      if (data.dividendHistory && Array.isArray(data.dividendHistory)) {
        data.dividendHistory.forEach((dividend) => {
          const parts = dividend.배당락.split(".").map((p) => p.trim());
          const dateStr = `20${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
          const amount = parseFloat(dividend.배당금.replace("$", ""));

          flatDividendList.push({
            date: dateStr,
            amount: amount,
            ticker: tickerSymbol.toUpperCase(),
          });
        });
      }
    });

    allDividendData.value = flatDividendList;
  } catch (error) {
    console.error("데이터 로딩 중 심각한 오류 발생:", error);
  }
});

const dividendsByDate = computed(() => {
  const masterData = allDividendData.value;
  const selectedNames = selectedTickers.value.map((t) => t.name.toUpperCase());

  if (masterData.length === 0 || selectedNames.length === 0) {
    return {};
  }

  const filteredDividends = masterData.filter((div) =>
    selectedNames.includes(div.ticker)
  );

  const processed = {};
  filteredDividends.forEach((div) => {
    if (!processed[div.date]) {
      // 이제 'entries' 라는 배열을 가집니다.
      processed[div.date] = { entries: [] };
    }
    // 각 티커와 배당금 정보를 객체로 묶어 배열에 추가합니다.
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
  margin-top: 8px;
  /* 아래 3줄 추가 */
  display: flex;
  flex-direction: column;
  gap: 4px; /* 태그 사이의 간격 */
}
.dividend-amount {
  display: inline-block;
  background-color: #4caf50;
  color: #fff;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 0.8rem; /* 폰트 크기를 약간 줄여 여러 개가 들어갈 수 있도록 함 */
  font-weight: 700;
  text-align: center; /* 텍스트 가운데 정렬 */
  width: fit-content; /* 내용에 맞게 너비 조절 */
}
.dividend-tickers {
  margin-top: 6px;
  font-size: 0.9rem;
  color: #333;
  font-weight: 500;
  word-break: break-word;
}
.dividend-amount {
}
</style>
