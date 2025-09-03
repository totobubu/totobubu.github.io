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
            symbolArray.map(async (symbol) => {
                try {
                    const historicalData = await yahooFinance.historical(
                        symbol,
                        {
                            period1: from,
                            period2: to,
                            interval: '1d',
                        }
                    );
                    // [핵심 수정] 각 데이터 포인트에 symbol을 추가합니다.
                    return historicalData.map((dataPoint) => ({
                        ...dataPoint,
                        symbol,
                    }));
                } catch (e) {
                    // 개별 종목 에러는 무시하지 않고, 에러 정보와 함께 반환
                    return { symbol, error: e.message };
                }
            })
        );
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
