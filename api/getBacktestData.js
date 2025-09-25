import yahooFinance from 'yahoo-finance2';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(action, retries = 3, delayDuration = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            return await action();
        } catch (error) {
            if (i < retries - 1) {
                console.log(`Attempt ${i + 1} failed, retrying in ${delayDuration}ms...`);
                await delay(delayDuration);
            } else {
                throw error;
            }
        }
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
        return res.status(400).json({ error: 'Symbols, from, and to parameters are required' });
    }

    const symbolArray = symbols.split(',');

    try {
        const resultsPromises = symbolArray.map(async (symbol) => {
            try {
                const queryOptions = { period1: from, period2: to, interval: '1d' };
                
                const action = () => Promise.all([
                    yahooFinance.historical(symbol, { ...queryOptions, events: 'history' }),
                    yahooFinance.historical(symbol, { ...queryOptions, events: 'div' }),
                    yahooFinance.historical(symbol, { ...queryOptions, events: 'split' }),
                    yahooFinance.quote(symbol)
                ]);

                const [prices, dividends, splits, quote] = await fetchWithRetry(action);

                if (prices.length === 0 && !quote) {
                    throw new Error(`No data found for symbol`);
                }
                
                const firstTradeDate = quote?.firstTradeDateMilliseconds
                    ? new Date(quote.firstTradeDateMilliseconds).toISOString().split('T')[0]
                    : (prices[0] ? prices[0].date.toISOString().split('T')[0] : null);

                return {
                    symbol,
                    firstTradeDate,
                    prices: prices.map(p => ({ date: p.date.toISOString().split('T')[0], open: p.open, close: p.close })),
                    dividends: dividends.map(d => ({ date: d.date.toISOString().split('T')[0], amount: d.dividends })),
                    splits: splits.map(s => ({ date: s.date.toISOString().split('T')[0], ratio: s.stockSplits })),
                };
            } catch (e) {
                console.error(`[API] ${symbol} 데이터 조회 최종 실패:`, e.message);
                return { symbol, error: e.message, prices: [], dividends: [], splits: [] };
            }
        });

        const exchangeRatesPromise = fetchWithRetry(() => 
            yahooFinance.historical('USDKRW=X', { period1: from, period2: to })
        )
        .then(rates => rates.map(r => ({ date: r.date.toISOString().split('T')[0], rate: r.close })))
        .catch(e => {
            console.error('환율 데이터 조회 최종 실패:', e.message);
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
