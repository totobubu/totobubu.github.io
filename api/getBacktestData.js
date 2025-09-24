// api/getBacktestData.js
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
        const results = await Promise.all(
            symbolArray.map(async (symbol) => {
                try {
                    const [historicalData, quote] = await Promise.all([
                        yahooFinance.historical(symbol, {
                            period1: from,
                            period2: to,
                            interval: '1d',
                            events: 'history|div|split',
                        }),
                        yahooFinance.quote(symbol, {
                            fields: ['firstTradeDateMilliseconds'],
                        }),
                    ]);

                    const firstTradeDate = quote.firstTradeDateMilliseconds
                        ? new Date(quote.firstTradeDateMilliseconds).toISOString().split('T')[0]
                        : null;

                    const prices = historicalData.filter((d) => 'close' in d);
                    const dividends = historicalData.filter((d) => d.dividends);
                    const splits = historicalData.filter((d) => d.stockSplits);

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

        let exchangeRatesData = [];
        if (symbolArray.some(s => ['SPY', 'QQQ', 'DIA', 'USDKRW=X'].includes(s.toUpperCase())) || symbolArray.length > 1) {
             try {
                const krwUsdRate = await yahooFinance.historical('USDKRW=X', {
                    period1: from,
                    period2: to,
                });
                exchangeRatesData = krwUsdRate.map((r) => ({
                    date: r.date.toISOString().split('T')[0],
                    rate: r.close,
                }));
             } catch (e) {
                console.error("Failed to fetch exchange rate data:", e.message);
             }
        }

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData: results,
            exchangeRates: exchangeRatesData,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
