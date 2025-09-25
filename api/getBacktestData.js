// api/getBacktestData.js

import yahooFinance from 'yahoo-finance2';
import path from 'path';
import fs from 'fs/promises';

yahooFinance.setGlobalConfig({
    validation: {
        logErrors: false,
        failOnUnknownProperties: false,
        failOnInvalidData: false,
    },
});

// [핵심] Node.js 서버 환경에서 public 폴더의 절대 경로를 찾습니다.
const publicDir = path.resolve('./public');
const exchangeRatesFilePath = path.join(publicDir, 'exchange-rates.json');

let allExchangeRates = [];
// 메모리에 환율 데이터를 캐싱하여 반복적인 파일 읽기를 방지합니다.
async function loadExchangeRates() {
    if (allExchangeRates.length > 0) return allExchangeRates;
    try {
        const fileContent = await fs.readFile(exchangeRatesFilePath, 'utf-8');
        allExchangeRates = JSON.parse(fileContent);
        return allExchangeRates;
    } catch (e) {
        console.error('Failed to load local exchange-rates.json', e);
        return [];
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbols, from, to } = req.query;
    if (!symbols || !from || !to) {
        return res
            .status(400)
            .json({ error: 'Symbols, from, and to parameters are required' });
    }

    const symbolArray = symbols.split(',');

    try {
        const allRates = await loadExchangeRates();

        // [핵심] 저장된 데이터에서 필요한 기간만큼 필터링합니다.
        const exchangeRatesData = allRates.filter((rate) => {
            return rate.date >= from && rate.date <= to;
        });

        const results = await Promise.all(
            symbolArray.map(async (symbol) => {
                try {
                    // [핵심 수정] 데이터를 종류별로 명확하게 분리하여 호출합니다.
                    const queryOptions = { period1, period2, interval: '1d' };

                    const [prices, dividends, splits, quote] =
                        await Promise.all([
                            yahooFinance
                                .historical(symbol, {
                                    ...queryOptions,
                                    events: 'history',
                                })
                                .catch(() => []),
                            yahooFinance
                                .historical(symbol, {
                                    ...queryOptions,
                                    events: 'div',
                                })
                                .catch(() => []),
                            yahooFinance
                                .historical(symbol, {
                                    ...queryOptions,
                                    events: 'split',
                                })
                                .catch(() => []),
                            yahooFinance
                                .quote(symbol, {
                                    fields: ['firstTradeDateMilliseconds'],
                                })
                                .catch(() => null),
                        ]);

                    const firstTradeDate = quote?.firstTradeDateMilliseconds
                        ? new Date(quote.firstTradeDateMilliseconds)
                              .toISOString()
                              .split('T')[0]
                        : prices[0]
                          ? prices[0].date.toISOString().split('T')[0]
                          : null;

                    return {
                        symbol,
                        firstTradeDate,
                        prices: prices.map((p) => ({
                            date: p.date.toISOString().split('T')[0],
                            open: p.open,
                            close: p.close,
                        })),
                        dividends: dividends.map((d) => ({
                            date: d.date.toISOString().split('T')[0],
                            amount: d.dividends,
                        })),
                        splits: splits.map((s) => ({
                            date: s.date.toISOString().split('T')[0],
                            ratio: s.stockSplits,
                        })),
                    };
                } catch (e) {
                    return {
                        symbol,
                        error: e.message,
                        prices: [],
                        dividends: [],
                        splits: [],
                    };
                }
            })
        );

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData: results,
            exchangeRates: exchangeRatesData, // 로컬 파일에서 필터링한 데이터 반환
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
