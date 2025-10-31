<!-- src/pages/BlogGeneratorView.vue -->
<script setup>
import { ref, computed } from 'vue';
import { useHead } from '@vueuse/head';
import { joinURL } from 'ufo';
import VChart from 'vue-echarts';

useHead({ title: '배당 블로그 생성기 | DivGrow' });

// 티커를 파일명으로 변환하는 함수
const sanitizeTickerForFilename = (ticker) => ticker.replace(/\./g, '-').toLowerCase();

const ticker = ref('');
const isLoading = ref(false);
const error = ref('');
const generatedBlog = ref(null);

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
        const dataUrl = joinURL(import.meta.env.BASE_URL, `data/${sanitizedTicker}.json`);
        const localDataResponse = await fetch(dataUrl);
        
        if (!localDataResponse.ok) {
            throw new Error(`${tickerSymbol} 티커 정보를 찾을 수 없습니다. 데이터 파일이 존재하는지 확인해주세요.`);
        }
        
        const dividendData = await localDataResponse.json();
        
        if (!dividendData || !dividendData.tickerInfo) {
            throw new Error('티커 데이터가 비어있거나 형식이 올바르지 않습니다.');
        }

        // 블로그 데이터 생성
        generatedBlog.value = generateBlogData(dividendData, tickerSymbol);
        
    } catch (err) {
        console.error('블로그 생성 오류:', err);
        error.value = err.message || '데이터를 불러오는 중 오류가 발생했습니다.';
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

    // 배당금이 있는 데이터만 필터링
    const dividendHistory = backtestData
        .filter(item => item.amount || item.amountFixed)
        .map(item => ({
            exDate: item.date,
            payDate: item.date, // payDate가 없으면 exDate 사용
            amount: item.amountFixed || item.amount || 0,
            yield: item.yield || 0
        }))
        .reverse(); // 최신순으로 정렬

    // 최근 배당금 정보
    const recentDividend = dividendHistory[0] || {
        exDate: 'N/A',
        payDate: 'N/A',
        amount: 0,
        yield: 0
    };

    // 배당 주기
    const frequency = tickerInfo.frequency || '분기';
    const frequencyMap = {
        '매주': 'Weekly',
        '매월': 'Monthly', 
        '분기': 'Quarterly',
        '반기': 'Semi-Annually',
        '매년': 'Annually'
    };

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
            priceChangePercent: 0 // 계산 필요
        },
        dividend: {
            recent: {
                exDate: recentDividend.exDate,
                payDate: recentDividend.payDate,
                amount: recentDividend.amount,
                yield: annualYield
            },
            history: dividendHistory.slice(0, 12),
            frequency: frequency,
            frequencyEn: frequencyMap[frequency] || 'Quarterly'
        },
        holdings: [], // 로컬 데이터에 없음
        performance: {
            ytdReturn: 'N/A',
            threeYearReturn: 'N/A',
            fiveYearReturn: 'N/A'
        }
    };
};

// 배당금 히스토리 차트 옵션
const dividendChartOptions = computed(() => {
    if (!generatedBlog.value?.dividend?.history) return null;

    const history = generatedBlog.value.dividend.history.slice(0, 12).reverse();
    
    return {
        tooltip: {
            trigger: 'axis',
            formatter: '{b}<br/>배당금: ${c}'
        },
        xAxis: {
            type: 'category',
            data: history.map(d => d.exDate?.substring(0, 7) || ''),
            axisLabel: {
                rotate: 45
            }
        },
        yAxis: {
            type: 'value',
            name: '배당금 ($)',
            axisLabel: {
                formatter: '${value}'
            }
        },
        series: [{
            data: history.map(d => d.amount || 0),
            type: 'bar',
            itemStyle: {
                color: '#4CAF50'
            },
            label: {
                show: true,
                position: 'top',
                formatter: '${c}'
            }
        }],
        grid: {
            bottom: 80
        }
    };
});

// 보유 종목 파이 차트 옵션
const holdingsChartOptions = computed(() => {
    if (!generatedBlog.value?.holdings || generatedBlog.value.holdings.length === 0) return null;

    const topHoldings = generatedBlog.value.holdings.slice(0, 10);
    
    return {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}% ({d}%)'
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 'center'
        },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 10,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: {
                show: true,
                formatter: '{b}: {c}%'
            },
            data: topHoldings.map(h => ({
                name: h.symbol || h.name,
                value: h.weight || 0
            }))
        }]
    };
});

// HTML 복사 기능
const copyBlogHtml = () => {
    const blogContent = document.getElementById('blog-preview').innerHTML;
    navigator.clipboard.writeText(blogContent).then(() => {
        alert('블로그 HTML이 클립보드에 복사되었습니다!');
    });
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
        data.holdings.slice(0, 10).forEach(h => {
            md += `| ${h.symbol || 'N/A'} | ${h.name || 'N/A'} | ${h.weight || 0}% |\n`;
        });
        md += `\n`;
    }
    
    md += `## 4. 배당금 히스토리\n\n`;
    md += `| 기준일 | 배당금 |\n`;
    md += `|--------|--------|\n`;
    data.dividend.history.slice(0, 12).forEach(d => {
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
                        class="ticker-field"
                    />
                </div>
                <button
                    @click="fetchTickerData"
                    :disabled="isLoading"
                    class="generate-button"
                >
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
                <button @click="copyBlogHtml" class="action-btn">
                    📋 HTML 복사
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
                        {{ generatedBlog.ticker }} 배당금 {{ generatedBlog.date }} |
                        1주당 ${{ generatedBlog.dividend.recent.amount.toFixed(6) }} 달러 수익률 |
                        배당금 기록
                    </h1>
                </div>

                <!-- 1. ETF 개요 -->
                <section class="blog-section">
                    <h2 class="section-title">1. {{ generatedBlog.ticker }} ETF 개요</h2>
                    <h3 class="section-subtitle">[{{ generatedBlog.name }}]</h3>

                    <div class="info-card">
                        <div class="info-grid">
                            <div class="info-row">
                                <span class="info-label">티커</span>
                                <span class="info-value">{{ generatedBlog.overview.ticker }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">운용사</span>
                                <span class="info-value">{{ generatedBlog.overview.assetManager }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">운용전략</span>
                                <span class="info-value">{{ generatedBlog.overview.strategy }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">총보수</span>
                                <span class="info-value">{{ generatedBlog.overview.expenseRatio }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">운용규모 (AUM)</span>
                                <span class="info-value">{{ generatedBlog.overview.aum }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">상장일</span>
                                <span class="info-value">{{ generatedBlog.overview.listingDate }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">분배금 지급 주기</span>
                                <span class="info-value">{{ generatedBlog.overview.frequency }}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">현재가</span>
                                <span class="info-value highlight">
                                    ${{ generatedBlog.overview.currentPrice.toFixed(2) }}
                                    <span
                                        :class="generatedBlog.overview.priceChange >= 0 ? 'positive' : 'negative'"
                                    >
                                        ({{ generatedBlog.overview.priceChange >= 0 ? '+' : '' }}{{ generatedBlog.overview.priceChangePercent.toFixed(2) }}%)
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- 보유 종목 차트 -->
                    <div v-if="holdingsChartOptions" class="chart-card">
                        <h3>주요 보유 종목</h3>
                        <VChart :option="holdingsChartOptions" style="height: 400px" />
                    </div>

                    <!-- 보유 종목 테이블 -->
                    <div v-if="generatedBlog.holdings.length > 0" class="table-card">
                        <h3>주요 보유 종목 상세</h3>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>티커</th>
                                    <th>종목명</th>
                                    <th>비중 (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(holding, index) in generatedBlog.holdings.slice(0, 10)" :key="index">
                                    <td>{{ holding.symbol }}</td>
                                    <td>{{ holding.name }}</td>
                                    <td>{{ holding.weight?.toFixed(2) || 'N/A' }}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- 2. 배당금 정보 -->
                <section class="blog-section">
                    <h2 class="section-title">
                        2. {{ generatedBlog.ticker }} 배당금 기록 ({{ generatedBlog.dividend.recent.exDate }})
                    </h2>

                    <div class="info-card">
                        <div class="dividend-info">
                            <div class="dividend-main">
                                <div class="dividend-amount">
                                    <span class="label">최근 배당금</span>
                                    <span class="amount">${{ generatedBlog.dividend.recent.amount.toFixed(6) }}</span>
                                </div>
                                <div class="dividend-yield">
                                    <span class="label">배당수익률</span>
                                    <span class="yield">{{ generatedBlog.dividend.recent.yield }}%</span>
                                </div>
                            </div>
                            <div class="dividend-dates">
                                <div class="date-item">
                                    <span class="label">배당기준일</span>
                                    <span class="value">{{ generatedBlog.dividend.recent.exDate }}</span>
                                </div>
                                <div class="date-item">
                                    <span class="label">지급일</span>
                                    <span class="value">{{ generatedBlog.dividend.recent.payDate }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 배당금 차트 -->
                    <div v-if="dividendChartOptions" class="chart-card">
                        <h3>배당금 히스토리 (최근 12회)</h3>
                        <VChart :option="dividendChartOptions" style="height: 400px" />
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
                                <tr v-for="(item, index) in generatedBlog.dividend.history.slice(0, 12)" :key="index">
                                    <td>{{ item.exDate }}</td>
                                    <td>{{ item.payDate }}</td>
                                    <td>${{ item.amount?.toFixed(6) || '0.000000' }}</td>
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
                            <strong>{{ generatedBlog.ticker }}</strong>는
                            <strong>{{ generatedBlog.dividend.frequencyEn }}</strong> 배당을 지급하는 ETF로,
                            최근 배당금은 <strong>${{ generatedBlog.dividend.recent.amount.toFixed(6) }}</strong>이며
                            배당수익률은 <strong>{{ generatedBlog.dividend.recent.yield }}%</strong>입니다.
                        </p>
                        <p>
                            {{ generatedBlog.overview.assetManager }}에서 운용하며,
                            총보수는 {{ generatedBlog.overview.expenseRatio }}입니다.
                            {{ generatedBlog.dividend.frequency }} 배당을 원하는 투자자들에게 적합한 ETF입니다.
                        </p>
                    </div>
                </section>

                <!-- 면책 조항 -->
                <div class="disclaimer">
                    <span class="icon">ℹ️</span>
                    <p>
                        본 포스팅은 개인 투자 기록으로, 투자 권유는 절대 아닙니다.
                        투자 판단은 본인의 책임입니다.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
// 라이트 모드 강제 적용
.blog-generator-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    background: #ffffff;
    min-height: 100vh;
    color: #333333;

    * {
        color: #333333;
    }

    .page-header {
        text-align: center;
        margin-bottom: 2rem;

        .page-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 0.5rem;
        }

        .page-subtitle {
            font-size: 1.1rem;
            color: #666666;
        }
    }

    .input-card {
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 2rem;

        .input-group {
            display: flex;
            gap: 1rem;
            align-items: flex-end;
            flex-wrap: wrap;
            margin-bottom: 1rem;

            .ticker-input {
                flex: 1;
                min-width: 250px;

                label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 600;
                    color: #333333;
                }

                .ticker-field {
                    width: 100%;
                    font-size: 1.1rem;
                    padding: 0.75rem;
                    border: 1px solid #d0d0d0;
                    border-radius: 4px;
                    background: #ffffff;
                    color: #333333;

                    &:focus {
                        outline: none;
                        border-color: #667eea;
                        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                    }

                    &:disabled {
                        background: #f0f0f0;
                        cursor: not-allowed;
                    }
                }
            }

            .generate-button {
                padding: 0.75rem 2rem;
                font-size: 1.1rem;
                font-weight: 600;
                background: #667eea;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;

                &:hover:not(:disabled) {
                    background: #5568d3;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                &:disabled {
                    background: #cccccc;
                    cursor: not-allowed;
                }
            }
        }

        .error-message {
            padding: 1rem;
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 4px;
            color: #c33;
            font-weight: 500;
        }
    }

    .loading-container {
        text-align: center;
        padding: 3rem;

        .spinner {
            width: 50px;
            height: 50px;
            margin: 0 auto;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        p {
            margin-top: 1rem;
            font-size: 1.1rem;
            color: #666666;
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .blog-result {
        .action-buttons {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
            margin-bottom: 1.5rem;

            .action-btn {
                padding: 0.75rem 1.5rem;
                background: #ffffff;
                border: 1px solid #667eea;
                color: #667eea;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;

                &:hover {
                    background: #667eea;
                    color: #ffffff;
                }
            }
        }

        .blog-preview {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

            .blog-header-banner {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2rem;
                border-radius: 8px;
                margin-bottom: 2rem;
                text-align: center;

                h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0;
                }
            }

            .blog-section {
                margin-bottom: 3rem;

                .section-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #d32f2f;
                    margin-bottom: 0.5rem;
                }

                .section-subtitle {
                    font-size: 1.3rem;
                    color: #666666;
                    margin-bottom: 1.5rem;
                }

                .info-card {
                    margin-bottom: 1.5rem;
                    background: #f8f9fa;
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;

                    .info-grid {
                        display: grid;
                        gap: 1rem;

                        .info-row {
                            display: grid;
                            grid-template-columns: 150px 1fr;
                            padding: 0.75rem;
                            border-bottom: 1px solid #e0e0e0;

                            &:last-child {
                                border-bottom: none;
                            }

                            .info-label {
                                font-weight: 600;
                                color: #666666;
                            }

                            .info-value {
                                color: #333333;

                                &.highlight {
                                    font-weight: 700;
                                    font-size: 1.1rem;
                                }

                                .positive {
                                    color: #4caf50;
                                }

                                .negative {
                                    color: #f44336;
                                }
                            }
                        }
                    }
                }

                .dividend-info {
                    .dividend-main {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 2rem;
                        margin-bottom: 2rem;
                        padding: 1.5rem;
                        background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
                        border-radius: 8px;

                        .dividend-amount,
                        .dividend-yield {
                            text-align: center;

                            .label {
                                display: block;
                                font-size: 0.9rem;
                                color: #666666;
                                margin-bottom: 0.5rem;
                            }

                            .amount,
                            .yield {
                                display: block;
                                font-size: 2rem;
                                font-weight: 700;
                                color: #667eea;
                            }
                        }
                    }

                    .dividend-dates {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 1rem;

                        .date-item {
                            padding: 1rem;
                            background: #ffffff;
                            border: 1px solid #e0e0e0;
                            border-radius: 8px;

                            .label {
                                display: block;
                                font-size: 0.9rem;
                                color: #666666;
                                margin-bottom: 0.3rem;
                            }

                            .value {
                                display: block;
                                font-size: 1.1rem;
                                font-weight: 600;
                                color: #333333;
                            }
                        }
                    }
                }

                .chart-card,
                .table-card {
                    margin-top: 1.5rem;
                    background: #f8f9fa;
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;

                    h3 {
                        margin-top: 0;
                        margin-bottom: 1rem;
                        color: #333333;
                    }
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: #ffffff;
                    border-radius: 4px;
                    overflow: hidden;

                    thead {
                        background: #f0f0f0;

                        th {
                            padding: 0.75rem;
                            text-align: left;
                            font-weight: 600;
                            color: #333333;
                            border-bottom: 2px solid #d0d0d0;
                        }
                    }

                    tbody {
                        tr {
                            &:nth-child(even) {
                                background: #f9f9f9;
                            }

                            td {
                                padding: 0.75rem;
                                color: #333333;
                                border-bottom: 1px solid #e0e0e0;
                            }
                        }
                    }
                }

                .conclusion-card {
                    background: #f8f9fa;
                    padding: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;

                    p {
                        font-size: 1.1rem;
                        line-height: 1.8;
                        margin-bottom: 1rem;
                        color: #333333;

                        &:last-child {
                            margin-bottom: 0;
                        }
                    }
                }
            }

            .disclaimer {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1.5rem;
                background: #fff3cd;
                border: 1px solid #ffc107;
                border-radius: 8px;
                margin-top: 2rem;

                .icon {
                    font-size: 1.5rem;
                }

                p {
                    margin: 0;
                    color: #856404;
                    font-weight: 500;
                }
            }
        }
    }

    @media (max-width: 768px) {
        padding: 1rem;

        .page-header .page-title {
            font-size: 2rem;
        }

        .input-card .input-group {
            flex-direction: column;
            align-items: stretch;

            .ticker-input {
                min-width: 100%;
            }

            .generate-button {
                width: 100%;
            }
        }

        .blog-result {
            .action-buttons {
                flex-direction: column;

                .action-btn {
                    width: 100%;
                }
            }

            .blog-preview {
                padding: 1rem;

                .blog-section {
                    .info-card .info-grid .info-row {
                        grid-template-columns: 1fr;
                        gap: 0.3rem;
                    }

                    .dividend-info {
                        .dividend-main {
                            grid-template-columns: 1fr;
                            gap: 1rem;
                        }

                        .dividend-dates {
                            grid-template-columns: 1fr;
                        }
                    }

                    .data-table {
                        font-size: 0.9rem;

                        thead th,
                        tbody td {
                            padding: 0.5rem;
                        }
                    }
                }
            }
        }
    }
}
</style>

