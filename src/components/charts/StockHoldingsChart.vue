<!-- src/components/charts/StockHoldingsChart.vue -->
<script setup>
import { ref, computed, watch } from 'vue';
import VChart from 'vue-echarts';
import Dropdown from 'primevue/dropdown';

const props = defineProps({
    holdingsData: {
        type: Array,
        required: true,
        default: () => []
    }
});

// 선택된 날짜 인덱스 (기본값: 최신 데이터)
const selectedDateIndex = ref(null);

// 날짜 옵션 생성 (최신순)
const dateOptions = computed(() => {
    if (!props.holdingsData || props.holdingsData.length === 0) return [];
    
    return props.holdingsData
        .map((entry, index) => ({
            label: entry.date,
            value: index
        }))
        .reverse(); // 최신순으로 정렬
});

// 초기값 설정: 최신 데이터 선택
watch(() => props.holdingsData, (newData) => {
    if (newData && newData.length > 0 && selectedDateIndex.value === null) {
        selectedDateIndex.value = newData.length - 1; // 최신 데이터
    }
}, { immediate: true });

// 선택된 날짜의 holdings 데이터
const selectedHoldings = computed(() => {
    if (!props.holdingsData || selectedDateIndex.value === null) return [];
    return props.holdingsData[selectedDateIndex.value]?.data || [];
});

// 차트 옵션
const chartOptions = computed(() => {
    if (!selectedHoldings.value || selectedHoldings.value.length === 0) {
        return null;
    }

    const holdings = selectedHoldings.value;
    
    // 데이터 정렬 (비중이 높은 순서대로)
    const sortedHoldings = [...holdings].sort((a, b) => b.weight - a.weight);

    return {
        title: {
            text: `Top Holdings (${dateOptions.value.find(d => d.value === selectedDateIndex.value)?.label || ''})`,
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: (params) => {
                const item = params[0];
                const holding = sortedHoldings[item.dataIndex];
                return `
                    <strong>${holding.symbol}</strong><br/>
                    ${holding.name}<br/>
                    비중: <strong>${holding.weight}%</strong>
                `;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            name: '비중 (%)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: {
                formatter: '{value}%'
            }
        },
        yAxis: {
            type: 'category',
            data: sortedHoldings.map(h => h.symbol),
            inverse: true,
            axisLabel: {
                fontSize: 12
            }
        },
        series: [
            {
                name: '비중',
                type: 'bar',
                data: sortedHoldings.map(h => h.weight),
                itemStyle: {
                    color: (params) => {
                        // 비중에 따라 색상 그라데이션
                        const colors = [
                            '#5470c6',
                            '#91cc75',
                            '#fac858',
                            '#ee6666',
                            '#73c0de',
                            '#3ba272',
                            '#fc8452',
                            '#9a60b4',
                            '#ea7ccc',
                            '#dd6b66'
                        ];
                        return colors[params.dataIndex % colors.length];
                    },
                    borderRadius: [0, 5, 5, 0]
                },
                label: {
                    show: true,
                    position: 'right',
                    formatter: '{c}%',
                    fontSize: 11
                },
                barMaxWidth: 30
            }
        ]
    };
});

// 시계열 비교 차트 옵션 (5개 이상 데이터가 있을 때)
const timeSeriesChartOptions = computed(() => {
    if (!props.holdingsData || props.holdingsData.length < 2) return null;

    // 모든 심볼 수집
    const allSymbols = new Set();
    props.holdingsData.forEach(entry => {
        entry.data.forEach(holding => {
            allSymbols.add(holding.symbol);
        });
    });

    // 상위 5개 종목만 선택 (최신 데이터 기준)
    const latestData = props.holdingsData[props.holdingsData.length - 1].data;
    const top5Symbols = latestData
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map(h => h.symbol);

    // 각 심볼별 시계열 데이터 생성
    const series = top5Symbols.map(symbol => {
        const data = props.holdingsData.map(entry => {
            const holding = entry.data.find(h => h.symbol === symbol);
            return holding ? holding.weight : 0;
        });

        return {
            name: symbol,
            type: 'line',
            data: data,
            smooth: true,
            lineStyle: {
                width: 2
            },
            emphasis: {
                focus: 'series'
            }
        };
    });

    return {
        title: {
            text: 'Top 5 Holdings 비중 변화',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold'
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: (params) => {
                let result = `<strong>${params[0].axisValue}</strong><br/>`;
                params.forEach(item => {
                    result += `${item.seriesName}: <strong>${item.value}%</strong><br/>`;
                });
                return result;
            }
        },
        legend: {
            data: top5Symbols,
            top: '10%',
            left: 'center'
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '20%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: props.holdingsData.map(entry => entry.date),
            boundaryGap: false,
            axisLabel: {
                rotate: 45,
                fontSize: 11
            }
        },
        yAxis: {
            type: 'value',
            name: '비중 (%)',
            axisLabel: {
                formatter: '{value}%'
            }
        },
        series: series
    };
});
</script>

<template>
    <div class="holdings-chart-container">
        <!-- 날짜 선택 드롭다운 (데이터가 있을 때만 표시) -->
        <div v-if="dateOptions.length > 0" class="controls-section">
            <div class="date-selector">
                <label for="date-select">데이터 날짜:</label>
                <Dropdown
                    id="date-select"
                    v-model="selectedDateIndex"
                    :options="dateOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="날짜 선택"
                    class="date-dropdown" />
            </div>
            <div class="data-count">
                총 {{ props.holdingsData.length }}회 데이터
            </div>
        </div>

        <!-- 현재 선택된 날짜의 Holdings 차트 -->
        <div v-if="chartOptions" class="chart-wrapper">
            <VChart :option="chartOptions" autoresize style="height: 500px;" />
        </div>
        
        <!-- Holdings 데이터 테이블 -->
        <div v-if="selectedHoldings.length > 0" class="holdings-table-wrapper">
            <h3>Holdings 상세 정보</h3>
            <table class="holdings-table">
                <thead>
                    <tr>
                        <th>순위</th>
                        <th>티커</th>
                        <th>종목명</th>
                        <th>비중 (%)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr 
                        v-for="(holding, index) in selectedHoldings.slice().sort((a, b) => b.weight - a.weight)" 
                        :key="holding.symbol">
                        <td>{{ index + 1 }}</td>
                        <td><strong>{{ holding.symbol }}</strong></td>
                        <td>{{ holding.name }}</td>
                        <td>{{ holding.weight }}%</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 시계열 비교 차트 (5개 이상 데이터가 있을 때) -->
        <div v-if="timeSeriesChartOptions && props.holdingsData.length >= 5" class="chart-wrapper timeseries-chart">
            <VChart :option="timeSeriesChartOptions" autoresize style="height: 400px;" />
        </div>

        <!-- 데이터 없음 메시지 -->
        <div v-if="!chartOptions" class="no-data-message">
            <i class="pi pi-info-circle" style="font-size: 2rem; color: var(--surface-400);"></i>
            <p>Holdings 데이터가 없습니다.</p>
        </div>
    </div>
</template>

<style scoped lang="scss">
.holdings-chart-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1rem;
}

.controls-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--surface-50);
    border-radius: 0.5rem;
    gap: 1rem;

    @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
    }
}

.date-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    label {
        font-weight: 500;
        white-space: nowrap;
    }

    .date-dropdown {
        min-width: 200px;
    }
}

.data-count {
    color: var(--text-color-secondary);
    font-size: 0.9rem;
}

.chart-wrapper {
    background: white;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

    &.timeseries-chart {
        margin-top: 1rem;
    }
}

.holdings-table-wrapper {
    h3 {
        margin-bottom: 1rem;
        font-size: 1.1rem;
        font-weight: 600;
    }
}

.holdings-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

    thead {
        background: var(--surface-100);
        
        th {
            padding: 0.75rem 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.9rem;
            color: var(--text-color-secondary);
            border-bottom: 2px solid var(--surface-200);

            &:last-child {
                text-align: right;
            }
        }
    }

    tbody {
        tr {
            border-bottom: 1px solid var(--surface-100);
            transition: background-color 0.2s;

            &:hover {
                background: var(--surface-50);
            }

            &:last-child {
                border-bottom: none;
            }
        }

        td {
            padding: 0.75rem 1rem;
            font-size: 0.9rem;

            &:first-child {
                color: var(--text-color-secondary);
                font-weight: 500;
            }

            &:last-child {
                text-align: right;
                font-weight: 600;
                color: var(--primary-color);
            }
        }
    }
}

.no-data-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-color-secondary);
    gap: 1rem;

    p {
        margin: 0;
        font-size: 1.1rem;
    }
}
</style>
