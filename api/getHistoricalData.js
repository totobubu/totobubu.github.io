import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbols, from, to } = req.query;
    if (!symbols || !from || !to) {
        return res
            .status(400)
            .json({ error: 'Symbols, from, and to parameters are required' });
    }
    const symbolArray = symbols.split(',');
    try {
        const results = await Promise.all(
            symbolArray.map((symbol) =>
                yahooFinance
                    .historical(symbol, {
                        period1: from,
                        period2: to,
                        interval: '1d', // 일별 데이터
                    })
                    .catch((e) => ({ symbol, error: e.message }))
            )
        );
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
