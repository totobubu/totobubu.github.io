import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Symbol, from, and to parameters are required' });
    }

    try {
        // [핵심 수정] 문자열을 Date 객체로 변환하여 전달합니다.
        const queryOptions = {
            period1: new Date(from),
            period2: new Date(to),
            interval: '1d'
        };
        const result = await yahooFinance.historical(symbol, queryOptions);
        
        res.status(200).json({ symbol, data: result });
    } catch (error) {
        res.status(200).json({ symbol, data: [], error: error.message });
    }
}
