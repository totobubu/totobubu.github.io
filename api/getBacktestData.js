// api/getBacktestData.js (Axios 버전 최종)
import axios from 'axios';

// 야후 파이낸스 API는 특정 User-Agent 헤더가 없으면 요청을 거부할 수 있습니다.
const YF_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
};

// 타임스탬프를 YYYY-MM-DD 형식으로 변환하는 헬퍼
const formatDate = (timestamp) =>
    new Date(timestamp * 1000).toISOString().split('T')[0];

export default async function handler(req, res) {
    res.setHeader('Access--Allow-Origin', '*');
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

    // 야후 파이낸스는 UNIX 타임스탬프를 사용합니다.
    const period1 = Math.floor(new Date(from).getTime() / 1000);
    const period2 = Math.floor(new Date(to).getTime() / 1000);

    const symbolArray = symbols.split(',');

    try {
        const resultsPromises = symbolArray.map(async (symbol) => {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history,div,split`;

                const { data } = await axios.get(url, { headers: YF_HEADERS });

                if (data.chart.error) {
                    throw new Error(
                        data.chart.error.description ||
                            'Unknown error from Yahoo API'
                    );
                }

                const result = data.chart.result[0];
                if (!result || !result.timestamp) {
                    return {
                        symbol,
                        prices: [],
                        dividends: [],
                        splits: [],
                        firstTradeDate: null,
                    };
                }

                const timestamps = result.timestamp;
                const quotes = result.indicators.quote[0];
                const events = result.events || {};

                const prices = timestamps
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

                return { symbol, firstTradeDate, prices, dividends, splits };
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

        const exchangeRatesPromise = axios
            .get(
                `https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?period1=${period1}&period2=${period2}&interval=1d`,
                { headers: YF_HEADERS }
            )
            .then(({ data }) => {
                const result = data.chart.result[0];
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
