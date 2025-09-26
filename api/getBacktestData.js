// api\getBacktestData.js
import axios from 'axios';

const YF_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
};

const formatDate = (timestamp) =>
    new Date(timestamp * 1000).toISOString().split('T')[0];

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

    const period1 = Math.floor(new Date(from).getTime() / 1000);
    const period2 = Math.floor(new Date(to).getTime() / 1000);

    const symbolArray = symbols.split(',');

    try {
        const resultsPromises = symbolArray.map(async (symbol) => {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?period1=${period1}&period2=${period2}&interval=1d&events=history,div,split`;
                const { data } = await axios.get(url, { headers: YF_HEADERS });

                if (data.chart.error) {
                    throw new Error(
                        data.chart.error.description ||
                            `Unknown error for ${symbol}`
                    );
                }

                const result = data.chart.result[0];
                if (!result || !result.timestamp) {
                    return {
                        symbol: symbol.toUpperCase(),
                        prices: [],
                        dividends: [],
                        splits: [],
                        firstTradeDate: null,
                    };
                }

                const timestamps = result.timestamp;
                const quotes = result.indicators.quote[0];
                const events = result.events || {};

                const prices = (timestamps || [])
                    .map((ts, i) => ({
                        date: formatDate(ts),
                        open: quotes.open[i],
                        close: quotes.close[i],
                    }))
                    .filter((p) => p.open != null && p.close != null);

                const dividends = (events.dividends || []).map((d) => ({
                    date: formatDate(d.date),
                    amount: d.amount,
                }));

                const splits = (events.splits || []).map((s) => ({
                    date: formatDate(s.date),
                    ratio: `${s.numerator}:${s.denominator}`,
                }));

                const firstTradeDate = result.meta.firstTradeTime
                    ? formatDate(result.meta.firstTradeTime)
                    : null;

                return {
                    symbol: symbol.toUpperCase(),
                    firstTradeDate,
                    prices,
                    dividends,
                    splits,
                };
            } catch (e) {
                console.error(
                    `[API] Error fetching data for ${symbol}:`,
                    e.message
                );
                return {
                    symbol: symbol.toUpperCase(),
                    error: e.message,
                    prices: [],
                    dividends: [],
                    splits: [],
                };
            }
        });

        const exchangeRatesPromise = axios
            .get(
                `https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?period1=${period1}&period2=${period2}&interval=1d`,
                { headers: YF_HEADERS }
            )
            .then(({ data }) => {
                const result = data.chart.result[0];
                if (!result || !result.timestamp) return [];
                return result.timestamp
                    .map((ts, i) => ({
                        date: formatDate(ts),
                        rate: result.indicators.quote[0].close[i],
                    }))
                    .filter((r) => r.rate != null);
            })
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
