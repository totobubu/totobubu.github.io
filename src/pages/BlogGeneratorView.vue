<!-- src/pages/BlogGeneratorView.vue -->
<script setup>
    import { ref, computed, nextTick } from 'vue';
    import { useHead } from '@vueuse/head';
    import { getDataUrl } from '@/utils/dataUrl';
    import VChart from 'vue-echarts';
    import JSZip from 'jszip';

    useHead({ title: '배당 블로그 생성기 | DivGrow' });

    // 티커를 파일명으로 변환하는 함수
    const sanitizeTickerForFilename = (ticker) =>
        ticker.replace(/\./g, '-').toLowerCase();

    const ticker = ref('');
    const isLoading = ref(false);
    const error = ref('');
    const generatedBlog = ref(null);

    // 차트 ref들
    const holdingsChartRef = ref(null);
    const dividendChartRef = ref(null);

    // 티커 데이터를 가져오는 함수
    const fetchTickerData = async () => {
        if (!ticker.value.trim()) {
            error.value = '티커를 입력해주세요.';
            return;
        }

        isLoading.value = true;
        error.value = '';
        generatedBlog.value = null;

        try {
            const tickerSymbol = ticker.value.toUpperCase().trim();
            const sanitizedTicker = sanitizeTickerForFilename(tickerSymbol);

            // 로컬 데이터에서 배당금 정보 가져오기 (기존 프로젝트 방식 사용)
            const dataUrl = getDataUrl(`data/${sanitizedTicker}.json`);
            const localDataResponse = await fetch(dataUrl);

            if (!localDataResponse.ok) {
                throw new Error(
                    `${tickerSymbol} 티커 정보를 찾을 수 없습니다. 데이터 파일이 존재하는지 확인해주세요.`
                );
            }

            const dividendData = await localDataResponse.json();

            if (!dividendData || !dividendData.tickerInfo) {
                throw new Error(
                    '티커 데이터가 비어있거나 형식이 올바르지 않습니다.'
                );
            }

            // 블로그 데이터 생성
            generatedBlog.value = generateBlogData(dividendData, tickerSymbol);
        } catch (err) {
            console.error('블로그 생성 오류:', err);
            error.value =
                err.message || '데이터를 불러오는 중 오류가 발생했습니다.';
        } finally {
            isLoading.value = false;
        }
    };

    // 블로그 데이터 생성
    const generateBlogData = (data, tickerSymbol) => {
        const today = new Date();
        const formattedDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

        const tickerInfo = data.tickerInfo || {};
        const backtestData = data.backtestData || [];
        const holdingsData = data.holdings || [];
        const allHoldingsData = data.holdings || []; // 전체 시계열 데이터

        // 배당금이 있는 데이터만 필터링
        const dividendHistory = backtestData
            .filter((item) => item.amount || item.amountFixed)
            .map((item) => ({
                exDate: item.date,
                payDate: item.date, // payDate가 없으면 exDate 사용
                amount: item.amountFixed || item.amount || 0,
                yield: item.yield || 0,
            }))
            .reverse(); // 최신순으로 정렬

        // 최근 배당금 정보
        const recentDividend = dividendHistory[0] || {
            exDate: 'N/A',
            payDate: 'N/A',
            amount: 0,
            yield: 0,
        };

        // 최신 holdings 데이터 가져오기 (가장 최근 날짜)
        let latestHoldings = [];
        let holdingsDate = null;
        let holdingsCount = 0;
        if (holdingsData.length > 0) {
            const latestEntry = holdingsData[holdingsData.length - 1];
            latestHoldings = latestEntry.data || [];
            holdingsDate = latestEntry.date;
            holdingsCount = holdingsData.length;
        }

        // 배당 주기
        const frequency = tickerInfo.frequency || '분기';
        const frequencyMap = {
            매주: 'Weekly',
            매월: 'Monthly',
            분기: 'Quarterly',
            반기: 'Semi-Annually',
            매년: 'Annually',
        };
        const frequencyEn = (() => {
            if (!frequency) return 'Quarterly';
            if (frequencyMap[frequency]) return frequencyMap[frequency];
            if (typeof frequency === 'string') {
                const normalized = frequency.replace(/\s+/g, '');
                const weeklyMatch = normalized.match(/^주(\d+)회$/);
                if (weeklyMatch) {
                    const occurrences = Number(weeklyMatch[1]);
                    if (!Number.isNaN(occurrences) && occurrences > 0) {
                        return occurrences === 1
                            ? 'Weekly'
                            : `${occurrences}x Weekly`;
                    }
                }
            }
            return 'Quarterly';
        })();

        // 연간 배당수익률 계산
        const annualYield = recentDividend.yield
            ? (recentDividend.yield * 100).toFixed(2)
            : '0.00';

        return {
            ticker: tickerSymbol,
            name: tickerInfo.englishName || tickerInfo.longName || tickerSymbol,
            date: formattedDate,
            overview: {
                ticker: tickerSymbol,
                assetManager: tickerInfo.company || 'N/A',
                strategy: tickerInfo.group || 'ETF',
                expenseRatio: 'N/A', // 로컬 데이터에 없음
                aum: 'N/A', // 로컬 데이터에 없음
                listingDate: 'N/A', // 로컬 데이터에 없음
                frequency: frequency,
                currentPrice: tickerInfo.regularMarketPrice || 0,
                priceChange: 0, // 계산 필요
                priceChangePercent: 0, // 계산 필요
            },
            dividend: {
                recent: {
                    exDate: recentDividend.exDate,
                    payDate: recentDividend.payDate,
                    amount: recentDividend.amount,
                    yield: annualYield,
                },
                history: dividendHistory.slice(0, 12),
                frequency: frequency,
                frequencyEn: frequencyEn,
            },
            holdings: latestHoldings,
            holdingsInfo: {
                date: holdingsDate,
                count: holdingsCount,
            },
            allHoldingsData: allHoldingsData, // 전체 holdings 시계열 데이터
            performance: {
                ytdReturn: 'N/A',
                threeYearReturn: 'N/A',
                fiveYearReturn: 'N/A',
            },
        };
    };

    // 배당금 히스토리 차트 옵션
    const dividendChartOptions = computed(() => {
        if (!generatedBlog.value?.dividend?.history) return null;

        const history = generatedBlog.value.dividend.history
            .slice(0, 12)
            .reverse();

        return {
            tooltip: {
                trigger: 'axis',
                formatter: '{b}<br/>배당금: ${c}',
            },
            xAxis: {
                type: 'category',
                data: history.map((d) => d.exDate?.substring(0, 7) || ''),
                axisLabel: {
                    rotate: 45,
                },
            },
            yAxis: {
                type: 'value',
                name: '배당금 ($)',
                axisLabel: {
                    formatter: '${value}',
                },
            },
            series: [
                {
                    data: history.map((d) => d.amount || 0),
                    type: 'bar',
                    itemStyle: {
                        color: '#4CAF50',
                    },
                    label: {
                        show: true,
                        position: 'top',
                        formatter: '${c}',
                    },
                },
            ],
            grid: {
                bottom: 80,
            },
        };
    });

    // 보유 종목 파이 차트 옵션
    const holdingsChartOptions = computed(() => {
        if (
            !generatedBlog.value?.holdings ||
            generatedBlog.value.holdings.length === 0
        )
            return null;

        const topHoldings = generatedBlog.value.holdings.slice(0, 10);

        return {
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}%',
            },
            legend: {
                orient: 'vertical',
                right: 10,
                top: 'center',
                type: 'scroll',
            },
            series: [
                {
                    type: 'pie',
                    radius: ['40%', '70%'],
                    center: ['40%', '50%'],
                    avoidLabelOverlap: false,
                    itemStyle: {
                        borderRadius: 10,
                        borderColor: '#fff',
                        borderWidth: 2,
                    },
                    label: {
                        show: true,
                        formatter: '{b}\n{c}%',
                        fontSize: 11,
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: 14,
                            fontWeight: 'bold',
                        },
                    },
                    data: topHoldings.map((h) => ({
                        name: h.symbol || h.name,
                        value: parseFloat(h.weight) || 0,
                    })),
                },
            ],
        };
    });
    
    // Holdings 변화율 계산
    const holdingsWithChange = computed(() => {
        if (!generatedBlog.value?.holdings || generatedBlog.value.holdings.length === 0) {
            return [];
        }
        
        const currentHoldings = generatedBlog.value.holdings;
        const allHoldingsData = generatedBlog.value?.allHoldingsData || [];
        
        if (allHoldingsData.length < 2) {
            // 직전 데이터가 없으면 변화율 없이 반환
            return currentHoldings.map(h => ({
                ...h,
                change: null,
                changePercent: null
            }));
        }
        
        // 최신과 직전 데이터
        const latestEntry = allHoldingsData[allHoldingsData.length - 1];
        const previousEntry = allHoldingsData[allHoldingsData.length - 2];
        
        const latestMap = new Map(latestEntry.data.map(h => [h.symbol, h.weight]));
        const previousMap = new Map(previousEntry.data.map(h => [h.symbol, h.weight]));
        
        return currentHoldings.map(h => {
            const currentWeight = latestMap.get(h.symbol) || h.weight;
            const previousWeight = previousMap.get(h.symbol);
            
            if (previousWeight !== undefined) {
                const change = currentWeight - previousWeight;
                const changePercent = ((change / previousWeight) * 100);
                return {
                    ...h,
                    change: change,
                    changePercent: changePercent,
                    previousWeight: previousWeight
                };
            }
            
            return {
                ...h,
                change: null,
                changePercent: null,
                previousWeight: null,
                isNew: true // 새로 추가된 종목
            };
        });
    });

    // 차트를 PNG로 다운로드하는 함수
    const downloadChartsAsPng = async () => {
        if (!generatedBlog.value) return;

        await nextTick(); // 차트가 완전히 렌더링될 때까지 대기

        const zip = new JSZip();
        const tickerName = generatedBlog.value.ticker;
        let chartCount = 0;

        try {
            // 보유 종목 차트
            if (holdingsChartRef.value && holdingsChartOptions.value) {
                const holdingsChart = holdingsChartRef.value;
                const holdingsDataUrl = holdingsChart.getDataURL({
                    type: 'png',
                    pixelRatio: 2,
                    backgroundColor: '#ffffff',
                });

                // base64를 blob으로 변환
                const holdingsBlob = await fetch(holdingsDataUrl).then((r) =>
                    r.blob()
                );
                zip.file(`${tickerName}_holdings_chart.png`, holdingsBlob);
                chartCount++;
            }

            // 배당금 히스토리 차트
            if (dividendChartRef.value && dividendChartOptions.value) {
                const dividendChart = dividendChartRef.value;
                const dividendDataUrl = dividendChart.getDataURL({
                    type: 'png',
                    pixelRatio: 2,
                    backgroundColor: '#ffffff',
                });

                const dividendBlob = await fetch(dividendDataUrl).then((r) =>
                    r.blob()
                );
                zip.file(`${tickerName}_dividend_chart.png`, dividendBlob);
                chartCount++;
            }

            if (chartCount === 0) {
                alert('다운로드할 차트가 없습니다.');
                return;
            }

            // ZIP 파일 생성 및 다운로드
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${tickerName}_charts.zip`;
            a.click();
            URL.revokeObjectURL(url);

            alert(`${chartCount}개의 차트가 다운로드되었습니다!`);
        } catch (err) {
            console.error('차트 다운로드 오류:', err);
            alert('차트 다운로드 중 오류가 발생했습니다.');
        }
    };

    // 마크다운 다운로드
    const downloadMarkdown = () => {
        if (!generatedBlog.value) return;

        const markdown = generateMarkdown(generatedBlog.value);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${generatedBlog.value.ticker}_dividend_report.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 마크다운 생성
    const generateMarkdown = (data) => {
        let md = `# ${data.name} (${data.ticker}) 배당금 분석\n\n`;
        md += `작성일: ${data.date}\n\n`;

        md += `## 1. ${data.ticker} ETF 개요\n\n`;
        md += `| 항목 | 내용 |\n`;
        md += `|------|------|\n`;
        md += `| 티커 | ${data.overview.ticker} |\n`;
        md += `| 운용사 | ${data.overview.assetManager} |\n`;
        md += `| 운용전략 | ${data.overview.strategy} |\n`;
        md += `| 총보수 | ${data.overview.expenseRatio} |\n`;
        md += `| 운용규모 (AUM) | ${data.overview.aum} |\n`;
        md += `| 상장일 | ${data.overview.listingDate} |\n`;
        md += `| 분배금 지급 주기 | ${data.overview.frequency} |\n`;
        md += `| 현재가 | $${data.overview.currentPrice.toFixed(2)} |\n\n`;

        md += `## 2. 최근 배당금 정보\n\n`;
        md += `- **배당기준일**: ${data.dividend.recent.exDate}\n`;
        md += `- **지급일**: ${data.dividend.recent.payDate}\n`;
        md += `- **1주당 배당금**: $${data.dividend.recent.amount.toFixed(6)}\n`;
        md += `- **배당수익률**: ${data.dividend.recent.yield}%\n\n`;

        if (data.holdings.length > 0) {
            md += `## 3. 주요 보유 종목\n\n`;
            md += `| 티커 | 종목명 | 비중 |\n`;
            md += `|------|--------|------|\n`;
            data.holdings.slice(0, 10).forEach((h) => {
                md += `| ${h.symbol || 'N/A'} | ${h.name || 'N/A'} | ${h.weight || 0}% |\n`;
            });
            md += `\n`;
        }

        md += `## 4. 배당금 히스토리\n\n`;
        md += `| 기준일 | 배당금 |\n`;
        md += `|--------|--------|\n`;
        data.dividend.history.slice(0, 12).forEach((d) => {
            md += `| ${d.exDate || 'N/A'} | $${(d.amount || 0).toFixed(6)} |\n`;
        });
        md += `\n`;

        md += `## 결론\n\n`;
        md += `${data.ticker}는 ${data.dividend.frequencyEn} 배당을 지급하는 ETF로, `;
        md += `최근 배당금은 $${data.dividend.recent.amount.toFixed(6)}이며 `;
        md += `배당수익률은 ${data.dividend.recent.yield}%입니다.\n\n`;

        md += `---\n\n`;
        md += `*본 포스팅은 개인 투자 기록으로, 투자 권유는 절대 아닙니다. 투자 판단은 본인의 책임입니다.*\n`;

        return md;
    };
</script>

<template>
    <div class="blog-generator-container">
        <div class="page-header">
            <h1 class="page-title">📝 배당 블로그 생성기</h1>
            <p class="page-subtitle">
                티커를 입력하면 자동으로 배당금 분석 블로그 포스트를 생성합니다
            </p>
        </div>

        <!-- 입력 섹션 -->
        <div class="input-card">
            <div class="input-group">
                <div class="ticker-input">
                    <label for="ticker-input">티커 심볼</label>
                    <input
                        id="ticker-input"
                        type="text"
                        v-model="ticker"
                        placeholder="예: WPAY, SCHD, VYM"
                        @keyup.enter="fetchTickerData"
                        :disabled="isLoading"
                        class="ticker-field" />
                </div>
                <button
                    @click="fetchTickerData"
                    :disabled="isLoading"
                    class="generate-button">
                    <span v-if="!isLoading">✨ 블로그 생성</span>
                    <span v-else>⏳ 생성 중...</span>
                </button>
            </div>

            <div v-if="error" class="error-message">
                {{ error }}
            </div>
        </div>

        <!-- 로딩 -->
        <div v-if="isLoading" class="loading-container">
            <div class="spinner"></div>
            <p>데이터를 불러오는 중...</p>
        </div>

        <!-- 생성된 블로그 미리보기 -->
        <div v-if="generatedBlog && !isLoading" class="blog-result">
            <!-- 액션 버튼 -->
            <div class="action-buttons">
                <button @click="downloadChartsAsPng" class="action-btn">
                    📊 차트 PNG 다운로드
                </button>
                <button @click="downloadMarkdown" class="action-btn">
                    💾 마크다운 다운로드
                </button>
            </div>

            <!-- 블로그 미리보기 -->
            <div id="blog-preview" class="blog-preview">
                <!-- 헤더 배너 -->
                <div class="blog-header-banner">
                    <h1>
                        {{ generatedBlog.ticker }} 배당금
                        {{ generatedBlog.date }} | 1주당 ${{
                            generatedBlog.dividend.recent.amount.toFixed(6)
                        }}
                        달러 수익률 | 배당금 기록
                    </h1>
                </div>

                <!-- 1. ETF 개요 -->
                <section class="blog-section">
                    <h2 class="section-title">
                        1. {{ generatedBlog.ticker }} ETF 개요
                    </h2>
                    <h3 class="section-subtitle">[{{ generatedBlog.name }}]</h3>

                    <div class="info-card">
                        <table class="info-table" id="blog-infoview">
                            <tbody>
                                <tr>
                                    <th>티커</th>
                                    <td>{{ generatedBlog.overview.ticker }}</td>
                                </tr>
                                <tr>
                                    <th>운용사</th>
                                    <td>
                                        {{
                                            generatedBlog.overview.assetManager
                                        }}
                                    </td>
                                </tr>
                                <tr>
                                    <th>운용전략</th>
                                    <td>
                                        {{ generatedBlog.overview.strategy }}
                                    </td>
                                </tr>
                                <tr>
                                    <th>총보수</th>
                                    <td>
                                        {{
                                            generatedBlog.overview.expenseRatio
                                        }}
                                    </td>
                                </tr>
                                <tr>
                                    <th>운용규모 (AUM)</th>
                                    <td>{{ generatedBlog.overview.aum }}</td>
                                </tr>
                                <tr>
                                    <th>상장일</th>
                                    <td>
                                        {{ generatedBlog.overview.listingDate }}
                                    </td>
                                </tr>
                                <tr>
                                    <th>분배금 지급 주기</th>
                                    <td>
                                        {{ generatedBlog.overview.frequency }}
                                    </td>
                                </tr>
                                <tr>
                                    <th>현재가</th>
                                    <td class="highlight">
                                        ${{
                                            generatedBlog.overview.currentPrice.toFixed(
                                                2
                                            )
                                        }}
                                        <span
                                            :class="
                                                generatedBlog.overview
                                                    .priceChange >= 0
                                                    ? 'positive'
                                                    : 'negative'
                                            ">
                                            ({{
                                                generatedBlog.overview
                                                    .priceChange >= 0
                                                    ? '+'
                                                    : ''
                                            }}{{
                                                generatedBlog.overview.priceChangePercent.toFixed(
                                                    2
                                                )
                                            }}%)
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- 보유 종목 차트 -->
                    <div v-if="holdingsChartOptions" class="chart-card">
                        <div class="chart-header">
                            <h3>주요 보유 종목</h3>
                            <div v-if="generatedBlog.holdingsInfo.count > 0" class="holdings-info">
                                <span class="info-badge">
                                    📊 총 {{ generatedBlog.holdingsInfo.count }}회 데이터 수집
                                </span>
                                <span class="info-date">
                                    (최신: {{ generatedBlog.holdingsInfo.date }})
                                </span>
                            </div>
                        </div>
                        <VChart
                            ref="holdingsChartRef"
                            :option="holdingsChartOptions"
                            style="height: 400px" />
                    </div>

                    <!-- 보유 종목 테이블 -->
                    <div
                        v-if="holdingsWithChange.length > 0"
                        class="table-card">
                        <h3>주요 보유 종목 상세</h3>
                        <div v-if="generatedBlog.allHoldingsData && generatedBlog.allHoldingsData.length >= 2" class="comparison-info">
                            <span class="comparison-label">
                                📊 {{ generatedBlog.allHoldingsData[generatedBlog.allHoldingsData.length - 1].date }} 
                                vs 
                                {{ generatedBlog.allHoldingsData[generatedBlog.allHoldingsData.length - 2].date }}
                            </span>
                        </div>
                        <table class="data-table holdings-comparison">
                            <thead>
                                <tr>
                                    <th>티커</th>
                                    <th>종목명</th>
                                    <th>비중 (%)</th>
                                    <th v-if="generatedBlog.allHoldingsData && generatedBlog.allHoldingsData.length >= 2">
                                        변화율
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="(holding, index) in holdingsWithChange.slice(0, 10)"
                                    :key="index"
                                    :class="{ 'new-holding': holding.isNew }">
                                    <td><strong>{{ holding.symbol }}</strong></td>
                                    <td>{{ holding.name }}</td>
                                    <td class="weight-cell">
                                        {{ holding.weight?.toFixed(2) || 'N/A' }}%
                                    </td>
                                    <td 
                                        v-if="generatedBlog.allHoldingsData && generatedBlog.allHoldingsData.length >= 2"
                                        class="change-cell">
                                        <span v-if="holding.isNew" class="new-badge">NEW</span>
                                        <span 
                                            v-else-if="holding.change !== null"
                                            :class="{
                                                'change-positive': holding.change > 0,
                                                'change-negative': holding.change < 0,
                                                'change-neutral': holding.change === 0
                                            }">
                                            <span class="change-arrow">
                                                {{ holding.change > 0 ? '▲' : holding.change < 0 ? '▼' : '━' }}
                                            </span>
                                            {{ Math.abs(holding.change).toFixed(2) }}%
                                            <span class="change-percent">
                                                ({{ holding.changePercent > 0 ? '+' : '' }}{{ holding.changePercent.toFixed(1) }}%)
                                            </span>
                                        </span>
                                        <span v-else class="no-data">-</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- 2. 배당금 정보 -->
                <section class="blog-section">
                    <h2 class="section-title">
                        2. {{ generatedBlog.ticker }} 배당금 기록 ({{
                            generatedBlog.dividend.recent.exDate
                        }})
                    </h2>

                    <div class="info-card">
                        <div class="dividend-info">
                            <div class="dividend-main">
                                <div class="dividend-amount">
                                    <span class="label">최근 배당금</span>
                                    <span class="amount"
                                        >${{
                                            generatedBlog.dividend.recent.amount.toFixed(
                                                6
                                            )
                                        }}</span
                                    >
                                </div>
                                <div class="dividend-yield">
                                    <span class="label">배당수익률</span>
                                    <span class="yield"
                                        >{{
                                            generatedBlog.dividend.recent.yield
                                        }}%</span
                                    >
                                </div>
                            </div>
                            <div class="dividend-dates">
                                <div class="date-item">
                                    <span class="label">배당기준일</span>
                                    <span class="value">{{
                                        generatedBlog.dividend.recent.exDate
                                    }}</span>
                                </div>
                                <div class="date-item">
                                    <span class="label">지급일</span>
                                    <span class="value">{{
                                        generatedBlog.dividend.recent.payDate
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 배당금 차트 -->
                    <div v-if="dividendChartOptions" class="chart-card">
                        <h3>배당금 히스토리 (최근 12회)</h3>
                        <VChart
                            ref="dividendChartRef"
                            :option="dividendChartOptions"
                            style="height: 400px" />
                    </div>

                    <!-- 배당금 테이블 -->
                    <div class="table-card">
                        <h3>배당금 상세 내역</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>배당기준일</th>
                                    <th>지급일</th>
                                    <th>배당금 ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="(
                                        item, index
                                    ) in generatedBlog.dividend.history.slice(
                                        0,
                                        12
                                    )"
                                    :key="index">
                                    <td>{{ item.exDate }}</td>
                                    <td>{{ item.payDate }}</td>
                                    <td>
                                        ${{
                                            item.amount?.toFixed(6) ||
                                            '0.000000'
                                        }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- 3. 결론 -->
                <section class="blog-section">
                    <h2 class="section-title">결론</h2>
                    <div class="conclusion-card">
                        <p>
                            <strong>{{ generatedBlog.ticker }}</strong
                            >는
                            <strong>{{
                                generatedBlog.dividend.frequencyEn
                            }}</strong>
                            배당을 지급하는 ETF로, 최근 배당금은
                            <strong
                                >${{
                                    generatedBlog.dividend.recent.amount.toFixed(
                                        6
                                    )
                                }}</strong
                            >이며 배당수익률은
                            <strong
                                >{{
                                    generatedBlog.dividend.recent.yield
                                }}%</strong
                            >입니다.
                        </p>
                        <p>
                            {{ generatedBlog.overview.assetManager }}에서
                            운용하며, 총보수는
                            {{ generatedBlog.overview.expenseRatio }}입니다.
                            {{ generatedBlog.dividend.frequency }} 배당을 원하는
                            투자자들에게 적합한 ETF입니다.
                        </p>
                    </div>
                </section>

                <!-- 면책 조항 -->
                <div class="disclaimer">
                    <span class="icon">ℹ️</span>
                    <p>
                        본 포스팅은 개인 투자 기록으로, 투자 권유는 절대
                        아닙니다. 투자 판단은 본인의 책임입니다.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
    @use '@/styles/pages/blog-generator';
</style>
