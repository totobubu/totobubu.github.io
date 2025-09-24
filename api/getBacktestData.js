// api/getBacktestData.js

import yahooFinance from 'yahoo-finance2';

yahooFinance.setGlobalConfig({
    validation: {
        logErrors: false,
        failOnUnknownProperties: false,
        failOnInvalidData: false,
    },
});

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
        const results = await Promise.all(
            symbolArray.map(async (symbol) => {
                try {
                    // [핵심 수정 1] historical 호출 한 번으로 모든 데이터를 가져옵니다.
                    const historicalData = await yahooFinance.historical(
                        symbol,
                        {
                            period1: from,
                            period2: to,
                            interval: '1d',
                            events: 'history|div|split',
                        }
                    );

                    if (!historicalData || historicalData.length === 0) {
                        // 데이터가 전혀 없는 경우, IPO 날짜를 찾아봅니다.
                        const searchResult = await yahooFinance.search(symbol);
                        const firstTradeDate = searchResult.quotes[0]
                            ?.firstTradeDateMilliseconds
                            ? new Date(
                                  searchResult.quotes[0].firstTradeDateMilliseconds
                              )
                                  .toISOString()
                                  .split('T')[0]
                            : null;
                        return {
                            symbol,
                            firstTradeDate,
                            prices: [],
                            dividends: [],
                            splits: [],
                        };
                    }

                    // [핵심 수정 2] historical 데이터에서 IPO 날짜를 유추합니다.
                    const firstTradeDate = historicalData[0].date
                        .toISOString()
                        .split('T')[0];

                    const prices = historicalData.filter(
                        (d) => d && typeof d.close === 'number'
                    );
                    const dividends = historicalData.filter(
                        (d) => d && d.dividends
                    );
                    const splits = historicalData.filter(
                        (d) => d && d.stockSplits
                    );

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
                    console.error(`[API Error for ${symbol}]:`, e);
                    // 에러가 발생해도, 검색을 통해 IPO 날짜라도 찾아보려는 시도
                    try {
                        const searchResult = await yahooFinance.search(symbol);
                        const firstTradeDate = searchResult.quotes[0]
                            ?.firstTradeDateMilliseconds
                            ? new Date(
                                  searchResult.quotes[0].firstTradeDateMilliseconds
                              )
                                  .toISOString()
                                  .split('T')[0]
                            : null;
                        return {
                            symbol,
                            firstTradeDate,
                            error: e.message,
                            prices: [],
                            dividends: [],
                            splits: [],
                        };
                    } catch (searchError) {
                        return {
                            symbol,
                            error: e.message,
                            prices: [],
                            dividends: [],
                            splits: [],
                        };
                    }
                }
            })
        );

        let exchangeRatesData = [];
        const krwUsdRate = await yahooFinance.historical('USDKRW=X', {
            period1: from,
            period2: to,
        });
        exchangeRatesData = krwUsdRate.map((r) => ({
            date: r.date.toISOString().split('T')[0],
            rate: r.close,
        }));

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData: results,
            exchangeRates: exchangeRatesData,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
