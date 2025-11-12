<!-- src/components/charts/StockHoldingsChart.vue -->
<script setup>
    import { ref, computed, watch, onMounted } from 'vue';
    import VChart from 'vue-echarts';
    import Dropdown from 'primevue/dropdown';
    import { useBreakpoint } from '@/composables/useBreakpoint.js';

    const props = defineProps({
        holdingsData: {
            type: Array,
            required: true,
            default: () => [],
        },
    });

    const longNameSymbolMap = ref(new Map());
    const symbolMapReady = ref(false);
    let loadSymbolMapPromise = null;

    const { isMobile } = useBreakpoint();

    const normalizeName = (value) => {
        return value
            ? value
                  .toLowerCase()
                  .replace(/™/g, '')
                  .replace(/\./g, ' ')
                  .replace(/[^a-z0-9]+/g, ' ')
                  .trim()
            : '';
    };

    const addSymbolMapEntry = (map, name, symbol) => {
        if (!name || !symbol) return;
        const normalized = normalizeName(name);
        if (!normalized) return;
        if (!map.has(normalized)) {
            map.set(normalized, symbol);
        }
    };

    const generateYieldmaxSynonyms = (underlying) => {
        if (!underlying) return [];
        const raw = underlying.trim();
        const sanitized = raw.replace(/[^a-zA-Z0-9]/g, '');
        const variants = new Set([
            raw,
            sanitized,
            sanitized.toUpperCase(),
            sanitized.toLowerCase(),
        ]);
        const prefixes = ['Yieldmax', 'YieldMax', 'YieldMaxTM', 'YieldmaxTM'];
        const suffixes = [
            'Option Income Strategy ETF',
            'Option Income Strategy ETFs',
            'Option Income ETF',
            'Option Income ETFs',
        ];
        const results = [];
        variants.forEach((variant) => {
            prefixes.forEach((prefix) => {
                suffixes.forEach((suffix) => {
                    results.push(`${prefix} ${variant} ${suffix}`);
                });
            });
        });
        return results;
    };

    const ensureSymbolMapLoaded = async () => {
        if (symbolMapReady.value) return;
        if (!loadSymbolMapPromise) {
            loadSymbolMapPromise = fetch('/nav.json')
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Failed to load nav metadata');
                    }
                    return response.json();
                })
                .then((payload) => {
                    const items = Array.isArray(payload)
                        ? payload
                        : Array.isArray(payload?.nav)
                          ? payload.nav
                          : [];

                    const map = new Map();
                    items.forEach((item) => {
                        addSymbolMapEntry(map, item.longName, item.symbol);
                        addSymbolMapEntry(map, item.englishName, item.symbol);
                        addSymbolMapEntry(map, item.koName, item.symbol);

                        if (
                            item.company === 'YieldMax' &&
                            item.underlying &&
                            item.symbol
                        ) {
                            generateYieldmaxSynonyms(item.underlying).forEach(
                                (synonym) =>
                                    addSymbolMapEntry(map, synonym, item.symbol)
                            );
                        }
                    });
                    longNameSymbolMap.value = map;
                    symbolMapReady.value = true;
                })
                .catch((error) => {
                    console.error(
                        '[Holdings] Failed to build symbol map:',
                        error
                    );
                });
        }
        await loadSymbolMapPromise;
    };

    onMounted(() => {
        ensureSymbolMapLoaded();
    });

    const resolveSymbolByName = (name) => {
        if (!name) return null;
        const normalized = normalizeName(name);
        if (!normalized) return null;
        return longNameSymbolMap.value.get(normalized) || null;
    };

    const resolveDisplaySymbol = (holding) => {
        const resolved = resolveSymbolByName(holding?.name);
        if (resolved) return resolved;
        if (
            holding?.symbol &&
            /^[A-Z.\-]{2,6}$/.test(holding.symbol?.toUpperCase() ?? '')
        ) {
            return holding.symbol.toUpperCase();
        }
        return holding?.symbol ?? '';
    };

    const shouldShowRawIdentifier = (holding, displaySymbol) => {
        if (!holding?.symbol) return false;
        if (!displaySymbol) return false;
        return (
            displaySymbol !== holding.symbol &&
            !/^[A-Z.\-]{2,6}$/.test(holding.symbol?.toUpperCase() ?? '')
        );
    };

    // 선택된 날짜 인덱스 (기본값: 최신 데이터)
    const selectedDateIndex = ref(null);

    // 날짜 옵션 생성 (최신순)
    const dateOptions = computed(() => {
        if (!props.holdingsData || props.holdingsData.length === 0) return [];

        return props.holdingsData
            .map((entry, index) => ({
                label: entry.date,
                value: index,
            }))
            .reverse(); // 최신순으로 정렬
    });

    // 초기값 설정: 최신 데이터 선택
    watch(
        () => props.holdingsData,
        (newData) => {
            if (
                newData &&
                newData.length > 0 &&
                selectedDateIndex.value === null
            ) {
                selectedDateIndex.value = newData.length - 1; // 최신 데이터
            }
        },
        { immediate: true }
    );

    // 선택된 날짜의 holdings 데이터
    const selectedHoldings = computed(() => {
        if (!props.holdingsData || selectedDateIndex.value === null) return [];
        return props.holdingsData[selectedDateIndex.value]?.data || [];
    });

    // 선택된 날짜의 레버리지 익스포저 데이터
    const selectedLeverageExposure = computed(() => {
        if (!props.holdingsData || selectedDateIndex.value === null) return [];
        return (
            props.holdingsData[selectedDateIndex.value]?.leverage_exposure || []
        );
    });

    // 총 익스포저 계산
    const totalExposure = computed(() => {
        const holdingsTotal = selectedHoldings.value.reduce(
            (sum, h) => sum + h.weight,
            0
        );
        const leverageTotal = selectedLeverageExposure.value.reduce(
            (sum, h) => sum + h.weight,
            0
        );
        return holdingsTotal + leverageTotal;
    });

    // 레버리지 익스포저 차트 옵션
    const leverageChartOptions = computed(() => {
        if (
            !selectedLeverageExposure.value ||
            selectedLeverageExposure.value.length === 0
        ) {
            return null;
        }

        const leverage = selectedLeverageExposure.value;
        const sortedLeverage = [...leverage].sort(
            (a, b) => b.weight - a.weight
        );

        return {
            title: {
                text: `레버리지 익스포저 (총 ${leverageTotal.value.toFixed(2)}%)`,
                left: 'center',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: '#ee6666',
                },
                subtext: '파생상품을 통한 간접 노출',
                subtextStyle: {
                    fontSize: 12,
                    color: '#999',
                },
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow',
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
                },
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '20%',
                containLabel: true,
            },
            xAxis: {
                type: 'value',
                name: '익스포저 (%)',
                nameLocation: 'middle',
                nameGap: 30,
                axisLabel: {
                    formatter: '{value}%',
                },
            },
            yAxis: {
                type: 'category',
                data: sortedLeverage.map((h) =>
                    h.type === 'swap' ? 'SWAP' : h.symbol
                ),
                inverse: true,
                axisLabel: {
                    fontSize: 12,
                },
            },
            series: [
                {
                    name: '익스포저',
                    type: 'bar',
                    data: sortedLeverage.map((h) => h.weight),
                    itemStyle: {
                        color: '#ee6666',
                        borderRadius: [0, 5, 5, 0],
                    },
                    label: {
                        show: true,
                        position: 'right',
                        formatter: '{c}%',
                        fontSize: 11,
                    },
                    barMaxWidth: 30,
                },
            ],
        };
    });

    // 레버리지 총합
    const leverageTotal = computed(() => {
        return selectedLeverageExposure.value.reduce(
            (sum, h) => sum + h.weight,
            0
        );
    });

    // 실제 자산 총합
    const holdingsTotal = computed(() => {
        return selectedHoldings.value.reduce((sum, h) => sum + h.weight, 0);
    });

    const MAX_SEGMENTS = 12;

    // 차트 옵션 (실제 보유 자산)
    const chartOptions = computed(() => {
        if (!selectedHoldings.value || selectedHoldings.value.length === 0) {
            return null;
        }

        const holdings = selectedHoldings.value
            .map((holding) => ({
                ...holding,
                weight: Number.parseFloat(holding.weight),
            }))
            .filter((holding) => holding.weight > 0);

        if (holdings.length === 0) return null;

        // 데이터 정렬 (비중이 높은 순서대로)
        const sortedHoldings = [...holdings].sort(
            (a, b) => b.weight - a.weight
        );

        const topHoldings = sortedHoldings.slice(0, MAX_SEGMENTS);
        const others = sortedHoldings.slice(MAX_SEGMENTS);
        const othersTotal = others.reduce(
            (sum, holding) => sum + holding.weight,
            0
        );

        if (others.length > 0 && othersTotal > 0) {
            topHoldings.push({
                symbol: 'OTHERS',
                name: '기타',
                weight: Number(othersTotal.toFixed(2)),
                type: 'others',
            });
        }

        const isDarkTheme =
            document.documentElement.classList.contains('p-dark');
        const pieData = topHoldings.map((holding) => {
            const rawName = holding.name?.trim();
            const rawSymbol = holding.symbol?.trim();
            const isYieldmax =
                rawName && rawName.toLowerCase().includes('yieldmax');

            const resolvedSymbol =
                resolveSymbolByName(rawName) ||
                (isYieldmax && resolveSymbolByName(`${rawName} etf`));

            const displayName =
                resolvedSymbol ||
                (isYieldmax && rawName) ||
                rawSymbol ||
                rawName ||
                '알 수 없음';

            return {
                value: Number(holding.weight.toFixed(2)),
                name: displayName,
                originalName: rawName,
                symbol: rawSymbol,
                type: holding.type,
            };
        });

        const pieDataMap = new Map(
            pieData.map((item) => [item.name, item.value])
        );

        return {
            title: {
                text: `실제 보유 자산 (총 ${holdingsTotal.value.toFixed(2)}%)`,
                left: 'center',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'bold',
                },
                subtext: '펀드가 직접 보유한 주식 및 현금',
                subtextStyle: {
                    fontSize: 12,
                    color: '#999',
                },
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    const holding = params.data;
                    return `
                    <strong>${params.name}</strong><br/>
                    ${
                        holding.originalName &&
                        holding.originalName !== params.name
                            ? `${holding.originalName}<br/>`
                            : ''
                    }
                    ${
                        holding.symbol && holding.symbol !== params.name
                            ? `티커: ${holding.symbol}<br/>`
                            : ''
                    }
                    비중: <strong>${params.value}%</strong>
                `;
                },
            },
            legend: {
                orient: 'vertical',
                right: isMobile.value ? undefined : '5%',
                bottom: isMobile.value ? 0 : undefined,
                left: isMobile.value ? 'center' : undefined,
                top: isMobile.value ? undefined : 'center',
                align: 'left',
                textStyle: {
                    color: isDarkTheme ? '#e2e8f0' : '#1f2937',
                    fontSize: 12,
                },
                formatter: (name) => {
                    const value = pieDataMap.get(name);
                    if (value == null) return name;
                    return `${name}  (${value.toFixed(2)}%)`;
                },
            },
            series: [
                {
                    name: '비중',
                    type: 'pie',
                    radius: isMobile.value ? ['40%', '75%'] : ['35%', '70%'],
                    center: isMobile.value ? ['50%', '50%'] : ['35%', '50%'],
                    data: pieData,
                    label: {
                        formatter: (params) => {
                            if (isMobile.value) {
                                return `${params.data.symbol || params.name}\n${params.percent}%`;
                            }
                            return '{b}\n{d}%';
                        },
                        color: isDarkTheme ? '#f8fafc' : '#1f2937',
                        fontSize: isMobile.value ? 10 : 12,
                        overflow: 'truncate',
                        width: isMobile.value ? 60 : undefined,
                    },
                    labelLine: {
                        length: isMobile.value ? 12 : 18,
                        length2: isMobile.value ? 6 : 12,
                        smooth: true,
                    },
                    itemStyle: {
                        borderRadius: 6,
                        borderColor: isDarkTheme ? '#1f2937' : '#ffffff',
                        borderWidth: 2,
                    },
                    emphasis: {
                        scale: true,
                        scaleSize: 8,
                        focus: 'self',
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.35)',
                        },
                    },
                },
            ],
        };
    });

    // 시계열 비교 차트 옵션 (5개 이상 데이터가 있을 때)
    const timeSeriesChartOptions = computed(() => {
        if (!props.holdingsData || props.holdingsData.length < 2) return null;

        // 모든 심볼 수집
        const allSymbols = new Set();
        props.holdingsData.forEach((entry) => {
            entry.data.forEach((holding) => {
                allSymbols.add(holding.symbol);
            });
        });

        // 상위 5개 종목만 선택 (최신 데이터 기준)
        const latestData =
            props.holdingsData[props.holdingsData.length - 1].data;
        const top5Symbols = latestData
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5)
            .map((h) => h.symbol);

        // 각 심볼별 시계열 데이터 생성
        const series = top5Symbols.map((symbol) => {
            const data = props.holdingsData.map((entry) => {
                const holding = entry.data.find((h) => h.symbol === symbol);
                return holding ? holding.weight : 0;
            });

            return {
                name: symbol,
                type: 'line',
                data: data,
                smooth: true,
                lineStyle: {
                    width: 2,
                },
                emphasis: {
                    focus: 'series',
                },
            };
        });

        const isDarkTheme =
            document.documentElement.classList.contains('p-dark');

        return {
            title: {
                text: 'Top 5 Holdings 비중 변화',
                left: 'center',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: isDarkTheme ? '#f8fafc' : '#0f172a',
                },
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    let result = `<strong>${params[0].axisValue}</strong><br/>`;
                    params.forEach((item) => {
                        result += `${item.seriesName}: <strong>${item.value}%</strong><br/>`;
                    });
                    return result;
                },
            },
            legend: {
                data: top5Symbols,
                top: '10%',
                left: 'center',
                textStyle: {
                    color: isDarkTheme ? '#e2e8f0' : '#1f2937',
                },
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '20%',
                containLabel: true,
            },
            xAxis: {
                type: 'category',
                data: props.holdingsData.map((entry) => entry.date),
                boundaryGap: false,
                axisLabel: {
                    rotate: 45,
                    fontSize: 11,
                    color: isDarkTheme ? '#cbd5f5' : '#475569',
                },
                axisLine: {
                    lineStyle: {
                        color: isDarkTheme ? '#334155' : '#94a3b8',
                    },
                },
                axisTick: {
                    alignWithLabel: true,
                    lineStyle: {
                        color: isDarkTheme ? '#334155' : '#94a3b8',
                    },
                },
            },
            yAxis: {
                type: 'value',
                name: '비중 (%)',
                axisLabel: {
                    formatter: '{value}%',
                    color: isDarkTheme ? '#cbd5f5' : '#475569',
                },
                nameTextStyle: {
                    color: isDarkTheme ? '#e2e8f0' : '#475569',
                },
                axisLine: {
                    lineStyle: {
                        color: isDarkTheme ? '#334155' : '#94a3b8',
                    },
                },
                splitLine: {
                    show: true,
                    lineStyle: {
                        type: 'dashed',
                        color: isDarkTheme
                            ? 'rgba(148, 163, 184, 0.18)'
                            : 'rgba(148, 163, 184, 0.35)',
                    },
                },
            },
            series: series.map((item) => ({
                ...item,
                lineStyle: {
                    ...item.lineStyle,
                    width: 2,
                },
                emphasis: {
                    focus: 'series',
                },
                itemStyle: {
                    opacity: 0.95,
                },
                label: {
                    show: false,
                    color: isDarkTheme ? '#f8fafc' : '#0f172a',
                },
            })),
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
        <div
            v-if="selectedLeverageExposure.length > 0"
            class="exposure-summary">
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

        <!-- 현재 선택된 날짜의 Holdings 차트 -->
        <div v-if="chartOptions" class="chart-wrapper">
            <VChart :option="chartOptions" autoresize style="height: 500px" />
        </div>

        <!-- 시계열 비교 차트 (5개 이상 데이터가 있을 때) -->
        <div
            v-if="timeSeriesChartOptions && props.holdingsData.length >= 2"
            class="chart-wrapper timeseries-chart">
            <VChart
                :option="timeSeriesChartOptions"
                autoresize
                style="height: 400px" />
        </div>

        <!-- 레버리지 익스포저 차트 (있을 때만 표시) -->
        <div v-if="leverageChartOptions" class="chart-wrapper leverage-chart">
            <VChart
                :option="leverageChartOptions"
                autoresize
                style="height: 400px" />
            <div class="chart-note">
                <i class="pi pi-info-circle"></i>
                <span
                    >레버리지 익스포저는 파생상품(스왑 등)을 통한 간접 노출로,
                    실제 보유 자산은 아닙니다.</span
                >
            </div>
        </div>

        <!-- 레버리지 익스포저 테이블 (있을 때만 표시) -->
        <div
            v-if="selectedLeverageExposure.length > 0"
            class="holdings-table-wrapper">
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
                        v-for="(holding, index) in selectedLeverageExposure
                            .slice()
                            .sort((a, b) => b.weight - a.weight)"
                        :key="holding.symbol">
                        <td>{{ index + 1 }}</td>
                        <td>
                            <strong>{{ resolveDisplaySymbol(holding) }}</strong>
                            <span
                                v-if="
                                    shouldShowRawIdentifier(
                                        holding,
                                        resolveDisplaySymbol(holding)
                                    )
                                "
                                class="text-xs text-color-secondary ml-2">
                                {{ holding.symbol }}
                            </span>
                        </td>
                        <td>{{ holding.name }}</td>
                        <td>
                            <span class="type-badge">{{
                                holding.type?.toUpperCase() || 'N/A'
                            }}</span>
                        </td>
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
                        v-for="(holding, index) in selectedHoldings
                            .slice()
                            .sort((a, b) => b.weight - a.weight)"
                        :key="holding.symbol">
                        <td>{{ index + 1 }}</td>
                        <td>
                            <strong>{{ resolveDisplaySymbol(holding) }}</strong>
                            <span
                                v-if="
                                    shouldShowRawIdentifier(
                                        holding,
                                        resolveDisplaySymbol(holding)
                                    )
                                "
                                class="text-xs text-color-secondary ml-2">
                                {{ holding.symbol }}
                            </span>
                        </td>
                        <td>{{ holding.name }}</td>
                        <td>
                            <span class="type-badge" :class="holding.type">{{
                                holding.type?.toUpperCase() || 'N/A'
                            }}</span>
                        </td>
                        <td>{{ holding.weight }}%</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 데이터 없음 메시지 -->
        <div v-if="!chartOptions" class="no-data-message">
            <i class="pi pi-info-circle" style="color: var(--surface-400)"></i>
            <p>Holdings 데이터가 없습니다.</p>
        </div>
    </div>
</template>
