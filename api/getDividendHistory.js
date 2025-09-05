import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Parameters required' });
    }
    try {
        // [핵심 수정] 여기도 동일하게 UTC 시간대를 명시합니다.
        const fromUTC = new Date(`${from}T00:00:00.000Z`);
        const toUTC = new Date(`${to}T23:59:59.999Z`);
        
        const queryOptions = {
            period1: fromUTC,
            period2: toUTC,
            events: 'div'
        };
        const results = await yahooFinance.historical(symbol, queryOptions);
        
        res.status(200).json({ symbol, dividends: results });
    } catch (error) {
        res.status(200).json({ symbol, dividends: [], error: error.message });
    }
}
