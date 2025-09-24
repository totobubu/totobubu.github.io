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
        return res.status(400).json({ error: 'Symbols, from, and to parameters are required' });
    }

    let startDate = new Date(from);
    let endDate = new Date(to);
    const today = new Date();

    if (endDate > today) endDate = today;
    if (startDate > endDate) startDate = endDate;

    const period1 = startDate.toISOString().split('T')[0];
    const period2 = endDate.toISOString().split('T')[0];

    const symbolArray = symbols.split(',');

    try {
        const results = await Promise.all(
            symbolArray.map(async (symbol) => {
                try {
                    // [수정] quote 호출을 단순화하여 잠재적 에러 방지
                    const quote = await yahooFinance.quote(symbol);
                    const firstTradeDate = quote.firstTradeDateMilliseconds ? new Date(quote.firstTradeDateMilliseconds) : null;
                    
                    let effectiveFrom = startDate;
                    if (firstTradeDate && firstTradeDate > startDate) {
                        effectiveFrom = firstTradeDate;
                    }

                    if (effectiveFrom > endDate) {
                        return { symbol, firstTradeDate: firstTradeDate?.toISOString().split('T')[0], prices: [], dividends: [], splits: [] };
                    }
                    
                    const effectivePeriod1 = effectiveFrom.toISOString().split('T')[0];

                    // [수정] historical 호출을 별도의 try-catch로 감싸 더 상세한 에러 확인
                    let historicalData;
                    try {
                         historicalData = await yahooFinance.historical(symbol, {
                            period1: effectivePeriod1,
                            period2: period2,
                            interval: '1d',
                            events: 'history|div|split',
                        });
                    } catch(histError) {
                        // historical 데이터 조회 실패 시 에러를 던져 바깥 catch에서 잡도록 함
                        throw new Error(`Failed to fetch historical data for ${symbol}: ${histError.message}`);
                    }
                    

                    const prices = historicalData.filter((d) => d && typeof d.close === 'number');
                    const dividends = historicalData.filter((d) => d && d.dividends);
                    const splits = historicalData.filter((d) => d && d.stockSplits);

                    return {
                        symbol,
                        firstTradeDate: firstTradeDate?.toISOString().split('T')[0],
                        prices: prices.map((p) => ({ date: p.date.toISOString().split('T')[0], open: p.open, close: p.close })),
                        dividends: dividends.map((d) => ({ date: d.date.toISOString().split('T')[0], amount: d.dividends })),
                        splits: splits.map((s) => ({ date: s.date.toISOString().split('T')[0], ratio: s.stockSplits })),
                    };
                } catch (e) {
                    return { symbol, error: e.message, prices: [], dividends: [], splits: [] };
                }
            })
        );
        
        let exchangeRatesData = [];
        const krwUsdRate = await yahooFinance.historical('USDKRW=X', { period1, period2 });
        exchangeRatesData = krwUsdRate.map((r) => ({ date: r.date.toISOString().split('T')[0], rate: r.close }));

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData: results,
            exchangeRates: exchangeRatesData,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
