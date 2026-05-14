<template>
  <div class="annual-payout-card surface-card border-round-xl p-4 mb-4">
    <h3 class="text-xl font-bold mb-4 text-900">Annual Payout History</h3>
    
    <div class="chart-wrapper mb-5" style="height: 300px;">
      <v-chart ref="chartRef" :option="chartOptions" autoresize @click="onChartClick" />
    </div>

    <!-- Detailed Breakdown Table -->
    <template v-if="selectedYear && selectedYearData.length > 0">
      <h4 class="text-lg font-bold mb-3 text-900" style="letter-spacing: 0.05em;">
        DETAILED BREAKDOWN: {{ selectedYear }}
      </h4>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse detail-table">
          <thead>
            <tr class="border-bottom-1 surface-border text-600 text-sm">
              <th class="p-2 font-normal">Quarter</th>
              <th class="p-2 font-normal">Ex-Div Date</th>
              <th class="p-2 font-normal">Payment Date</th>
              <th class="p-2 font-normal text-right">Amount</th>
              <th class="p-2 font-normal">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in selectedYearData" :key="i" class="border-bottom-1 surface-border">
              <td class="p-2">{{ item.quarterLabel }}</td>
              <td class="p-2">{{ item.exDate }}</td>
              <td class="p-2">-</td>
              <td class="p-2 text-right font-bold text-green-600">${{ formatAmount(item.amount) }}</td>
              <td class="p-2 text-green-600" style="font-style: italic;">Regular</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-top-2 surface-border font-bold">
              <td class="p-2" colspan="3">{{ selectedYear }} Total</td>
              <td class="p-2 text-right text-green-700">${{ formatAmount(selectedYearTotal) }}</td>
              <td class="p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
    <template v-else-if="selectedYear">
      <h4 class="text-lg font-bold mb-3 text-900" style="letter-spacing: 0.05em;">
        DETAILED BREAKDOWN: {{ selectedYear }}
      </h4>
      <p class="text-600 text-center p-4">해당 연도에 배당 데이터가 없습니다.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import VChart from 'vue-echarts';

const props = defineProps({
  dividendHistory: Array
});

const chartRef = ref(null);
const selectedYear = ref(null);

// Parse the "YY.MM.DD" date string into a full year number and month
function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.replace(/\./g, '-').split('-');
  if (parts.length < 3) return null;
  let year = parseInt(parts[0], 10);
  // YY format → 20YY
  if (year < 100) year += 2000;
  const month = parseInt(parts[1], 10); // 1-12
  const day = parseInt(parts[2], 10);
  return { year, month, day };
}

// Get quarter from month (1-based)
function getQuarter(month) {
  return Math.ceil(month / 3);
}

// Group dividendHistory by year, then by quarter
const annualData = computed(() => {
  if (!props.dividendHistory || props.dividendHistory.length === 0) return {};

  const grouped = {};

  for (const item of props.dividendHistory) {
    const parsed = parseDateParts(item['배당락']);
    if (!parsed) continue;

    const { year, month } = parsed;
    const quarter = getQuarter(month);
    const amount = typeof item['배당금'] === 'number' ? item['배당금'] : parseFloat(item['배당금']) || 0;

    if (!grouped[year]) {
      grouped[year] = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, items: [] };
    }
    grouped[year][`Q${quarter}`] += amount;
    grouped[year].items.push({
      exDate: item['배당락'],
      amount,
      month,
      quarter,
      quarterLabel: `Q${quarter}`,
      raw: item
    });
  }

  return grouped;
});

// Sorted years for the chart x-axis
const sortedYears = computed(() => {
  return Object.keys(annualData.value).map(Number).sort((a, b) => a - b);
});

// Auto-select the latest year when data changes
watch(sortedYears, (years) => {
  if (years.length > 0) {
    selectedYear.value = years[years.length - 1];
  }
}, { immediate: true });

// Data for the selected year's table
const selectedYearData = computed(() => {
  if (!selectedYear.value || !annualData.value[selectedYear.value]) return [];
  // Return items sorted by date descending (newest first)
  return [...annualData.value[selectedYear.value].items].sort((a, b) => {
    // Sort by quarter descending, then by month descending
    if (b.quarter !== a.quarter) return b.quarter - a.quarter;
    return b.month - a.month;
  });
});

const selectedYearTotal = computed(() => {
  return selectedYearData.value.reduce((sum, item) => sum + item.amount, 0);
});

function formatAmount(value) {
  if (typeof value !== 'number') return '0.00';
  return value.toFixed(2);
}

// Quarter colors (dark → light green, matching the screenshot)
const quarterColors = {
  Q1: '#1a6b3c',
  Q2: '#2d9d5a',
  Q3: '#6fcf97',
  Q4: '#b8e6cc'
};

const chartOptions = computed(() => {
  const years = sortedYears.value;
  if (years.length === 0) {
    return { graphic: { type: 'text', left: 'center', top: 'middle', style: { text: '배당 데이터 없음', fontSize: 14, fill: '#999' } } };
  }

  const q1Data = years.map(y => Math.round((annualData.value[y]?.Q1 || 0) * 100) / 100);
  const q2Data = years.map(y => Math.round((annualData.value[y]?.Q2 || 0) * 100) / 100);
  const q3Data = years.map(y => Math.round((annualData.value[y]?.Q3 || 0) * 100) / 100);
  const q4Data = years.map(y => Math.round((annualData.value[y]?.Q4 || 0) * 100) / 100);

  // Annual totals for top labels
  const totals = years.map(y => {
    const d = annualData.value[y];
    return Math.round(((d?.Q1 || 0) + (d?.Q2 || 0) + (d?.Q3 || 0) + (d?.Q4 || 0)) * 100) / 100;
  });

  // Determine which year index is selected
  const selectedIdx = years.indexOf(selectedYear.value);

  function makeSeriesItemStyle(baseColor, seriesQuarter) {
    return {
      color: (params) => {
        if (selectedIdx >= 0 && params.dataIndex === selectedIdx) {
          return baseColor; // full opacity for selected
        }
        // Slightly muted for non-selected
        return selectedIdx >= 0 ? baseColor + '99' : baseColor;
      }
    };
  }

  const barWidth = years.length <= 3 ? '40%' : years.length <= 6 ? '50%' : '60%';

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const year = params[0].axisValue;
        let total = 0;
        let rows = '';
        for (const p of params) {
          total += p.value || 0;
          if (p.value > 0) {
            rows += `<div style="display:flex;justify-content:space-between;gap:16px;">
              <span>${p.marker} ${p.seriesName}</span>
              <span style="font-weight:bold;">$${p.value.toFixed(2)}</span>
            </div>`;
          }
        }
        return `<div style="font-weight:bold;margin-bottom:4px;">${year}</div>${rows}
          <div style="border-top:1px solid #ddd;margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;gap:16px;">
            <span>Total</span>
            <span style="font-weight:bold;">$${total.toFixed(2)}</span>
          </div>`;
      }
    },
    legend: {
      data: ['Q1', 'Q2', 'Q3', 'Q4'],
      top: 0,
      textStyle: { fontSize: 11, color: '#666' },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: years.map(String),
      axisLine: { lineStyle: { color: '#ddd' } },
      axisTick: { show: false },
      axisLabel: {
        color: (value) => {
          return parseInt(value) === selectedYear.value ? '#1a6b3c' : '#666';
        },
        fontWeight: (value) => {
          return parseInt(value) === selectedYear.value ? 'bold' : 'normal';
        },
        fontSize: 12
      }
    },
    yAxis: {
      type: 'value',
      show: false
    },
    series: [
      {
        name: 'Q1',
        type: 'bar',
        stack: 'total',
        barWidth,
        itemStyle: makeSeriesItemStyle(quarterColors.Q1, 'Q1'),
        emphasis: { itemStyle: { color: quarterColors.Q1 } },
        data: q1Data,
        label: {
          show: true,
          position: 'inside',
          formatter: (p) => p.value > 0 ? `.${(p.value).toFixed(2).split('.')[1]}` : '',
          fontSize: 11,
          color: '#fff'
        }
      },
      {
        name: 'Q2',
        type: 'bar',
        stack: 'total',
        barWidth,
        itemStyle: makeSeriesItemStyle(quarterColors.Q2, 'Q2'),
        emphasis: { itemStyle: { color: quarterColors.Q2 } },
        data: q2Data,
        label: {
          show: true,
          position: 'inside',
          formatter: (p) => p.value > 0 ? `.${(p.value).toFixed(2).split('.')[1]}` : '',
          fontSize: 11,
          color: '#fff'
        }
      },
      {
        name: 'Q3',
        type: 'bar',
        stack: 'total',
        barWidth,
        itemStyle: makeSeriesItemStyle(quarterColors.Q3, 'Q3'),
        emphasis: { itemStyle: { color: quarterColors.Q3 } },
        data: q3Data,
        label: {
          show: true,
          position: 'inside',
          formatter: (p) => p.value > 0 ? `.${(p.value).toFixed(2).split('.')[1]}` : '',
          fontSize: 11,
          color: '#333'
        }
      },
      {
        name: 'Q4',
        type: 'bar',
        stack: 'total',
        barWidth,
        itemStyle: makeSeriesItemStyle(quarterColors.Q4, 'Q4'),
        emphasis: { itemStyle: { color: quarterColors.Q4 } },
        data: q4Data,
        label: {
          show: true,
          position: 'inside',
          formatter: (p) => p.value > 0 ? `.${(p.value).toFixed(2).split('.')[1]}` : '',
          fontSize: 11,
          color: '#555'
        },
        // Add total label on top of the last (Q4) series
        ...(totals.some(t => t > 0) ? {} : {})
      },
      // Invisible series just for the top total label
      {
        name: 'Total',
        type: 'bar',
        stack: 'total',
        barWidth,
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
        data: years.map(() => 0),
        label: {
          show: true,
          position: 'top',
          formatter: (p) => {
            const total = totals[p.dataIndex];
            return total > 0 ? `$${total.toFixed(2)}` : '';
          },
          fontSize: 12,
          fontWeight: 'bold',
          color: '#1a6b3c'
        },
        tooltip: { show: false }
      }
    ]
  };
});

// Handle chart click → select that year
function onChartClick(params) {
  if (params.componentType === 'series' && params.name) {
    const clickedYear = parseInt(params.name, 10);
    if (!isNaN(clickedYear) && annualData.value[clickedYear]) {
      selectedYear.value = clickedYear;
    }
  }
}
</script>

<style scoped>
.annual-payout-card {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.detail-table tbody tr {
  transition: background-color 0.15s ease;
}

.detail-table tbody tr:hover {
  background-color: rgba(26, 107, 60, 0.05);
}

.detail-table tfoot tr {
  background-color: rgba(26, 107, 60, 0.06);
}
</style>
