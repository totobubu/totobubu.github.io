// src/composables/useStockData.js
import { ref } from 'vue';
import { joinURL } from 'ufo';
import { getDataUrl } from '@/utils/dataUrl';

const tickerInfo = ref(null);
const dividendHistory = ref([]);
const backtestData = ref([]);
const holdingsData = ref([]);
const isLoading = ref(false);
const error = ref(null);
const isUpcoming = ref(false);
let navDataCache = null;

const loadNavData = async () => {
    if (navDataCache) return navDataCache;
    try {
        const navUrl = getDataUrl('nav.json');
        const navResponse = await fetch(navUrl);
        if (!navResponse.ok) throw new Error('nav.json not found');
        navDataCache = await navResponse.json();
        return navDataCache;
    } catch (e) {
        console.error('Failed to load nav.json', e);
        return { nav: [] };
    }
};

const sanitizeTickerForFilename = (ticker) =>
    ticker ? ticker.replace(/\./g, '-').toLowerCase() : '';

const MARKET_SUFFIX_REGEX = /-(ks|kq|kn|ko)$/i;
const SYMBOL_SUFFIX_REGEX = /\.(KS|KQ|KN|KO)$/i;

const stripMarketSuffix = (sanitizedTicker) =>
    sanitizedTicker ? sanitizedTicker.replace(MARKET_SUFFIX_REGEX, '') : '';

const stripSymbolSuffix = (symbol) => {
    if (!symbol) return '';
    const match = symbol.match(SYMBOL_SUFFIX_REGEX);
    if (match) {
        return symbol.slice(0, -match[0].length);
    }
    return symbol;
};

const isKoreanMarket = (market) =>
    ['KOSPI', 'KOSDAQ', 'KONEX'].includes((market || '').toUpperCase());

const marketNameMap = {
    NMS: 'NASDAQ',
    NYQ: 'NYSE',
    KOE: 'KOSDAQ',
    KSC: 'KOSPI',
    NCM: 'NASDAQ',
    NGM: 'NASDAQ',
    ASE: 'NYSE',
};

const truncateDecimals = (value, digits = 2) => {
    if (typeof value !== 'number') return value;
    const factor = 10 ** digits;
    const scaled = value * factor;
    return (scaled >= 0 ? Math.floor(scaled) : Math.ceil(scaled)) / factor;
};

const isUsdUsMarket = (currency, market) => {
    if (currency !== 'USD') return false;
    const normalizedMarket = (market || '').toUpperCase();
    return ['NASDAQ', 'NYSE', 'AMEX'].some((keyword) =>
        normalizedMarket.includes(keyword)
    );
};

const uniqueArray = (items = []) => {
    const seen = new Set();
    const result = [];
    items.forEach((item) => {
        if (!item) return;
        if (seen.has(item)) return;
        seen.add(item);
        result.push(item);
    });
    return result;
};

const buildStaticDataCandidates = (navInfo) => {
    if (!navInfo) return [];
    const candidates = [];
    if (navInfo.dataPath) {
        candidates.push(navInfo.dataPath);
    }
    if (Array.isArray(navInfo.dataPaths)) {
        candidates.push(...navInfo.dataPaths);
    }
    const fallbackSlug = sanitizeTickerForFilename(
        navInfo.yfSymbol || navInfo.symbol
    );
    if (fallbackSlug) {
        candidates.push(`data/${fallbackSlug}.json`);
    }
    return uniqueArray(candidates);
};

const fetchStaticData = async (paths = []) => {
    for (const relativePath of paths) {
        try {
            const response = await fetch(getDataUrl(relativePath));
            if (response.ok) {
                const json = await response.json();
                return { data: json, path: relativePath };
            }
        } catch (error) {
            console.warn(
                `[useStockData] Failed to load ${relativePath}`,
                error
            );
        }
    }
    return { data: null, path: null };
};

export function useStockData() {
    const loadData = async (sanitizedTicker) => {
        if (!sanitizedTicker) {
            error.value = '티커 정보가 없습니다.';
            return;
        }

        isLoading.value = true;
        error.value = null;
        isUpcoming.value = false;
        tickerInfo.value = null;
        dividendHistory.value = [];
        backtestData.value = [];
        holdingsData.value = [];

        try {
            const navData = await loadNavData();
            const normalizedTicker = stripMarketSuffix(sanitizedTicker);
            const navInfo =
                navData.nav.find(
                    (item) =>
                        sanitizeTickerForFilename(item.symbol) ===
                        normalizedTicker
                ) ||
                navData.nav.find(
                    (item) =>
                        sanitizeTickerForFilename(item.yfSymbol || '') ===
                        sanitizedTicker
                );

            if (!navInfo) {
                const displayLabel = (() => {
                    if (!normalizedTicker) return sanitizedTicker.toUpperCase();
                    return normalizedTicker.toUpperCase();
                })();

                throw new Error(
                    `'${displayLabel}'에 대한 종목 정보를 찾을 수 없습니다.`
                );
            }

            if (navInfo.upcoming) {
                isUpcoming.value = true;
                tickerInfo.value = navInfo;
                isLoading.value = false;
                return;
            }

            const originalTickerSymbol = navInfo.yfSymbol || navInfo.symbol;
            const staticDataCandidates = buildStaticDataCandidates(navInfo);
            const { data: staticData } =
                await fetchStaticData(staticDataCandidates);

            if (staticData) {
                const fullBacktestData = staticData.backtestData || [];

                const inferredCurrency =
                    staticData.tickerInfo?.currency || navInfo.currency || null;
                const inferredMarket =
                    staticData.tickerInfo?.market || navInfo.market || null;
                const applyUsdPriceTruncation = isUsdUsMarket(
                    inferredCurrency,
                    inferredMarket
                );
                const formatPriceField = (value) => {
                    if (value == null) return null;
                    return applyUsdPriceTruncation
                        ? truncateDecimals(value, 2)
                        : value;
                };

                const pricesWithIndex = fullBacktestData.map((p, i) => ({
                    ...p,
                    index: i,
                }));

                dividendHistory.value = pricesWithIndex
                    .filter(
                        (item) =>
                            item.amount !== undefined ||
                            item.amountFixed !== undefined
                    )
                    .map((item) => {
                        const prevDayData = pricesWithIndex[item.index - 1];
                        const nextDayData = pricesWithIndex[item.index + 1];
                        return {
                            배당락: new Date(item.date)
                                .toLocaleDateString('ko-KR', {
                                    year: '2-digit',
                                    month: '2-digit',
                                    day: '2-digit',
                                })
                                .replace(/\. /g, '.')
                                .slice(0, -1),
                            배당금:
                                item.amountFixed !== undefined
                                    ? item.amountFixed
                                    : item.amount,
                            // 분할 전 원금 및 조정내역을 표기용으로 전달
                            amountOriginal: item.amountOriginal,
                            amountSplitAdjustments: item.amountSplitAdjustments,
                            배당률: item.yield,
                            전일종가: formatPriceField(prevDayData?.close),
                            당일시가: formatPriceField(item.open),
                            당일종가: formatPriceField(item.close),
                            익일종가: formatPriceField(nextDayData?.close),
                        };
                    })
                    .reverse();

                const cleanedBacktestData = fullBacktestData
                    .filter((d) => d.close != null)
                    .map(({ date, open, high, low, close, volume }) => ({
                        date,
                        open,
                        high,
                        low,
                        close,
                        volume,
                    }));

                backtestData.value = cleanedBacktestData;
                const latestClose =
                    cleanedBacktestData.length > 0
                        ? cleanedBacktestData[cleanedBacktestData.length - 1]
                              .close
                        : null;

                // Holdings 데이터 로드 - backtestData에서 추출
                // 기존 holdings 대분류 지원 (마이그레이션 기간)
                if (staticData.holdings && Array.isArray(staticData.holdings)) {
                    // 기존 구조 (대분류)
                    holdingsData.value = staticData.holdings;
                } else {
                    // 새 구조 (backtestData 내부)
                    holdingsData.value = fullBacktestData
                        .filter((d) => d.holdings && Array.isArray(d.holdings))
                        .map((d) => ({
                            date: d.date,
                            data: d.holdings,
                        }));
                }

                tickerInfo.value = {
                    ...navInfo,
                    ...(staticData.tickerInfo || {}),
                };
                tickerInfo.value.yfSymbol = originalTickerSymbol
                    ? originalTickerSymbol.toUpperCase()
                    : null;
                if (latestClose) {
                    if (
                        !tickerInfo.value.regularMarketPrice ||
                        tickerInfo.value.regularMarketPrice <= 0
                    ) {
                        tickerInfo.value.regularMarketPrice = latestClose;
                    }
                    if (
                        !tickerInfo.value.price ||
                        tickerInfo.value.price <= 0
                    ) {
                        tickerInfo.value.price = latestClose;
                    }
                }
            }

            const liveSymbolParam = (originalTickerSymbol || '')
                .toString()
                .toUpperCase();
            const liveDataResponse = await fetch(
                `/api/getStockData?tickers=${liveSymbolParam}`
            );
            if (liveDataResponse.ok) {
                const liveDataArray = await liveDataResponse.json();
                const liveData = liveDataArray[0];
                if (liveData) {
                    tickerInfo.value = { ...tickerInfo.value, ...liveData };
                    if (liveData.exchange) {
                        tickerInfo.value.market =
                            marketNameMap[liveData.exchange] ||
                            liveData.exchange;
                    }
                }
            } else {
                console.warn(
                    `Could not fetch live data for ${originalTickerSymbol}`
                );
            }
        } catch (err) {
            console.error(`Failed to load data for ${sanitizedTicker}:`, err);

            // [핵심 수정] 에러 메시지를 분기 처리
            if (err.message.includes('500')) {
                // API 서버 에러인 경우
                error.value = `${sanitizedTicker.toUpperCase()}의 실시간 시세 정보를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.`;
            } else {
                // 그 외 다른 에러 (nav.json에 없는 티커 등)
                error.value =
                    err.message ||
                    `${sanitizedTicker.toUpperCase()}의 데이터를 불러오는 데 실패했습니다.`;
            }
        } finally {
            isLoading.value = false;
        }
    };
    return {
        tickerInfo,
        dividendHistory,
        backtestData,
        holdingsData,
        isLoading,
        error,
        loadData,
        isUpcoming,
    };
}
