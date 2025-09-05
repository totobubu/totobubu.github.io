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
        const results = await yahooFinance.historical(symbol, queryOptions);

        res.status(200).json({ symbol, dividends: results });
    } catch (error) {
        res.status(200).json({
            symbol,
            dividends: [],
            error: `Failed for symbol ${symbol}: ${error.message}`,
            query: req.query,
        });
    }
}
