<template>
  <div class="mb-4">
    <h3 class="text-xl font-bold mb-3 text-900" style="color: #166534 !important;">Dividends</h3>
    
    <!-- Dividend Calendar Box -->
    <div class="border-round-xl p-4 mb-3 border-1 surface-border" style="background-color: #e8f0e8;">
      <div class="text-sm font-bold text-600 mb-3 uppercase tracking-wide" style="letter-spacing: 1px;">Dividend Calendar</div>
      
      <div class="grid mb-4">
        <!-- DECLARED DATE -->
        <div class="col-6 md:col-3">
          <div class="border-round-lg p-3 text-center border-1 h-full flex flex-column justify-content-center"
               :style="dateCardStyle(declaredDate)">
            <div class="text-xs mb-2 tracking-wide" :class="dateCardLabelClass(declaredDate)" :style="dateCardLabelStyle(declaredDate)">DECLARED DATE</div>
            <div class="text-2xl font-bold mb-2" :class="dateCardValueClass(declaredDate)" :style="dateCardValueStyle(declaredDate)">{{ formatDateShort(declaredDate) }}</div>
            <div class="text-xs" :class="dateCardStatusClass(declaredDate)" :style="dateCardStatusStyle(declaredDate)">{{ dateStatus(declaredDate) }}</div>
          </div>
        </div>
        <!-- EX-DATE -->
        <div class="col-6 md:col-3">
          <div class="border-round-lg p-3 text-center border-1 h-full flex flex-column justify-content-center"
               :style="dateCardStyle(exDate)">
            <div class="text-xs mb-2 tracking-wide" :class="dateCardLabelClass(exDate)" :style="dateCardLabelStyle(exDate)">EX-DATE</div>
            <div class="text-2xl font-bold mb-2" :class="dateCardValueClass(exDate)" :style="dateCardValueStyle(exDate)">{{ formatDateShort(exDate) }}</div>
            <div class="text-xs" :class="dateCardStatusClass(exDate)" :style="dateCardStatusStyle(exDate)">{{ dateStatus(exDate) }}</div>
          </div>
        </div>
        <!-- RECORD DATE -->
        <div class="col-6 md:col-3">
          <div class="border-round-lg p-3 text-center border-1 h-full flex flex-column justify-content-center"
               :style="dateCardStyle(recordDate)">
            <div class="text-xs mb-2 tracking-wide" :class="dateCardLabelClass(recordDate)" :style="dateCardLabelStyle(recordDate)">RECORD DATE</div>
            <div class="text-2xl font-bold mb-2" :class="dateCardValueClass(recordDate)" :style="dateCardValueStyle(recordDate)">{{ formatDateShort(recordDate) }}</div>
            <div class="text-xs" :class="dateCardStatusClass(recordDate)" :style="dateCardStatusStyle(recordDate)">{{ dateStatus(recordDate) }}</div>
          </div>
        </div>
        <!-- PAYABLE DATE -->
        <div class="col-6 md:col-3">
          <div class="border-round-lg p-3 text-center border-1 h-full flex flex-column justify-content-center relative"
               :style="dateCardStyle(payableDate)">
            <div v-if="!isPassed(payableDate)" class="absolute top-0 right-0 mt-2 mr-2 border-circle bg-red-600" style="width: 8px; height: 8px;"></div>
            <div class="text-xs mb-2 tracking-wide" :class="dateCardLabelClass(payableDate)" :style="dateCardLabelStyle(payableDate)">PAYABLE DATE</div>
            <div class="text-2xl font-bold mb-2" :class="dateCardValueClass(payableDate)" :style="dateCardValueStyle(payableDate)">{{ formatDateShort(payableDate) }}</div>
            <div class="text-xs" :class="dateCardStatusClass(payableDate)" :style="dateCardStatusStyle(payableDate)">{{ dateStatus(payableDate) }}</div>
          </div>
        </div>
      </div>

      <!-- Calendar Strip -->
      <div v-if="nearestUpcoming" class="calendar-strip mt-5">
        <div class="flex justify-content-between text-xs font-bold text-600 mb-4 px-2 md:px-4 text-center">
          <span class="w-2rem">S</span><span class="w-2rem">M</span><span class="w-2rem">T</span><span class="w-2rem">W</span><span class="w-2rem">T</span><span class="w-2rem">F</span><span class="w-2rem">S</span>
        </div>
        <!-- Previous week row -->
        <div class="flex justify-content-between text-lg text-400 mb-4 px-2 md:px-4 text-center">
          <span v-for="d in calendarPrevWeek" :key="'pw'+d" class="w-2rem">{{ d }}</span>
        </div>
        <!-- Target week row -->
        <div class="flex justify-content-between text-lg text-900 px-2 md:px-4 text-center align-items-center">
          <template v-for="(d, i) in calendarTargetWeek" :key="'tw'+i">
            <span v-if="d.isTarget"
              class="w-2rem relative flex align-items-center justify-content-center bg-green-800 text-white border-circle font-bold"
              style="height: 2rem; transform: scale(1.4);">
              {{ d.day }}
              <div class="absolute top-0 right-0 border-circle bg-red-600" style="width: 6px; height: 6px; transform: translate(10%, 10%);"></div>
            </span>
            <span v-else class="w-2rem" :class="d.isCurrentMonth ? '' : 'text-400'">{{ d.day }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- 4 Stats Cards -->
    <div class="grid">
      <div class="col-6">
        <div class="border-round-xl p-3 border-1 surface-border h-full" style="background-color: #f4fcf6;">
          <div class="text-xs font-bold text-800 mb-2 uppercase tracking-wide" style="letter-spacing: 1px;">YIELD</div>
          <div class="text-2xl font-bold" style="color: #166534;">{{ tickerInfo?.yield ? (tickerInfo.yield * 100).toFixed(2) + '%' : tickerInfo?.Yield ? (tickerInfo.Yield * 100).toFixed(2) + '%' : '-' }}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="border-round-xl p-3 border-1 surface-border h-full" style="background-color: #f4fcf6;">
          <div class="text-xs font-bold text-800 mb-2 uppercase tracking-wide" style="letter-spacing: 1px;">ANNUAL PAYOUT</div>
          <div class="text-2xl font-bold text-900">{{ annualPayout ? '$' + annualPayout : '-' }}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="border-round-xl p-3 border-1 surface-border h-full" style="background-color: #f4fcf6;">
          <div class="text-xs font-bold text-800 mb-2 uppercase tracking-wide" style="letter-spacing: 1px;">5Y CAGR</div>
          <div class="text-2xl font-bold" style="color: #166534;">{{ fiveYearCagr }}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="border-round-xl p-3 border-1 surface-border h-full" style="background-color: #f4fcf6;">
          <div class="text-xs font-bold text-800 mb-2 uppercase tracking-wide" style="letter-spacing: 1px;">PAYOUT RATIO</div>
          <div class="text-2xl font-bold text-900">{{ tickerInfo?.payoutRatio ? (tickerInfo.payoutRatio * 100).toFixed(1) + '%' : '-' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tickerInfo: Object,
  dividendHistory: Array,
  forecastedDividends: Array
});

const today = new Date();
today.setHours(0, 0, 0, 0);

// Find the nearest upcoming forecasted/expected dividend date
const nearestUpcoming = computed(() => {
  if (!props.forecastedDividends || props.forecastedDividends.length === 0) return null;
  
  // Sort by date and find the closest one >= today
  const sorted = [...props.forecastedDividends]
    .map(d => ({ ...d, dateObj: new Date(d.date) }))
    .sort((a, b) => a.dateObj - b.dateObj);
  
  const upcoming = sorted.find(d => d.dateObj >= today);
  // If no future date found, use the most recent past one
  return upcoming || sorted[sorted.length - 1];
});

// EX-DATE = basis date (the forecasted date)
const exDate = computed(() => {
  if (!nearestUpcoming.value) return null;
  return new Date(nearestUpcoming.value.date);
});

// DECLARED DATE = basis - 1 day
const declaredDate = computed(() => {
  if (!exDate.value) return null;
  const d = new Date(exDate.value);
  d.setDate(d.getDate() - 1);
  return d;
});

// RECORD DATE = basis (same as ex-date)
const recordDate = computed(() => {
  if (!exDate.value) return null;
  return new Date(exDate.value);
});

// PAYABLE DATE = basis + 1 day
const payableDate = computed(() => {
  if (!exDate.value) return null;
  const d = new Date(exDate.value);
  d.setDate(d.getDate() + 1);
  return d;
});

const isPassed = (date) => {
  if (!date) return false;
  return date < today;
};

const dateStatus = (date) => {
  if (!date) return '-';
  return isPassed(date) ? 'Passed' : 'UPCOMING';
};

const formatDateShort = (date) => {
  if (!date) return '-';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
};

// Card styling based on passed/upcoming
const dateCardClass = (date) => {
  if (!date) return '';
  return isPassed(date) ? '' : '';
};

const dateCardStyle = (date) => {
  if (!date || isPassed(date)) {
    return 'background-color: #ffffff; border-color: #dee2e6; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
  }
  return 'background-color: #cce5d3; border-color: #166534; border-width: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
};

const dateCardLabelClass = (date) => {
  if (!date || isPassed(date)) return 'text-600';
  return 'font-bold';
};

const dateCardLabelStyle = (date) => {
  if (!date || isPassed(date)) return '';
  return 'color: #166534;';
};

const dateCardValueClass = (date) => {
  if (!date || isPassed(date)) return '';
  return 'font-bold';
};

const dateCardValueStyle = (date) => {
  if (!date || isPassed(date)) return 'color: #1e293b;';
  return 'color: #14532d;';
};

const dateCardStatusClass = (date) => {
  if (!date || isPassed(date)) return 'text-600';
  return 'font-bold';
};

const dateCardStatusStyle = (date) => {
  if (!date || isPassed(date)) return '';
  return 'color: #166534;';
};

// Calendar strip logic for the payable date week
const calendarPrevWeek = computed(() => {
  if (!payableDate.value) return [];
  const target = new Date(payableDate.value);
  // Get the Sunday of the target's week
  const targetSunday = new Date(target);
  targetSunday.setDate(target.getDate() - target.getDay());
  // Go one week back
  const prevSunday = new Date(targetSunday);
  prevSunday.setDate(targetSunday.getDate() - 7);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(prevSunday);
    d.setDate(prevSunday.getDate() + i);
    days.push(d.getDate());
  }
  return days;
});

const calendarTargetWeek = computed(() => {
  if (!payableDate.value) return [];
  const target = new Date(payableDate.value);
  const targetDay = target.getDate();
  const targetMonth = target.getMonth();
  // Get Sunday of target's week
  const sunday = new Date(target);
  sunday.setDate(target.getDate() - target.getDay());
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push({
      day: d.getDate(),
      isTarget: d.getDate() === targetDay && d.getMonth() === targetMonth,
      isCurrentMonth: d.getMonth() === targetMonth,
    });
  }
  return days;
});

// Stats
const annualPayout = computed(() => {
  if (!props.dividendHistory || props.dividendHistory.length === 0) return null;
  // Sum of last ~4 entries as approximate annual payout
  const recent = props.dividendHistory.slice(0, 4);
  return recent.reduce((sum, d) => sum + (Number(d['배당금']) || 0), 0).toFixed(2);
});

const fiveYearCagr = computed(() => {
  if (!props.dividendHistory || props.dividendHistory.length < 2) return '-';
  // Get dividends from ~5 years ago vs most recent
  const latest = props.dividendHistory.slice(0, 4);
  const fiveYearsAgo = props.dividendHistory.slice(-4);
  
  const latestAnnual = latest.reduce((s, d) => s + (Number(d['배당금']) || 0), 0);
  const oldAnnual = fiveYearsAgo.reduce((s, d) => s + (Number(d['배당금']) || 0), 0);
  
  if (oldAnnual <= 0 || latestAnnual <= 0) return '-';
  
  const years = Math.min(props.dividendHistory.length / 4, 5);
  if (years < 1) return '-';
  
  const cagr = (Math.pow(latestAnnual / oldAnnual, 1 / years) - 1) * 100;
  return cagr.toFixed(2) + '%';
});
</script>

<style scoped>
</style>
