import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    console.log(`[LOG] /api/getHistoricalData received request for ${symbol} from ${from} to ${to}`);

    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Symbol, from, and to parameters are required' });
    }

    try {
        const queryOptions = {
            period1: from,
            period2: to,
            interval: '1d'
        };

        // [핵심 디버그] 라이브러리 호출 직전의 최종 옵션을 로그로 남깁니다.
        console.log(`[LOG] Calling yahooFinance.historical for ${symbol} with options:`, JSON.stringify(queryOptions, null, 2));

        const result = await yahooFinance.historical(symbol, queryOptions);
        
        console.log(`[LOG] Successfully fetched historical data for ${symbol}. Found ${result.length} records.`);
        res.status(200).json({ symbol, data: result });
    } catch (error) {
        // [핵심 디버그] 에러 발생 시, 에러 객체 전체를 로그로 남깁니다.
        console.error(`[ERROR] Failed to fetch historical data for ${symbol}. Query:`, req.query);
        console.error('[ERROR] Detailed Error:', error);

        res.status(200).json({ 
            symbol, 
            data: [], 
            error: `Failed for symbol ${symbol}: ${error.message}`,
            query: req.query
        });
    }
}
