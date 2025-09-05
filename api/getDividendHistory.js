import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Parameters required' });
    }
    try {
        // [핵심 수정] new Date()를 모두 제거하고, 문자열을 그대로 전달합니다.
        const queryOptions = {
            period1: from,
            period2: to,
            events: 'div',
        };

          // [핵심 디버그] 라이브러리 호출 직전의 최종 옵션을 로그로 남깁니다.
        console.log(`[LOG] Calling yahooFinance.historical for ${symbol} with options:`, JSON.stringify(queryOptions, null, 2));
        
        const results = await yahooFinance.historical(symbol, queryOptions);

        res.status(200).json({ symbol, dividends: results });
    } catch (error) {

         // [핵심 디버그] 에러 발생 시, 에러 객체 전체를 로그로 남깁니다.
        console.error(`[ERROR] Failed to fetch historical data for ${symbol}. Query:`, req.query);
        console.error('[ERROR] Detailed Error:', error);

        res.status(200).json({
            symbol,
            dividends: [],
            error: `Failed for symbol ${symbol}: ${error.message}`,
            query: req.query,
        });
    }
}
