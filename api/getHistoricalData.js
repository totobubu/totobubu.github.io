import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    // [수정] symbols -> symbol 로 변경
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Symbol, from, and to parameters are required' });
    }

    try {
        const result = await yahooFinance.historical(symbol, {
            period1: from,
            period2: to,
            interval: '1d'
        });
        // [수정] 결과에 symbol을 명시적으로 포함
        res.status(200).json({ symbol, data: result });
    } catch (error) {
        // [수정] 실패 시에도 symbol 정보와 함께 200 응답
        res.status(200).json({ symbol, data: [], error: error.message });
    }
}
