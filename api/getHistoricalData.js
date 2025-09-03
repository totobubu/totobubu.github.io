import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    console.log('--- [API START] ---');
    const { symbols, from, to } = req.query;
    console.log('[API] 요청 받은 파라미터:', { symbols, from, to });

    if (!symbols || !from || !to) {
        console.error('[API ERROR] 필수 파라미터 누락');
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
                    console.log(
                        `[API] '${symbol}' 데이터 ${historicalData.length}개 수신 성공`
                    );
                    return historicalData.map((dataPoint) => ({
                        ...dataPoint,
                        symbol,
                    }));
                } catch (e) {
                    console.error(
                        `[API ERROR] '${symbol}' 데이터 수신 실패:`,
                        e.message
                    );
                    return { symbol, error: e.message };
                }
            })
        );
        console.log('--- [API END] ---');
        res.status(200).json(results);
    } catch (error) {
        console.error('[API FATAL ERROR]', error);
        res.status(500).json({ error: error.message });
    }
}
