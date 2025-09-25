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
        return res
            .status(400)
            .json({ error: 'Symbols, from, and to parameters are required' });
    }

    const symbolArray = symbols.split(',');

    try {
        const resultsPromises = symbolArray.map(async (symbol) => {
            try {
                const queryOptions = { period1: from, period2: to };
                const [prices, dividends, splits, quote] = await Promise.all([
                    yahooFinance
                        .historical(symbol, { ...queryOptions, interval: '1d' })
                        .catch(() => []),
                    yahooFinance
                        .getHistoricalDividends(symbol, queryOptions)
                        .catch(() => []),
                    yahooFinance
                        .historical(symbol, {
                            ...queryOptions,
                            events: 'split',
                        })
                        .catch(() => []),
                    yahooFinance.quote(symbol).catch(() => null),
                ]);

                if (prices.length === 0 && !quote) {
                    throw new Error(`No data found for symbol ${symbol}`);
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
                        amount: d.amount,
                    })),
                    splits: splits.map((s) => ({
                        date: s.date.toISOString().split('T')[0],
                        ratio: s.stockSplits,
                    })),
                };
            } catch (e) {
                console.error(
                    `[API] Error fetching data for ${symbol}:`,
                    e.message
                );
                return {
                    symbol,
                    error: e.message,
                    prices: [],
                    dividends: [],
                    splits: [],
                };
            }
        });

        const exchangeRatesPromise = yahooFinance
            .historical('USDKRW=X', { period1: from, period2: to })
            .then((rates) =>
                rates.map((r) => ({
                    date: r.date.toISOString().split('T')[0],
                    rate: r.close,
                }))
            )
            .catch((e) => {
                console.error('Error fetching exchange rates:', e.message);
                return [];
            });

        const [tickerData, exchangeRatesData] = await Promise.all([
            Promise.all(resultsPromises),
            exchangeRatesPromise,
        ]);

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res
            .status(200)
            .json({ tickerData, exchangeRates: exchangeRatesData });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
