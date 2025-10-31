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

// 선택된 날짜의 레버리지 익스포저 데이터
const selectedLeverageExposure = computed(() => {
    if (!props.holdingsData || selectedDateIndex.value === null) return [];
    return props.holdingsData[selectedDateIndex.value]?.leverage_exposure || [];
});

// 총 익스포저 계산
const totalExposure = computed(() => {
    const holdingsTotal = selectedHoldings.value.reduce((sum, h) => sum + h.weight, 0);
    const leverageTotal = selectedLeverageExposure.value.reduce((sum, h) => sum + h.weight, 0);
    return holdingsTotal + leverageTotal;
});

// 레버리지 익스포저 차트 옵션
const leverageChartOptions = computed(() => {
    if (!selectedLeverageExposure.value || selectedLeverageExposure.value.length === 0) {
        return null;
    }

    const leverage = selectedLeverageExposure.value;
    const sortedLeverage = [...leverage].sort((a, b) => b.weight - a.weight);

    return {
        title: {
            text: `레버리지 익스포저 (총 ${leverageTotal.value.toFixed(2)}%)`,
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ee6666'
            },
            subtext: '파생상품을 통한 간접 노출',
            subtextStyle: {
                fontSize: 12,
                color: '#999'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: (params) => {
                const item = params[0];
                const holding = sortedLeverage[item.dataIndex];
                return `
                    <strong>${holding.symbol}</strong><br/>
                    ${holding.name}<br/>
                    익스포저: <strong>${holding.weight}%</strong><br/>
                    ${holding.underlying ? `기초자산: ${holding.underlying}` : ''}
                `;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '20%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            name: '익스포저 (%)',
            nameLocation: 'middle',
            nameGap: 30,
            axisLabel: {
                formatter: '{value}%'
            }
        },
        yAxis: {
            type: 'category',
            data: sortedLeverage.map(h => h.type === 'swap' ? 'SWAP' : h.symbol),
            inverse: true,
            axisLabel: {
                fontSize: 12
            }
        },
        series: [
            {
                name: '익스포저',
                type: 'bar',
                data: sortedLeverage.map(h => h.weight),
                itemStyle: {
                    color: '#ee6666',
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

// 레버리지 총합
const leverageTotal = computed(() => {
    return selectedLeverageExposure.value.reduce((sum, h) => sum + h.weight, 0);
});

// 실제 자산 총합
const holdingsTotal = computed(() => {
    return selectedHoldings.value.reduce((sum, h) => sum + h.weight, 0);
});

// 차트 옵션 (실제 보유 자산)
const chartOptions = computed(() => {
    if (!selectedHoldings.value || selectedHoldings.value.length === 0) {
        return null;
    }

    const holdings = selectedHoldings.value;
    
    // 데이터 정렬 (비중이 높은 순서대로)
    const sortedHoldings = [...holdings].sort((a, b) => b.weight - a.weight);

    return {
        title: {
            text: `실제 보유 자산 (총 ${holdingsTotal.value.toFixed(2)}%)`,
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold'
            },
            subtext: '펀드가 직접 보유한 주식 및 현금',
            subtextStyle: {
                fontSize: 12,
                color: '#999'
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

        <!-- 총 익스포저 요약 (레버리지가 있을 때만 표시) -->
        <div v-if="selectedLeverageExposure.length > 0" class="exposure-summary">
            <div class="summary-card">
                <div class="summary-label">실제 보유 자산</div>
                <div class="summary-value">{{ holdingsTotal.toFixed(2) }}%</div>
            </div>
            <div class="summary-divider">+</div>
            <div class="summary-card leverage">
                <div class="summary-label">레버리지 익스포저</div>
                <div class="summary-value">{{ leverageTotal.toFixed(2) }}%</div>
            </div>
            <div class="summary-divider">=</div>
            <div class="summary-card total">
                <div class="summary-label">총 익스포저</div>
                <div class="summary-value">{{ totalExposure.toFixed(2) }}%</div>
            </div>
        </div>

        <!-- 레버리지 익스포저 차트 (있을 때만 표시) -->
        <div v-if="leverageChartOptions" class="chart-wrapper leverage-chart">
            <VChart :option="leverageChartOptions" autoresize style="height: 400px;" />
            <div class="chart-note">
                <i class="pi pi-info-circle"></i>
                <span>레버리지 익스포저는 파생상품(스왑 등)을 통한 간접 노출로, 실제 보유 자산은 아닙니다.</span>
            </div>
        </div>

        <!-- 현재 선택된 날짜의 Holdings 차트 -->
        <div v-if="chartOptions" class="chart-wrapper">
            <VChart :option="chartOptions" autoresize style="height: 500px;" />
        </div>
        
        <!-- 레버리지 익스포저 테이블 (있을 때만 표시) -->
        <div v-if="selectedLeverageExposure.length > 0" class="holdings-table-wrapper">
            <h3>🔴 레버리지 익스포저 상세 정보</h3>
            <table class="holdings-table leverage-table">
                <thead>
                    <tr>
                        <th>순위</th>
                        <th>식별자</th>
                        <th>종목명</th>
                        <th>타입</th>
                        <th>기초자산</th>
                        <th>익스포저 (%)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr 
                        v-for="(holding, index) in selectedLeverageExposure.slice().sort((a, b) => b.weight - a.weight)" 
                        :key="holding.symbol">
                        <td>{{ index + 1 }}</td>
                        <td><strong>{{ holding.symbol }}</strong></td>
                        <td>{{ holding.name }}</td>
                        <td><span class="type-badge">{{ holding.type?.toUpperCase() || 'N/A' }}</span></td>
                        <td>{{ holding.underlying || '-' }}</td>
                        <td>{{ holding.weight }}%</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Holdings 데이터 테이블 -->
        <div v-if="selectedHoldings.length > 0" class="holdings-table-wrapper">
            <h3>📊 실제 보유 자산 상세 정보</h3>
            <table class="holdings-table">
                <thead>
                    <tr>
                        <th>순위</th>
                        <th>티커</th>
                        <th>종목명</th>
                        <th>타입</th>
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
                        <td><span class="type-badge" :class="holding.type">{{ holding.type?.toUpperCase() || 'N/A' }}</span></td>
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

.exposure-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

    @media (max-width: 768px) {
        flex-direction: column;
        gap: 0.5rem;
    }

    .summary-card {
        flex: 1;
        padding: 1rem 1.5rem;
        background: white;
        border-radius: 0.5rem;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

        &.leverage {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;

            .summary-label {
                color: rgba(255, 255, 255, 0.9);
            }
        }

        &.total {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;

            .summary-label {
                color: rgba(255, 255, 255, 0.9);
            }
        }

        .summary-label {
            font-size: 0.85rem;
            color: var(--text-color-secondary);
            margin-bottom: 0.5rem;
            font-weight: 500;
        }

        .summary-value {
            font-size: 1.8rem;
            font-weight: bold;
            font-family: 'Courier New', monospace;
        }
    }

    .summary-divider {
        font-size: 1.5rem;
        font-weight: bold;
        color: white;
        opacity: 0.8;

        @media (max-width: 768px) {
            transform: rotate(90deg);
            font-size: 1.2rem;
        }
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

    &.leverage-chart {
        border: 2px solid #ee6666;
        background: linear-gradient(to bottom, #fff5f5 0%, white 100%);
    }

    .chart-note {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        margin-top: 1rem;
        background: #fff3cd;
        border-left: 4px solid #ff6b6b;
        border-radius: 0.25rem;
        font-size: 0.85rem;
        color: #856404;

        i {
            color: #ff6b6b;
            font-size: 1rem;
        }
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

    &.leverage-table {
        border: 2px solid #ee6666;
        
        thead {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            
            th {
                color: white;
                border-bottom: 2px solid #ff5252;
            }
        }

        tbody tr:hover {
            background: #fff5f5;
        }
    }

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

    .type-badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--surface-200);
        color: var(--text-color-secondary);

        &.equity {
            background: #e3f2fd;
            color: #1976d2;
        }

        &.cash {
            background: #f3e5f5;
            color: #7b1fa2;
        }

        &.swap {
            background: #ffebee;
            color: #d32f2f;
        }

        &.option {
            background: #fff3e0;
            color: #f57c00;
        }

        &.treasury,
        &.treasury_note,
        &.treasury_bill {
            background: #e8f5e9;
            color: #2e7d32;
        }

        &.money_market {
            background: #e1f5fe;
            color: #0277bd;
        }

        &.other {
            background: #f5f5f5;
            color: #616161;
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
