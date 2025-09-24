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
        const results = await Promise.all(
            symbolArray.map(async (symbol) => {
                try {
                    const historicalData = await yahooFinance.historical(
                        symbol,
                        {
                            period1: from,
                            period2: to,
                            interval: '1d',
                            events: 'history|div|split', // 주가, 배당, 액면분할 모두 요청
                        }
                    );

                    const prices = historicalData.filter((d) => 'close' in d);
                    const dividends = historicalData.filter((d) => d.dividends);
                    const splits = historicalData.filter((d) => d.stockSplits);

                    return {
                        symbol,
                        firstTradeDate, // [핵심 추가] IPO 날짜 반환
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
                            ratio: s.stockSplits, // 예: "2:1"
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

        const krwUsdRate = await yahooFinance.historical('USDKRW=X', {
            period1: from,
            period2: to,
        });

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData: results,
            exchangeRates: krwUsdRate.map((r) => ({
                date: r.date.toISOString().split('T')[0],
                rate: r.close,
            })),
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
