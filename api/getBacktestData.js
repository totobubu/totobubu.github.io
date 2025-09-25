// api/getBacktestData.js (최종 안정화 버전 2)

import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbols, from, to } = req.query;
    if (!symbols || !from || to) {
        return res
            .status(400)
            .json({ error: 'Symbols, from, and to parameters are required' });
    }

    const symbolArray = symbols.split(',');

    try {
        const resultsPromises = symbolArray.map(async (symbol) => {
            try {
                // [핵심 수정] 데이터를 종류별로 명확하게 분리하여 각각 호출합니다.
                const queryOptions = {
                    period1: from,
                    period2: to,
                    interval: '1d',
                };

                const [prices, dividends, splits, quote] = await Promise.all([
                    yahooFinance
                        .historical(symbol, {
                            ...queryOptions,
                            events: 'history',
                        })
                        .catch(() => []),
                    yahooFinance
                        .historical(symbol, { ...queryOptions, events: 'div' })
                        .catch(() => []),
                    yahooFinance
                        .historical(symbol, {
                            ...queryOptions,
                            events: 'split',
                        })
                        .catch(() => []),
                    yahooFinance.quote(symbol).catch(() => null), // quote는 간단하므로 fields 없이 호출
                ]);

                if (prices.length === 0 && !quote) {
                    throw new Error(`No data found for symbol`);
                }

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
                console.error(`[API] ${symbol} 데이터 조회 실패:`, e.message);
                return {
                    symbol,
                    error: e.message,
                    prices: [],
                    dividends: [],
                    splits: [],
                };
            }
        });

        // 환율 데이터는 병렬로 함께 요청
        const exchangeRatesPromise = yahooFinance
            .historical('USDKRW=X', { period1: from, period2: to })
            .then((rates) =>
                rates.map((r) => ({
                    date: r.date.toISOString().split('T')[0],
                    rate: r.close,
                }))
            )
            .catch((e) => {
                console.error('환율 데이터 조회 실패:', e.message);
                return [];
            });

        const [tickerData, exchangeRatesData] = await Promise.all([
            Promise.all(resultsPromises),
            exchangeRatesPromise,
        ]);

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData,
            exchangeRates: exchangeRatesData,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
