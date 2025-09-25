import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbols, from, to } = req.query;
    if (!symbols || !from || !to) {
        return res.status(400).json({ error: 'Symbols, from, and to parameters are required' });
    }

    const symbolArray = symbols.split(',');

    try {
        const resultsPromises = symbolArray.map(async (symbol) => {
            try {
                const queryOptions = { period1: from, period2: to };

                // [핵심 수정] Python 스크립트와 동일한 방식으로 데이터를 개별적으로, 그리고 안정적으로 요청합니다.
                // yfinance의 Ticker(symbol)와 유사하게 작동합니다.
                const ticker = yahooFinance.ticker.import(symbol);
                
                // .dividends 와 유사한 호출
                const dividendsPromise = ticker.getHistoricalDividends(queryOptions).catch(() => []);
                // .history() 와 유사한 호출
                const pricesPromise = ticker.getHistoricalPrices({ ...queryOptions, interval: '1d' }).catch(() => []);
                // .splits 와 유사한 호출 (별도 메서드 없음, history에서 가져와야 함)
                const splitsPromise = yahooFinance.historical(symbol, { ...queryOptions, events: 'split' }).catch(() => []);
                // .info 와 유사한 호출
                const quotePromise = yahooFinance.quote(symbol, { fields: ['firstTradeDateMilliseconds'] }).catch(() => null);

                const [dividends, prices, splits, quote] = await Promise.all([
                    dividendsPromise,
                    pricesPromise,
                    splitsPromise,
                    quotePromise,
                ]);

                if (prices.length === 0 && !quote) {
                    throw new Error(`No data found for symbol`);
                }
                
                const firstTradeDate = quote?.firstTradeDateMilliseconds
                    ? new Date(quote.firstTradeDateMilliseconds).toISOString().split('T')[0]
                    : (prices[0] ? prices[0].date.toISOString().split('T')[0] : null);

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
                return { symbol, error: e.message, prices: [], dividends: [], splits: [] };
            }
        });

        const exchangeRatesPromise = yahooFinance
            .historical('USDKRW=X', { period1: from, period2: to })
            .then((rates) => rates.map((r) => ({ date: r.date.toISOString().split('T')[0], rate: r.close })))
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
