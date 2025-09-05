import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Parameters required' });
    }
    try {
        // 'div' 이벤트를 통해 배당금 내역만 가져옵니다.
        const results = await yahooFinance.historical(symbol, {
            period1: from,
            period2: to,
            events: 'div'
        });
        res.status(200).json({ symbol, dividends: results });
    } catch (error) {
        res.status(200).json({ symbol, dividends: [], error: error.message });
    }
}
